import { DurableObject } from 'cloudflare:workers';
import openNextWorker from './.open-next/worker.js';
export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js';

export default {
  async fetch(request, env, ctx) {
    const realtimeHub = env.REALTIME_HUB.get(env.REALTIME_HUB.idFromName('site-updates'));
    const url = new URL(request.url);

    if (url.pathname === '/api/realtime' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return realtimeHub.fetch(request);
    }

    const response = await openNextWorker.fetch(request, env, ctx);
    if (
      url.pathname.startsWith('/api/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      response.ok
    ) {
      ctx.waitUntil(
        realtimeHub.fetch('https://realtime/publish', { method: 'POST' }).catch((error) => {
          console.error('Unable to publish realtime update:', error instanceof Error ? error.message : 'Unknown error');
        })
      );
    }
    return response;
  }
};

export class RealtimeHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/publish' && request.method === 'POST') {
      for (const socket of this.ctx.getWebSockets()) {
        try {
          socket.send('refresh');
        } catch (error) {
          console.error('Unable to send realtime update:', error instanceof Error ? error.message : 'Unknown error');
          socket.close(1011, 'Unable to send update');
        }
      }
      return new Response(null, { status: 204 });
    }

    if (request.method === 'GET' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return new Response('Forbidden.', { status: 403 });

      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found.', { status: 404 });
  }

  webSocketMessage(socket) {
    socket.close(1008, 'Client messages are disabled');
  }

  webSocketClose(socket, code, reason) {
    if (code >= 1000 && code < 5000 && ![1004, 1005, 1006, 1015].includes(code)) {
      socket.close(code, reason);
    } else {
      socket.close();
    }
  }
}
