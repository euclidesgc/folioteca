import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import { Logger, type INestApplication } from '@nestjs/common';
import { WebSocketServer } from 'ws';

import { CollabService } from './collab.service';
import { isCollabPath } from './upgrade-gate';

const logger = new Logger('CollabUpgrade');

const STATUS_LINES: Record<401 | 403, string> = {
  401: 'HTTP/1.1 401 Unauthorized',
  403: 'HTTP/1.1 403 Forbidden',
};

const REFUSAL_REASONS: Record<401 | 403, string> = {
  401: 'sem sessão válida',
  403: 'origem recusada',
};

/** Recusa o upgrade com uma resposta HTTP crua, sem corpo. */
function refuse(socket: Duplex, status: 401 | 403): void {
  socket.write(`${STATUS_LINES[status]}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/** `CollabService` do app, ou `null` quando o módulo não está registrado. */
function getCollabService(app: INestApplication): CollabService | null {
  try {
    return app.get(CollabService);
  } catch {
    return null;
  }
}

/**
 * Liga o WebSocket de colaboração ao servidor HTTP do Nest: `/collab` fica
 * fora do prefixo `/api` porque não passa pelo roteador do Nest.
 */
export function attachCollab(app: INestApplication): void {
  const collab = getCollabService(app);

  // Módulo de teste montado sem o `CollabModule`: não há `/collab` para ligar.
  if (collab === null) {
    return;
  }

  const wss = new WebSocketServer({ noServer: true });
  const server = app.getHttpServer() as Server;

  collab.registerWebSocketServer(wss);

  const handle = async (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> => {
    if (!isCollabPath(request.url)) {
      socket.destroy();

      return;
    }

    const authentication = await collab.authenticateUpgrade(request.headers);

    if (!authentication.ok) {
      // Só o status e o motivo fixo: nunca cabeçalhos, cookie nem URL.
      logger.warn(
        `Upgrade de /collab recusado: ${authentication.status} (${REFUSAL_REASONS[authentication.status]})`,
      );
      refuse(socket, authentication.status);

      return;
    }

    wss.handleUpgrade(request, socket, head, (websocket) => {
      logger.log('Upgrade de /collab aceito');
      websocket.on('close', (code: number) =>
        logger.log(`Conexão de /collab fechada: código ${code}`),
      );
      collab.handleConnection(websocket, request, {
        personId: authentication.personId,
      });
    });
  };

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    void handle(request, socket, head).catch((error: unknown) => {
      logger.error('Falha ao tratar o upgrade de /collab', error);
      socket.destroy();
    });
  });
}
