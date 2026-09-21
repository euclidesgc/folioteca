import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';

import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Hocuspocus } from '@hocuspocus/server';
import type { RawData, WebSocket, WebSocketServer } from 'ws';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';

import { canEdit } from '../access/access-level';
import { AccessService } from '../access/access.service';
import { SessionService } from '../auth/session.service';
import { env } from '../config/env';
import { DocumentsService } from '../documents/documents.service';
import { checkUpgradeRequest } from './upgrade-gate';

/** Contexto que a porta do upgrade entrega ao Hocuspocus. */
type CollabContext = { personId: string };

/** Resultado da autenticação do upgrade. */
export type UpgradeAuthentication =
  | { ok: true; personId: string }
  | { ok: false; status: 401 | 403 };

/**
 * Recusa única: documento inexistente, de outra pessoa e id malformado saem
 * iguais daqui, para a conexão não revelar qual foi.
 *
 * Sem `message` de propósito: o Hocuspocus imprime `console.error('[onConnect]',
 * …)` sempre que o erro do hook tem mensagem, e recusar acesso é rotina, não
 * falha do servidor. Sem `reason`, a conexão recebe o mesmo `permission-denied`
 * de qualquer recusa.
 */
class AccessRefusedError extends Error {
  constructor() {
    super('');
    this.name = 'AccessRefusedError';
  }
}

/** Aviso enviado às conexões do documento depois de gravar o conteúdo. */
const STORED_MESSAGE = JSON.stringify({ type: 'stored' });

/** Teto do debounce: nunca esperar mais do que cinco janelas para gravar. */
const MAX_DEBOUNCE_FACTOR = 5;

function toUint8Array(data: RawData): Uint8Array {
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }

  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  return new Uint8Array(data);
}

/** Pedido de upgrade do Node no formato que o Hocuspocus espera. */
function toWebRequest(request: IncomingMessage): Request {
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') {
      headers.set(name, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    }
  }

  const url = new URL(
    request.url ?? '/collab',
    `http://${request.headers.host ?? 'localhost'}`,
  );

  return new Request(url, { headers });
}

/**
 * Servidor de colaboração embutido: uma instância do Hocuspocus sem porta
 * própria, alimentada pelos sockets que `attachCollab` aceita em `/collab`.
 *
 * Limite conhecido: o acesso é conferido ao conectar. Derrubar o socket de
 * quem perdeu o acesso no meio da sessão fica para a fatia 015.
 */
@Injectable()
export class CollabService implements OnModuleDestroy {
  private readonly hocuspocus: Hocuspocus<CollabContext>;

  /** Sockets crus aceitos em `/collab`, para fechá-los no encerramento. */
  private readonly sockets = new Set<WebSocket>();

  /** Servidor WebSocket de `/collab`, quando `attachCollab` ligou um. */
  private websocketServer: WebSocketServer | null = null;

  constructor(
    private readonly sessions: SessionService,
    private readonly access: AccessService,
    private readonly documents: DocumentsService,
  ) {
    this.hocuspocus = new Hocuspocus<CollabContext>({
      debounce: env.COLLAB_STORE_DEBOUNCE_MS,
      maxDebounce: env.COLLAB_STORE_DEBOUNCE_MS * MAX_DEBOUNCE_FACTOR,

      // Primeiro hook com o nome do documento: roda antes de qualquer carga
      // ou sincronização, então nada nasce para quem não tem acesso.
      onConnect: async ({ context, documentName, connectionConfig }) => {
        const accessLevel = await this.access.resolveAccess(
          context.personId,
          documentName,
        );

        if (accessLevel === 'none') {
          throw new AccessRefusedError();
        }

        connectionConfig.readOnly = !canEdit(accessLevel);
      },

      onLoadDocument: async ({ document, documentName }) => {
        const state = await this.documents.loadContent(documentName);

        if (state !== null) {
          applyUpdate(document, state);
        }
      },

      onStoreDocument: async ({ document, documentName }) => {
        await this.documents.saveContent(
          documentName,
          encodeStateAsUpdate(document),
        );

        document.broadcastStateless(STORED_MESSAGE);
      },
    });
  }

  /** Confere a porta do upgrade e resolve a sessão do cookie. */
  async authenticateUpgrade(
    headers: IncomingHttpHeaders,
  ): Promise<UpgradeAuthentication> {
    const decision = checkUpgradeRequest(headers, env.COLLAB_ALLOWED_ORIGINS);

    if (!decision.ok) {
      return decision;
    }

    const person = await this.sessions.findValid(decision.sessionToken);

    if (person === null) {
      return { ok: false, status: 401 };
    }

    return { ok: true, personId: person.id };
  }

  /** Guarda o servidor de `/collab` para encerrá-lo junto com o módulo. */
  registerWebSocketServer(server: WebSocketServer): void {
    this.websocketServer = server;
  }

  /** Entrega ao Hocuspocus um socket já aceito, com o contexto da sessão. */
  handleConnection(
    websocket: WebSocket,
    request: IncomingMessage,
    context: CollabContext,
  ): void {
    this.sockets.add(websocket);

    const connection = this.hocuspocus.handleConnection(
      websocket,
      toWebRequest(request),
      context,
    );

    websocket.on('message', (data: RawData) => {
      connection.handleMessage(toUint8Array(data));
    });

    websocket.on('close', (code: number, reason: Buffer) => {
      this.sockets.delete(websocket);
      connection.handleClose({ code, reason: reason.toString() });
    });
  }

  /**
   * Fecha as conexões, espera a gravação pendente e derruba os sockets crus:
   * a `Connection` do Hocuspocus fechar não fecha o socket que `attachCollab`
   * aceitou, e um socket aberto segura o `server.close()` do Nest para sempre.
   */
  async onModuleDestroy(): Promise<void> {
    await this.flushPendingStores();
    this.closeSockets();
  }

  /** Derruba todo socket de `/collab` e fecha o servidor WebSocket. */
  private closeSockets(): void {
    const sockets = new Set([
      ...this.sockets,
      ...(this.websocketServer?.clients ?? []),
    ]);

    for (const socket of sockets) {
      socket.close();
      // O fechamento é um aperto de mão: sem resposta do cliente o socket fica
      // aberto, então ele é derrubado em seguida, sem esperar.
      socket.terminate();
    }

    this.sockets.clear();
    this.websocketServer?.close();
    this.websocketServer = null;
  }

  /** Espera o Hocuspocus gravar o que estava pendente e esvaziar a memória. */
  private async flushPendingStores(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (this.hocuspocus.getDocumentsCount() === 0) {
        resolve();

        return;
      }

      this.hocuspocus.configuration.extensions.push({
        afterUnloadDocument: ({ instance }) => {
          if (instance.getDocumentsCount() === 0) {
            resolve();
          }

          return Promise.resolve();
        },
      });

      this.hocuspocus.closeConnections();
      this.hocuspocus.flushPendingStores();
    });
  }
}
