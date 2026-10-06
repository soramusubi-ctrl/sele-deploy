import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createVideoHandler } from '../api/video.mjs';
import { VIDEO_MODEL, VIDEO_UNITS, VIDEO_CREATE_SCRIPT, VIDEO_STARTED_SCRIPT, VIDEO_POLL_SCRIPT,
  VIDEO_FINISH_POLL_SCRIPT, VIDEO_DOWNLOAD_SCRIPT, videoInput, operationName, downloadUrl } from '../server/video.mjs';

const env = { AI_ENABLED: 'true', APP_ORIGIN: 'https://example.test', GEMINI_API_KEY: 'fake-video-provider-marker',
  APP_ACCESS_CODE: 'a'.repeat(43), UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'fake-redis-marker', AI_DAILY_UNITS: '200', AI_LIFETIME_UNITS: '1000' };
const input = () => ({ action: 'create', requestId: randomUUID(), prompt: 'Wind moves the tree.',
  imageBase64: Buffer.from([137,80,78,71,13,10,26,10]).toString('base64'), mimeType: 'image/png', aspectRatio: '16:9' });
const request = (body, code = env.APP_ACCESS_CODE) => ({ method: 'POST', headers: {
  origin: env.APP_ORIGIN, authorization: `Bearer ${code}`, 'content-type': 'application/json' }, body });
function response() {
  const res = new EventEmitter();
  Object.assign(res, { headers: {}, chunks: [], statusCode: 0, headersSent: false,
    setHeader(key,value) { this.headers[key] = value; },
    write(chunk) { this.headersSent = true; this.chunks.push(Buffer.from(chunk)); return true; },
    end(chunk = '') { this.chunks.push(Buffer.from(chunk)); }, destroy() { this.destroyed = true; } });
  return res;
}
const result = res => JSON.parse(Buffer.concat(res.chunks).toString());
const OPERATION = `models/${VIDEO_MODEL}/operations/opaque-provider-op`;
const URI = 'https://generativelanguage.googleapis.com/v1beta/files/opaque-file:download?alt=media';
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

