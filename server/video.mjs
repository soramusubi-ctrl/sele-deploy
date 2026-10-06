import { createHash, randomUUID } from 'node:crypto';
import { HttpError, redisCommand } from './security.mjs';

// REST shapes: https://ai.google.dev/gemini-api/docs/veo
export const VIDEO_MODEL = 'veo-3.1-lite-generate-preview';
export const VIDEO_UNITS = 160;
export const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const BASE = 'https://generativelanguage.googleapis.com';
const LEDGER = 'sele:{ai}:budget', LEASES = 'sele:{ai}:leases', ACTIVE = 'sele:{ai}:video:active';
const jobKey = id => `sele:{ai}:video:job:${id}`;
const hash = value => createHash('sha256').update(value).digest('hex');
const ownerFor = config => hash(config.accessCode);
const unavailable = () => new HttpError(503, '動画の状態を確認できません。自動で再生成せず、管理者に確認してください。');
const bad = () => { throw new HttpError(400, '動画の入力形式を確認してください。'); };
const jobIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// One transaction creates the idempotency marker, charges the existing lifetime
// ledger, and records an uncertain job BEFORE any provider attempt. Missing or
// evicted ledger fails closed. Idempotency tombstones live in that same
// non-expiring ledger (at most 12 jobs at the maximum lifetime budget), so a job
// expiring cannot reopen creation. Never refund a timeout or retry a create attempt.
export const VIDEO_CREATE_SCRIPT = `
local prior = redis.call('HMGET', KEYS[1], ARGV[7] .. ':id', ARGV[7] .. ':fingerprint')
if prior[1] then
  if prior[2] ~= ARGV[5] then return {-2} end
  return {2, prior[1]}
end
local now = tonumber(redis.call('TIME')[1])
local day = math.floor(now / 86400)
local v = redis.call('HMGET', KEYS[1], 'total', 'day', 'daily')
local total, savedDay, daily = tonumber(v[1]), tonumber(v[2]), tonumber(v[3])
if not total or not savedDay or not daily or total < 0 or daily < 0 or total < daily or savedDay > day or redis.call('TTL', KEYS[1]) ~= -1 then return {-1} end
if savedDay < day then daily = 0 end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
if redis.call('ZCARD', KEYS[2]) >= 2 or redis.call('ZCARD', KEYS[3]) >= 2 then return {3} end
local cost = tonumber(ARGV[3])
if total + cost > tonumber(ARGV[1]) or daily + cost > tonumber(ARGV[2]) then return {0} end
redis.call('HSET', KEYS[1], 'total', total + cost, 'day', day, 'daily', daily + cost, ARGV[7] .. ':id', ARGV[6], ARGV[7] .. ':fingerprint', ARGV[5])
redis.call('HSET', KEYS[4], 'owner', ARGV[4], 'state', 'uncertain', 'created', now, 'deadline', now + 1200, 'polls', 0, 'lastPoll', 0, 'pollUntil', 0, 'downloads', 0, 'lastDownload', 0)
redis.call('EXPIRE', KEYS[4], 3600)
redis.call('ZADD', KEYS[2], now + 1200, ARGV[6])
redis.call('PERSIST', KEYS[2])
redis.call('ZADD', KEYS[3], now + 1200, ARGV[6])
redis.call('EXPIRE', KEYS[3], 1260)
return {1, ARGV[6]}
`;

export const VIDEO_STARTED_SCRIPT = `
if redis.call('HGET', KEYS[1], 'owner') ~= ARGV[1] or redis.call('HGET', KEYS[1], 'state') ~= 'uncertain' or redis.call('TTL', KEYS[1]) <= 0 then return 0 end
redis.call('HSET', KEYS[1], 'state', 'pending', 'operation', ARGV[2])
return 1
`;

