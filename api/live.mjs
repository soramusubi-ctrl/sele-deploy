import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { configuration } from '../server/security.mjs';
import { attachLiveRelay, LIVE_LIMITS } from '../server/live.mjs';

// Vercel's native WebSocket Functions (Fluid compute / public beta, June 2026).
// No standalone external server or Redis audio queues. Concurrency/budget is durable.
export const maxDuration = 60;
export function createLiveServer({ env = process.env, relay = attachLiveRelay } = {}) {
  const server = createServer((_req, res) => {
    res.writeHead(426, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '音声機能はWebSocket接続を使用します。' }));
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: LIVE_LIMITS.packetBytes, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    try {
      const config = configuration(env);
      // No access code, provider URL, token or session ID in query strings/logs.
      if (req.url !== '/api/live' || req.headers.origin !== config.origin) throw Error();
      sockets.handleUpgrade(req, socket, head, client => relay(client, req, config));
    } catch {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n');
    }
  });
  return server;
}
export default createLiveServer();
