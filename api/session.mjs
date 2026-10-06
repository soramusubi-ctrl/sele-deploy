import { configuration, sameOrigin, anonymousSession, readBody, HttpError } from '../server/security.mjs';

// No paid call, provider token, account or persistent server-side session record.
// The opaque cookie only keeps a browser's video jobs private from other browsers.
export function createSessionHandler({ env = process.env } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'POSTで送信してください。' }); }
    try {
      const config = configuration(env);
      sameOrigin(req, config);
      const body = await readBody(req);
      if (Object.keys(body).length) throw new HttpError(400, 'リクエストが正しくありません。');
      anonymousSession(req, res, config);
      return send(200, { ready: true });
    } catch (error) {
      return send(error instanceof HttpError ? error.status : 503,
        { error: error instanceof HttpError ? error.message : 'AI機能は現在利用できません。管理者に設定を確認してください。' });
    }
  };
}
export default createSessionHandler();