// The mocked REST store below exercises handler ordering, persistence failures,
// and no-retry behavior. Real Lua semantics have a separate local Redis test.
function harness({ createFailure = false, startSaveFailure = false, missingLedger = false, readyUri = URI, downloadRedirect = false } = {}) {
  const jobs = new Map(), requests = new Map(), calls = [];
  let total = 0, providerCreates = 0, providerPolls = 0, providerDownloads = 0, now = 1000;
  const state = { jobs, requests, calls, advance(seconds = 10) { now += seconds; }, get total() { return total; },
    get providerCreates() { return providerCreates; }, get providerPolls() { return providerPolls; }, get providerDownloads() { return providerDownloads; } };
  state.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === env.UPSTASH_REDIS_REST_URL) {
      const command = JSON.parse(options.body);
      assert.equal(command[0], 'EVAL');
      const script = command[1], count = Number(command[2]), keys = command.slice(3, 3 + count), args = command.slice(3 + count);
      let answer;
      if (script === VIDEO_CREATE_SCRIPT) {
        const prior = requests.get(args[6]);
        if (prior) answer = prior.fingerprint !== args[4] ? [-2] : [2, prior.id];
        else if (missingLedger) answer = [-1];
        else if (total + VIDEO_UNITS > Number(args[1])) answer = [0];
        else {
          total += VIDEO_UNITS;
          requests.set(args[6], { id: args[5], fingerprint: args[4] });
          jobs.set(keys[3], { owner: args[3], state: 'uncertain', polls: 0, downloads: 0, lastPoll: 0, lastDownload: 0 });
          answer = [1, args[5]];
        }
      } else if (script === VIDEO_STARTED_SCRIPT) {
        if (startSaveFailure) throw Error('private persistence failure');
        const job = jobs.get(keys[0]);
        Object.assign(job, { state: 'pending', operation: args[1] }); answer = 1;
      } else if (script === VIDEO_POLL_SCRIPT) {
        const job = jobs.get(keys[0]);
        if (!job || job.owner !== args[0]) answer = [-1];
        else if (job.state !== 'pending') answer = [0, job.state];
        else if (job.polls >= 90) { job.state = 'expired'; answer = [0, 'expired']; }
        else if (now - job.lastPoll < 10) answer = [0, 'pending'];
        else { job.polls++; job.lastPoll = now; job.token = args[1]; answer = [1, job.operation]; }
      } else if (script === VIDEO_FINISH_POLL_SCRIPT) {
        const job = jobs.get(keys[0]);
        if (job?.owner !== args[0] || job.token !== args[1]) answer = 0;
        else { Object.assign(job, { state: args[2], uri: args[3] }); answer = 1; }
      } else if (script === VIDEO_DOWNLOAD_SCRIPT) {
        const job = jobs.get(keys[0]);
        if (!job || job.owner !== args[0]) answer = [-1];
        else if (job.state !== 'ready') answer = [0];
        else if (job.downloads >= 3 || now - job.lastDownload < 10) answer = [2];
        else { job.downloads++; job.lastDownload = now; answer = [1, job.uri]; }
      } else throw Error('unexpected script');
      return json({ result: answer });
    }
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
    assert.ok(!url.includes(env.GEMINI_API_KEY));
    if (url.endsWith(':predictLongRunning')) {
      providerCreates++;
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.parameters, { sampleCount: 1, resolution: '720p', durationSeconds: 8, aspectRatio: '16:9' });
      assert.ok([...jobs.values()].some(job => job.state === 'uncertain'), 'durable marker exists before provider call');
      if (createFailure) throw Error(`private upstream failure ${env.GEMINI_API_KEY}`);
      return json({ name: OPERATION });
    }
    if (url.endsWith('/opaque-provider-op')) {
      providerPolls++;
      return json({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: readyUri } }] } } });
    }
    if (url === URI) {
      providerDownloads++;
      if (downloadRedirect) return Response.redirect('https://evil.test/collect', 302);
      return new Response(Buffer.from('fake-mp4-video'), { headers: { 'Content-Type': 'video/mp4' } });
    }
    throw Error(`unexpected URL ${url}`);
  };
  state.call = async (body, customEnv = env, code = customEnv.APP_ACCESS_CODE) => {
    const res = response();
    await createVideoHandler({ env: customEnv, fetchImpl: state.fetch })(request(body, code), res);
    return res;
  };
  return state;
}

