import { configuration, authorize, readBody, reserve, release, HttpError, PROVIDER_TIMEOUT_MS } from '../server/security.mjs';
import { operation, resultFor } from '../server/operations.mjs';

// Vercel Node.js function. No provider credential or SDK belongs in the browser.
export const maxDuration = 120;
export function createHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'POSTで送信してください。' }); }
    try {
      const config = configuration(env);
      authorize(req, config);
      const op = operation(await readBody(req));
      const lease = await reserve(config, op.cost, fetchImpl);
      // Exactly one provider attempt per irreversible reservation; no retries.
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${op.model}:generateContent`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey }, body: JSON.stringify(op.payload),
      });
      if (!response.ok) throw new HttpError(502, 'AIサーバーが応答できませんでした。時間をおいてお試しください。');
      // Bound response buffering (including malicious/oversized provider output).
      const reader = response.body.getReader();
      const chunks = []; let bytes = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 32_000_000) { await reader.cancel(); throw new HttpError(502, '生成された画像が大きすぎます。解像度を下げてください。'); }
        chunks.push(Buffer.from(value));
      }
      const result = resultFor(op, JSON.parse(Buffer.concat(chunks).toString('utf8')));
      // A failed release cannot open the gate; the short-lived lease expires.
      try { await release(config, lease, fetchImpl); } catch { /* fail closed until expiry */ }
      // Explicit streaming avoids the platform's buffered 4.5 MB response cap.
      // Bound the total first, then write chunks with backpressure.
      res.statusCode = 200;
      res.setHeader('Transfer-Encoding', 'chunked');
      res.flushHeaders();
      const payload = JSON.stringify({ result });
      for (let i = 0; i < payload.length; i += 65536) {
        if (!res.write(payload.slice(i, i + 65536))) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => { cleanup(); reject(new Error('slow client')); }, 5000);
            const drained = () => { cleanup(); resolve(); };
            const closed = () => { cleanup(); reject(new Error('closed')); };
            const cleanup = () => { clearTimeout(timer); res.off('drain', drained); res.off('close', closed); };
            res.once('drain', drained); res.once('close', closed);
          });
        }
      }
      return res.end();
    } catch (error) {
      // Never return/log upstream bodies, URLs, configuration or credentials.
      if (res.headersSent) { res.destroy(); return; }
      return send(error instanceof HttpError ? error.status : 503,
        { error: error instanceof HttpError ? error.message : 'AI機能は現在利用できません。少し待ってからお試しください。' });
    }
  };
}
export default createHandler();