// The poll lease prevents overlapping requests and stale status overwrites across
// instances. Every upstream poll is counted, including failed upstream requests.
export const VIDEO_POLL_SCRIPT = `
if redis.call('HGET', KEYS[1], 'owner') ~= ARGV[1] or redis.call('TTL', KEYS[1]) <= 0 then return {-1} end
local state = redis.call('HGET', KEYS[1], 'state')
if state ~= 'pending' then return {0, state} end
local now = tonumber(redis.call('TIME')[1])
local v = redis.call('HMGET', KEYS[1], 'deadline', 'polls', 'lastPoll', 'pollUntil', 'operation')
local deadline, polls, lastPoll, pollUntil = tonumber(v[1]), tonumber(v[2]), tonumber(v[3]), tonumber(v[4])
if not deadline or not polls or not lastPoll or not pollUntil or not v[5] then return {-2} end
if now >= deadline or polls >= 90 then
  redis.call('HSET', KEYS[1], 'state', 'expired')
  redis.call('ZREM', KEYS[2], ARGV[3])
  redis.call('ZREM', KEYS[3], ARGV[3])
  return {0, 'expired'}
end
if now < pollUntil or now - lastPoll < 10 then return {0, 'pending'} end
redis.call('HSET', KEYS[1], 'polls', polls + 1, 'lastPoll', now, 'pollUntil', now + 35, 'pollToken', ARGV[2])
return {1, v[5]}
`;
export const VIDEO_FINISH_POLL_SCRIPT = `
if redis.call('HGET', KEYS[1], 'owner') ~= ARGV[1] or redis.call('HGET', KEYS[1], 'state') ~= 'pending' or redis.call('HGET', KEYS[1], 'pollToken') ~= ARGV[2] or redis.call('TTL', KEYS[1]) <= 0 then return 0 end
redis.call('HSET', KEYS[1], 'state', ARGV[3], 'pollUntil', 0)
if ARGV[3] == 'ready' then redis.call('HSET', KEYS[1], 'uri', ARGV[4]) end
if ARGV[3] ~= 'pending' then
  redis.call('ZREM', KEYS[2], ARGV[5])
  redis.call('ZREM', KEYS[3], ARGV[5])
end
return 1
`;
export const VIDEO_DOWNLOAD_SCRIPT = `
if redis.call('HGET', KEYS[1], 'owner') ~= ARGV[1] or redis.call('TTL', KEYS[1]) <= 0 then return {-1} end
if redis.call('HGET', KEYS[1], 'state') ~= 'ready' then return {0} end
local v = redis.call('HMGET', KEYS[1], 'downloads', 'lastDownload', 'uri')
local count, last = tonumber(v[1]), tonumber(v[2])
if not count or not last or not v[3] then return {-2} end
local now = tonumber(redis.call('TIME')[1])
if count >= 3 or now - last < 10 then return {2} end
redis.call('HSET', KEYS[1], 'downloads', count + 1, 'lastDownload', now)
return {1, v[3]}
`;

function exactKeys(body, allowed) {
  if (Object.keys(body).some(key => !allowed.includes(key))) bad();
}
export function videoInput(body) {
  if (body.action !== 'create') {
    exactKeys(body, ['action', 'jobId']);
    if (!['status', 'download'].includes(body.action) || !jobIdPattern.test(body.jobId || '')) bad();
    return body;
  }
  exactKeys(body, ['action', 'requestId', 'prompt', 'imageBase64', 'mimeType', 'aspectRatio']);
  if (!jobIdPattern.test(body.requestId || '') || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 3000 || !['16:9', '9:16'].includes(body.aspectRatio)) bad();
  const data = body.imageBase64, mime = body.mimeType;
  if (typeof data !== 'string' || data.length > 1_398_104) throw new HttpError(413, '動画の元画像は1MiB以下にしてください。画像を小さく保存してから選び直してください。');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime) || data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) bad();
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > 1_048_576 || bytes.toString('base64') !== data) bad();
  const valid = mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) bad();
  return { ...body, prompt: body.prompt.trim() };
}
export function operationName(value) {
  const prefix = `models/${VIDEO_MODEL}/operations/`;
  if (typeof value !== 'string' || !value.startsWith(prefix) || !/^[A-Za-z0-9_-]{1,128}$/.test(value.slice(prefix.length))) throw unavailable();
  return value;
}
export function downloadUrl(value) {
  // No URLs from the caller, wildcard hosts, embedded credentials, redirects,
  // fragments, ports, encoded paths, arbitrary query parameters, or API keys.
  if (typeof value !== 'string' || value.length > 512 || !/^https:\/\/generativelanguage\.googleapis\.com\/(?:download\/)?v1beta\/files\/[A-Za-z0-9_-]{1,128}:download\?alt=media$/.test(value)) throw unavailable();
  return value;
}
async function providerJson(url, config, fetchImpl, payload) {
  const response = await fetchImpl(url, { method: payload ? 'POST' : 'GET', redirect: 'error',
    headers: { 'x-goog-api-key': config.apiKey, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(25000) });
  if (!response.ok || !response.body) throw unavailable();
  const reader = response.body.getReader(); let length = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 65536) throw unavailable();
      chunks.push(Buffer.from(value));
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw unavailable();
    return result;
  } catch { await reader.cancel().catch(() => {}); throw unavailable(); }
}
const evalScript = (config, fetchImpl, script, keys, args) => redisCommand(config,
  ['EVAL', script, String(keys.length), ...keys, ...args.map(String)], fetchImpl);
