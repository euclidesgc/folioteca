import type { IncomingMessage } from 'node:http';

import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import { WebSocket as NodeWebSocket } from 'ws';
import * as Y from 'yjs';

/** Prazo padrão das esperas: nenhum teste espera um tempo fixo. */
const DEFAULT_TIMEOUT_MS = 5000;

export type ConnectCollabInput = {
  port: number;
  documentId: string;
  cookie?: string;
  origin?: string;
  /** Prazo de `synced` e `refused`, em milissegundos. */
  timeout?: number;
};

export type CollabConnection = {
  provider: HocuspocusProvider;
  ydoc: Y.Doc;
  /** Resolve no primeiro `synced`; rejeita ao estourar o prazo. */
  synced: Promise<void>;
  /** Resolve com o motivo da recusa; rejeita ao estourar o prazo. */
  refused: Promise<string>;
  /** Mensagens sem estado recebidas do servidor, na ordem. */
  statelessPayloads: string[];
  close: () => Promise<void>;
};

export type RawUpgradeInput = {
  port: number;
  path?: string;
  cookie?: string;
  origin?: string;
  timeout?: number;
};

export type RawUpgradeResult = {
  /** Status da resposta HTTP crua, ou `null` quando o socket foi destruído. */
  status: number | null;
  /** `true` se o WebSocket chegou a abrir. */
  opened: boolean;
};

function buildHeaders(
  cookie: string | undefined,
  origin: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (cookie !== undefined) {
    headers.Cookie = cookie;
  }

  if (origin !== undefined) {
    headers.Origin = origin;
  }

  return headers;
}

/** Promessa que rejeita com uma mensagem ao estourar o prazo. */
function withTimeout<T>(
  build: (resolve: (value: T) => void) => void,
  timeout: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${message} (prazo de ${timeout} ms)`));
    }, timeout);

    // O prazo não segura o processo nem o fim do teste.
    timer.unref();

    build((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

/**
 * Cliente real do Hocuspocus sobre o `ws` do Node. O provider só aceita uma
 * implementação de WebSocket construída com a URL, então os cabeçalhos
 * `Cookie` e `Origin` entram por uma subclasse mínima.
 */
export function connectCollab({
  port,
  documentId,
  cookie,
  origin,
  timeout = DEFAULT_TIMEOUT_MS,
}: ConnectCollabInput): CollabConnection {
  const headers = buildHeaders(cookie, origin);

  class CollabWebSocket extends NodeWebSocket {
    constructor(address: string | URL) {
      super(address, { headers });
    }
  }

  const websocketProvider = new HocuspocusProviderWebsocket({
    url: `ws://127.0.0.1:${port}/collab`,
    WebSocketPolyfill: CollabWebSocket,
    autoConnect: false,
    maxAttempts: 1,
  });

  const ydoc = new Y.Doc();
  const statelessPayloads: string[] = [];

  let onSynced: ((value: void) => void) | undefined;
  let onRefused: ((reason: string) => void) | undefined;

  const provider = new HocuspocusProvider({
    websocketProvider,
    name: documentId,
    document: ydoc,
    // Marcador fixo: o servidor autentica pelo cookie do upgrade, não por
    // este campo. Não é credencial.
    token: 'cookie-session',
    onSynced: () => {
      onSynced?.();
    },
    onStateless: ({ payload }) => {
      statelessPayloads.push(payload);
    },
    onAuthenticationFailed: ({ reason }) => {
      onRefused?.(reason);
    },
  });

  const synced = withTimeout<void>(
    (resolve) => {
      onSynced = resolve;

      if (provider.isSynced) {
        resolve();
      }
    },
    timeout,
    `O documento ${documentId} não sincronizou`,
  );

  const refused = withTimeout<string>(
    (resolve) => {
      onRefused = resolve;
    },
    timeout,
    `A conexão com ${documentId} não foi recusada`,
  );

  // Um teste espera `synced`, outro espera `refused`: a promessa não esperada
  // vai estourar o prazo em silêncio, sem rejeição solta.
  void synced.catch(() => undefined);
  void refused.catch(() => undefined);

  // Sem `autoConnect`: o provider entra antes de o socket abrir, então nenhum
  // evento se perde entre a criação e a assinatura.
  provider.attach();
  void websocketProvider.connect();

  const close = (): Promise<void> => {
    provider.destroy();
    websocketProvider.destroy();
    ydoc.destroy();

    return Promise.resolve();
  };

  return { provider, ydoc, synced, refused, statelessPayloads, close };
}

/**
 * Upgrade cru, sem Hocuspocus: serve para ver o status HTTP da recusa e provar
 * que o WebSocket nem chega a abrir.
 */
export function rawUpgrade({
  port,
  path = '/collab',
  cookie,
  origin,
  timeout = DEFAULT_TIMEOUT_MS,
}: RawUpgradeInput): Promise<RawUpgradeResult> {
  const socket = new NodeWebSocket(`ws://127.0.0.1:${port}${path}`, {
    headers: buildHeaders(cookie, origin),
  });

  return withTimeout<RawUpgradeResult>(
    (resolve) => {
      socket.on(
        'unexpected-response',
        (_request: unknown, response: IncomingMessage) => {
          response.resume();
          socket.terminate();
          resolve({ status: response.statusCode ?? null, opened: false });
        },
      );

      socket.on('error', () => {
        socket.terminate();
        resolve({ status: null, opened: false });
      });

      socket.on('open', () => {
        socket.close();
        resolve({ status: null, opened: true });
      });
    },
    timeout,
    `O upgrade em ${path} não respondeu`,
  );
}

/** `true` quando a promessa termina dentro do prazo, `false` ao estourar. */
export function settlesWithin(
  promise: Promise<unknown>,
  timeout = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, timeout);

    timer.unref();

    void promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(true);
      },
    );
  });
}

/**
 * Espera uma condição virar verdadeira, consultando de novo a cada volta do
 * laço de eventos, com prazo explícito. Nenhuma espera fixa.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  {
    timeout = DEFAULT_TIMEOUT_MS,
    message = 'A condição esperada não aconteceu',
  }: { timeout?: number; message?: string } = {},
): Promise<void> {
  const deadline = Date.now() + timeout;

  for (;;) {
    if (await condition()) {
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(`${message} (prazo de ${timeout} ms)`);
    }

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}
