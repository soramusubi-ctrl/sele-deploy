import { once } from 'node:events';
import { configuration, authorize, readBody, HttpError } from '../server/security.mjs';
import { videoInput, createVideo, pollVideo, downloadVideo, MAX_VIDEO_BYTES } from '../server/video.mjs';

// All methods require the application access code. No provider URLs or keys leave
// this server. MP4 is streamed through this endpoint and becomes a browser blob.
export const maxDuration = 120;
export function createVideoHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (status, body) => {
      res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'POSTで送信してください。' }); }
    try {
      const config = configuration(env);
      authorize(req, config);
      const input = videoInput(await readBody(req));
      if (input.action === 'create') return send(200, await createVideo(input, config, fetchImpl));
      if (input.action === 'status') return send(200, await pollVideo(input.jobId, config, fetchImpl));
      const upstream = await downloadVideo(input.jobId, config, fetchImpl);
      const reader = upstream.body.getReader(); let bytes = 0;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="quiet-atelier-video.mp4"');
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_VIDEO_BYTES) throw new Error('video-size-limit');
          if (!res.write(Buffer.from(value))) await once(res, 'drain', { signal: AbortSignal.timeout(10000) });
        }
        if (!bytes) throw new Error('empty-video');
        res.end();
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    } catch (error) {
      // Never serialize upstream errors, headers, URLs, keys, or stack traces.
      if (res.headersSent) { res.destroy(); return; }
      return send(error instanceof HttpError ? error.status : 503,
        { error: error instanceof HttpError ? error.message : '動画を取得できません。自動で再生成せず、少し待ってから状態を確認してください。' });
    }
  };
}
export default createVideoHandler();