const publicState = (jobId, status) => {
  if (!['pending', 'ready', 'uncertain', 'failed', 'expired'].includes(status)) throw unavailable();
  return { jobId, status, retryAfterMs: 10000 };
};

export async function createVideo(input, config, fetchImpl) {
  const owner = ownerFor(config), id = randomUUID();
  const fingerprint = hash(JSON.stringify([input.prompt, input.imageBase64, input.mimeType, input.aspectRatio]));
  const result = await evalScript(config, fetchImpl, VIDEO_CREATE_SCRIPT,
    [LEDGER, LEASES, ACTIVE, jobKey(id)],
    [config.lifetime, config.daily, VIDEO_UNITS, owner, fingerprint, id, `video:${owner}:${input.requestId}`]);
  if (!Array.isArray(result)) throw unavailable();
  if (result[0] === -2) throw new HttpError(409, '同じ受付番号で入力は変更できません。');
  if (result[0] === 0 || result[0] === 3) throw new HttpError(429, '動画の利用上限に達したか、ほかの動画を生成中です。管理者に確認してください。');
  if (result[0] === 2) {
    if (!jobIdPattern.test(result[1])) throw unavailable();
    // Never retry provider creation, even when an earlier process died before it.
    return { jobId: result[1], status: 'pending', retryAfterMs: 10000 };
  }
  if (result[0] !== 1) throw unavailable();
  try {
    const generated = await providerJson(`${BASE}/v1beta/models/${VIDEO_MODEL}:predictLongRunning`, config, fetchImpl, {
      instances: [{ prompt: input.prompt, image: { bytesBase64Encoded: input.imageBase64, mimeType: input.mimeType } }],
      parameters: { sampleCount: 1, resolution: '720p', durationSeconds: 8, aspectRatio: input.aspectRatio },
    });
    const operation = operationName(generated.name);
    const saved = await evalScript(config, fetchImpl, VIDEO_STARTED_SCRIPT, [jobKey(id), LEASES], [owner, operation, id]);
    if (saved !== 1) throw unavailable();
    return publicState(id, 'pending');
  } catch {
    // Includes provider timeouts and uncertain persistence. Keeping the marker and
    // original charge is safer than issuing a duplicate billable generation.
    return publicState(id, 'uncertain');
  }
}
export async function pollVideo(id, config, fetchImpl) {
  const token = randomUUID(), owner = ownerFor(config);
  const claim = await evalScript(config, fetchImpl, VIDEO_POLL_SCRIPT, [jobKey(id), ACTIVE, LEASES], [owner, token, id]);
  if (!Array.isArray(claim)) throw unavailable();
  if (claim[0] === -1) throw new HttpError(404, '動画が見つからないか、有効期限が切れています。');
  if (claim[0] === 0) return publicState(id, claim[1]);
  if (claim[0] !== 1) throw unavailable();
  let state = 'pending', uri = '';
  try {
    const result = await providerJson(`${BASE}/v1beta/${operationName(claim[1])}`, config, fetchImpl);
    if (result.error) state = 'failed';
    else if (result.done === true) {
      state = 'failed';
      const videos = result.response?.generateVideoResponse?.generatedSamples;
      if (!Array.isArray(videos) || videos.length !== 1) state = 'failed';
      else { uri = downloadUrl(videos[0]?.video?.uri); state = 'ready'; }
    }
  } catch { /* Read-only polling may resume; it never creates another job. */ }
  const saved = await evalScript(config, fetchImpl, VIDEO_FINISH_POLL_SCRIPT, [jobKey(id), ACTIVE, LEASES], [owner, token, state, uri, id]);
  if (saved !== 1) return publicState(id, 'pending'); // A newer claim owns the state.
  return publicState(id, state);
}
export async function downloadVideo(id, config, fetchImpl) {
  const claim = await evalScript(config, fetchImpl, VIDEO_DOWNLOAD_SCRIPT, [jobKey(id)], [ownerFor(config)]);
  if (!Array.isArray(claim)) throw unavailable();
  if (claim[0] === -1) throw new HttpError(404, '動画が見つからないか、有効期限が切れています。');
  if (claim[0] === 0) throw new HttpError(409, '動画はまだダウンロードできません。');
  if (claim[0] === 2) throw new HttpError(429, '動画の取得回数が上限に達したか、取得中です。');
  if (claim[0] !== 1) throw unavailable();
  const response = await fetchImpl(downloadUrl(claim[1]), { method: 'GET', redirect: 'error',
    headers: { 'x-goog-api-key': config.apiKey }, signal: AbortSignal.timeout(45000) });
  if (!response.ok || !response.body || !/^video\/mp4(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > MAX_VIDEO_BYTES) throw unavailable();
  return response;
}