test('video requires access code/origin before store/provider and rejects arbitrary caller fields', async () => {
  const h = harness();
  assert.equal((await h.call(input(), env, 'wrong')).statusCode, 401);
  const res = response(), req = request(input()); req.headers.origin = 'https://evil.test';
  await createVideoHandler({ env, fetchImpl: h.fetch })(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal((await h.call({ ...input(), uri: URI })).statusCode, 400);
  assert.equal((await h.call({ action: 'status', jobId: randomUUID(), operation: OPERATION })).statusCode, 400);
  assert.equal(h.calls.length, 0);
});
test('strict model/operation/download allowlists reject SSRF and key-bearing variants', () => {
  assert.equal(operationName(OPERATION), OPERATION);
  assert.equal(downloadUrl(URI), URI);
  for (const name of ['operations/123', OPERATION + '?key=x', OPERATION.replace('veo-3.1', 'veo-3x1'), OPERATION + '/../other']) assert.throws(() => operationName(name));
  for (const url of [URI.replace('https:', 'http:'), URI.replace('.com/', '.com.evil.test/'), URI + '&key=secret', URI + '#x', URI.replace('/files/', '/files/%2f'), URI.replace('.com/', '.com:443/'), URI.replace('generativelanguage', 'evil@generativelanguage')]) assert.throws(() => downloadUrl(url));
  assert.throws(() => videoInput({ ...input(), imageBase64: 'A'.repeat(1_500_000) }), error => error.status === 413);
  assert.throws(() => videoInput({ ...input(), model: 'expensive-model' }));
});
test('durable idempotency handles concurrent duplicate create and changed payload without recharging', async () => {
  const h = harness(), body = input();
  const responses = await Promise.all(Array.from({ length: 10 }, () => h.call(body)));
  const ids = responses.map(res => result(res).jobId);
  assert.equal(new Set(ids).size, 1); assert.equal(h.providerCreates, 1); assert.equal(h.total, VIDEO_UNITS);
  assert.equal((await h.call({ ...body, prompt: 'Different prompt' })).statusCode, 409);
  assert.equal(h.providerCreates, 1);
});
test('provider uncertainty and post-provider persistence failure never retry creation', async () => {
  for (const setting of [{ createFailure: true }, { startSaveFailure: true }]) {
    const h = harness(setting), body = input(), first = result(await h.call(body));
    assert.equal(first.status, 'uncertain');
    await h.call(body);
    assert.equal(result(await h.call({ action: 'status', jobId: first.jobId })).status, 'uncertain');
    assert.equal(h.providerCreates, 1); assert.equal(h.total, VIDEO_UNITS);
    assert.ok(!JSON.stringify(first).includes(env.GEMINI_API_KEY));
  }
});
test('missing ledger and quota exhaustion make zero extra provider creates', async () => {
  const missing = harness({ missingLedger: true });
  assert.equal((await missing.call(input())).statusCode, 503); assert.equal(missing.providerCreates, 0);
  const h = harness(); await h.call(input());
  assert.equal((await h.call(input())).statusCode, 429); assert.equal(h.providerCreates, 1);
});
test('job ownership survives instances and changed access codes cannot poll/download another code jobs', async () => {
  const h = harness(), job = result(await h.call(input()));
  const other = { ...env, APP_ACCESS_CODE: 'b'.repeat(43) };
  for (const action of ['status', 'download']) assert.equal((await h.call({ action, jobId: job.jobId }, other)).statusCode, 404);
  assert.equal(h.providerPolls, 0); assert.equal(h.providerDownloads, 0);
  assert.equal(result(await h.call({ action: 'status', jobId: job.jobId })).status, 'ready');
});
test('provider operation and URI remain private, final MP4 is bounded to three downloads', async () => {
  const h = harness(), job = result(await h.call(input()));
  const status = result(await h.call({ action: 'status', jobId: job.jobId }));
  assert.equal(status.status, 'ready');
  assert.ok(!JSON.stringify(status).includes(OPERATION)); assert.ok(!JSON.stringify(status).includes(URI));
  for (let i = 0; i < 3; i++) {
    h.advance(); const res = await h.call({ action: 'download', jobId: job.jobId });
    assert.equal(res.statusCode, 200); assert.equal(res.headers['Content-Type'], 'video/mp4');
    assert.equal(Buffer.concat(res.chunks).toString(), 'fake-mp4-video');
  }
  h.advance(); assert.equal((await h.call({ action: 'download', jobId: job.jobId })).statusCode, 429);
  assert.equal(h.providerDownloads, 3);
});
test('untrusted completion URI fails closed and redirects are not followed with credentials', async () => {
  const h = harness({ readyUri: 'https://evil.test/video.mp4' });
  const job = result(await h.call(input()));
  assert.equal(result(await h.call({ action: 'status', jobId: job.jobId })).status, 'failed');
  assert.equal((await h.call({ action: 'download', jobId: job.jobId })).statusCode, 409);
  assert.equal(h.providerDownloads, 0);
  const redirect = harness({ downloadRedirect: true });
  const next = result(await redirect.call(input())); await redirect.call({ action: 'status', jobId: next.jobId });
  assert.equal((await redirect.call({ action: 'download', jobId: next.jobId })).statusCode, 503);
  assert.ok(redirect.calls.every(call => !call.url.startsWith('https://evil.test')));
});
test('expired job cannot be recreated by replaying its original idempotency key', async () => {
  const h = harness(), body = input(), job = result(await h.call(body));
  h.jobs.clear();
  assert.equal(result(await h.call(body)).jobId, job.jobId);
  assert.equal((await h.call({ action: 'status', jobId: job.jobId })).statusCode, 404);
  assert.equal(h.providerCreates, 1);
});
