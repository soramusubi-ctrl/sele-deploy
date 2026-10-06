import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';

export const MAX_BODY_BYTES = 3_000_000;
export const PROVIDER_TIMEOUT_MS = 55_000;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const unavailable = () => new HttpError(503, 'AI機能は現在利用できません。管理者に設定を確認してください。');
export function configuration(env) {
  const origin = env.APP_ORIGIN;
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  try {
    const app = new URL(origin);
    const redis = new URL(redisUrl);
    if (app.origin !== origin || app.username || app.password ||
      (app.protocol !== 'https:' && !(app.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(app.hostname)))) throw Error();
    if (redis.protocol !== 'https:' || !redis.hostname.endsWith('.upstash.io') || redis.username || redis.password || redis.search || redis.hash || redis.pathname !== '/') throw Error();
  } catch { throw unavailable(); }
  // Configuration is server-only. Do not read legacy API_KEY or any VITE_* variable.
  if (env.AI_ENABLED !== 'true' || !env.GEMINI_API_KEY || !env.UPSTASH_REDIS_REST_TOKEN ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(env.APP_ACCESS_CODE || '')) throw unavailable();
  const daily = Number(env.AI_DAILY_UNITS), lifetime = Number(env.AI_LIFETIME_UNITS);
  if (!Number.isInteger(daily) || daily < 1 || daily > 200 ||
      !Number.isInteger(lifetime) || lifetime < daily || lifetime > 2000) throw unavailable();
  return { origin, redisUrl, redisToken: env.UPSTASH_REDIS_REST_TOKEN,
    apiKey: env.GEMINI_API_KEY, accessCode: env.APP_ACCESS_CODE, daily, lifetime };
}
export function authorize(req, config) {
  // Origin is CSRF defense in depth, never a substitute for the access code.
  if (req.headers.origin !== config.origin) throw new HttpError(403, 'この接続元からは利用できません。');
  const supplied = req.headers.authorization;
  const expected = `Bearer ${config.accessCode}`;
  if (typeof supplied !== 'string' || supplied.length > 160 || !timingSafeEqual(
    createHash('sha256').update(supplied || '').digest(), createHash('sha256').update(expected).digest())) {
    throw new HttpError(401, '利用コードを確認してください。');
  }
}
export async function readBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'JSON形式で送信してください。');
  const length = Number(req.headers['content-length']);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, '画像や文章のサイズを小さくしてください。');
  let text = '';
  // Vercel can parse req.body before invoking the handler; still enforce the byte cap.
  if (req.body !== undefined) text = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  else {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of req) {
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_BODY_BYTES) throw new HttpError(413, '画像や文章のサイズを小さくしてください。');
      chunks.push(Buffer.from(chunk));
    }
    text = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new HttpError(413, '画像や文章のサイズを小さくしてください。');
  try { const body = JSON.parse(text); if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error(); return body; }
  catch { throw new HttpError(400, 'リクエストが正しくありません。'); }
}

// One non-expiring ledger, deliberately NOT automatically created. A missing/corrupt
// ledger fails closed (including eviction/flush). Seed explicitly before enabling AI.
// Redis TIME prevents clock skew between serverless instances and clients.
export const RESERVE_SCRIPT = `
local dailyLimit = tonumber(ARGV[1])
local lifetimeLimit = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(redis.call('TIME')[1])
local day = math.floor(now / 86400)
local values = redis.call('HMGET', KEYS[1], 'total', 'day', 'daily')
local total = tonumber(values[1])
local savedDay = tonumber(values[2])
local daily = tonumber(values[3])
if not total or not savedDay or not daily or total < 0 or daily < 0 or total < daily then return -1 end
if redis.call('TTL', KEYS[1]) ~= -1 then return -1 end
if savedDay > day then return -1 end
if savedDay < day then daily = 0 end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if redis.call('ZCARD', KEYS[2]) >= 2 then return 2 end
if total + cost > lifetimeLimit or daily + cost > dailyLimit then return 0 end
redis.call('HSET', KEYS[1], 'total', total + cost, 'day', day, 'daily', daily + cost)
redis.call('ZADD', KEYS[2], now + 120, ARGV[4])
redis.call('PERSIST', KEYS[2])
return 1
`;
const LEDGER = 'sele:{ai}:budget';
const LEASES = 'sele:{ai}:leases';
export async function redisCommand(config, command, fetchImpl = fetch) {
  const response = await fetchImpl(config.redisUrl, { method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${config.redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw unavailable();
  const result = await response.json();
  if (result.error || !Object.hasOwn(result, 'result')) throw unavailable();
  return result.result;
}
export async function reserve(config, cost, fetchImpl = fetch) {
  const id = randomUUID();
  const result = await redisCommand(config, ['EVAL', RESERVE_SCRIPT, '2', LEDGER, LEASES,
    String(config.daily), String(config.lifetime), String(cost), id], fetchImpl);
  if (result === 0) throw new HttpError(429, 'サーバーの利用上限に達しました。管理者に確認してください。');
  if (result === 2) throw new HttpError(429, '生成が混み合っています。少し待ってからお試しください。');
  if (result !== 1) throw unavailable();
  return id;
}
export async function release(config, id, fetchImpl = fetch) {
  // Never refund spend. On failure/timeouts retain the lease until expiry.
  await redisCommand(config, ['ZREM', LEASES, id], fetchImpl);
}
