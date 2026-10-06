import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHandler } from '../api/ai.mjs';
import { configuration, authorize, readBody, reserve, RESERVE_SCRIPT, MAX_BODY_BYTES } from '../server/security.mjs';
import { operation, resultFor } from '../server/operations.mjs';

const env = { AI_ENABLED: 'true', APP_ORIGIN: 'https://example.test', GEMINI_API_KEY: 'test-provider-marker',
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-redis-marker', AI_DAILY_UNITS: '200', AI_LIFETIME_UNITS: '1000' };
const req = (body = { operation: 'summarize', conversation: 'hello' }, extra = {}) => ({ method: 'POST',
  headers: { origin: env.APP_ORIGIN, cookie: `__Host-sele-session=${'a'.repeat(43)}`, 'content-type': 'application/json' }, body, ...extra });
function response() {
  const res = new EventEmitter();
  Object.assign(res, { headers: {}, chunks: [], statusCode: 0, headersSent: false,
    setHeader(k,v) { this.headers[k] = v; }, flushHeaders() { this.headersSent = true; },
    write(s) { this.chunks.push(s); return true; }, end(s = '') { this.chunks.push(s); }, destroy() { this.destroyed = true; } });
  return res;
}
const provider = (text = 'scene') => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
function fetchMock({ reserveResult = 1, providerResult = provider(), failRedis = false } = {}) {
  const calls = [];
  return { calls, async fetch(url, init) {
    calls.push({ url, init });
    if (url === env.UPSTASH_REDIS_REST_URL) {
      if (failRedis) throw Error('private failure');
      const command = JSON.parse(init.body);
      return new Response(JSON.stringify({ result: command[0] === 'EVAL' ? reserveResult : 1 }));
    }
    if (providerResult instanceof Error) throw providerResult;
    return providerResult;
  } };
}

test('configuration fails closed, ignores legacy provider key, validates origin and budgets', () => {
  assert.throws(() => configuration({ ...env, GEMINI_API_KEY: '', API_KEY: 'legacy' }));
  for (const [key, value] of [['AI_ENABLED','false'], ['AI_DAILY_UNITS','201'], ['AI_LIFETIME_UNITS','Infinity'],
    ['APP_ORIGIN','https://example.test/path'], ['APP_ORIGIN','http://evil.test'], ['UPSTASH_REDIS_REST_URL','https://evil.test']]) {
    assert.throws(() => configuration({ ...env, [key]: value }), key);
  }
  assert.equal(configuration(env).daily, 200);
});
test('anonymous ownership requires exact Origin and an unambiguous cookie, not a code', () => {
  const config = configuration(env); assert.match(authorize(req(), config), /^[a-f0-9]{64}$/);
  const valid = `__Host-sele-session=${'a'.repeat(43)}`;
  for (const headers of [{ origin: env.APP_ORIGIN }, { origin: 'https://evil.test', cookie: valid },
    { cookie: valid }, { origin: 'null', cookie: valid },
    { origin: env.APP_ORIGIN, cookie: valid, 'sec-fetch-site': 'cross-site' },
    { origin: env.APP_ORIGIN, cookie: valid + '; ' + valid },
    { origin: env.APP_ORIGIN, cookie: '__Host-sele-session=wrong' },
    { origin: env.APP_ORIGIN, cookie: [valid] }]) {
    assert.throws(() => authorize({ headers }, config));
  }
});
test('bounded JSON supports platform parsed and streamed input', async () => {
  assert.equal((await readBody(req())).operation, 'summarize');
  await assert.rejects(readBody(req('x'.repeat(MAX_BODY_BYTES + 1))), e => e.status === 413);
  await assert.rejects(readBody(req('bad')), e => e.status === 400);
  await assert.rejects(readBody(req([], {})), e => e.status === 400);
  await assert.rejects(readBody(req({}, { headers: { 'content-type': 'text/plain' } })), e => e.status === 415);
  const stream = req(undefined); delete stream.body;
  stream[Symbol.asyncIterator] = async function* () { yield '{"operation":'; yield '"summarize"}'; };
  assert.equal((await readBody(stream)).operation, 'summarize');
});
test('method/auth/invalid payloads never reach quota or provider', async () => {
  for (const request of [req({}, { method: 'GET' }), req({}, { headers: { origin: env.APP_ORIGIN } }), req({ operation: 'unknown' }), req({ operation: 'summarize', conversation: 'x'.repeat(12001) })]) {
    const f = fetchMock(); const res = response(); await createHandler({ env, fetchImpl: f.fetch })(request,res);
    assert.ok(res.statusCode >= 400); assert.equal(f.calls.length,0); assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});
test('store failure/corruption/quota/concurrency fail closed without paid call', async () => {
  for (const options of [{ failRedis: true }, { reserveResult: -1 }, { reserveResult: 0 }, { reserveResult: 2 }, { reserveResult: '1' }]) {
    const f=fetchMock(options); const res=response(); await createHandler({env,fetchImpl:f.fetch})(req(),res);
    assert.ok(res.statusCode >= 400); assert.equal(f.calls.length,1);
  }
});
test('reservation precedes exactly one fixed provider call; no key URL or response', async () => {
  const f=fetchMock(); const res=response(); await createHandler({env,fetchImpl:f.fetch})(req(),res);
  assert.equal(res.statusCode,200); assert.deepEqual(JSON.parse(res.chunks.join('')), {result:'scene'});
  assert.equal(f.calls.length,3); assert.equal(JSON.parse(f.calls[0].init.body)[0],'EVAL');
  assert.match(f.calls[1].url,/^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/gemini-3-flash-preview:generateContent$/);
  assert.equal(f.calls[1].init.headers['x-goog-api-key'],env.GEMINI_API_KEY); assert.equal(f.calls[1].init.redirect,'error');
  assert.equal(JSON.parse(f.calls[1].init.body).generationConfig.candidateCount,1);
  assert.equal(res.headers['Transfer-Encoding'],'chunked');
});
test('ambiguous provider failure: no retry, refund, release, or secret details', async () => {
  for (const providerResult of [new Error('test-provider-marker'), new Response('test-provider-marker',{status:403})]) {
    const f=fetchMock({providerResult}); const res=response(); await createHandler({env,fetchImpl:f.fetch})(req(),res);
    assert.ok(res.statusCode >= 500); assert.equal(f.calls.length,2); assert.ok(!res.chunks.join('').includes(env.GEMINI_API_KEY));
  }
});
test('fixed models/options/costs: unsupported caller configuration cannot expand spend', () => {
  const op=operation({operation:'generate',prompt:'a cat',useProModel:true,resolution:'4K',aspectRatio:'16:9',model:'untrusted',maxOutputTokens:999999});
  assert.equal(op.model,'gemini-3-pro-image'); assert.equal(op.cost,160); assert.equal(op.payload.generationConfig.maxOutputTokens,8192);
  assert.equal(op.payload.generationConfig.candidateCount,1);
  for (const patch of [{useProModel:'yes'}, {resolution:'8K'}, {aspectRatio:'100:1'}, {characterContext:Array(4).fill({})}, {prompt:'x'.repeat(6001)}]) {
    assert.throws(() => operation({operation:'generate',prompt:'x',useProModel:false,...patch}));
  }
  assert.throws(() => operation({operation:'edit',prompt:'x',useProModel:false,imageBase64:Buffer.from('not image').toString('base64'),mimeType:'image/png'}));
});
test('guide schema rejects malformed nested data', () => {
  const op={kind:'analyze'};
  assert.throws(() => resultFor(op,{candidates:[{content:{parts:[{text:JSON.stringify({characterName:'x',title:'x',description:'x',stats:[null],items:[]})}]}}]}));
});
test('quota script has non-expiring ledger, server clock, and atomic all-budget reservation', () => {
  assert.match(RESERVE_SCRIPT,/redis.call\('TIME'\)/); assert.match(RESERVE_SCRIPT,/TTL.*~= -1/);
  assert.match(RESERVE_SCRIPT,/total \+ cost > lifetimeLimit or daily \+ cost > dailyLimit/);
  assert.ok(RESERVE_SCRIPT.indexOf('ZCARD') < RESERVE_SCRIPT.indexOf("'HSET'"));
});
test('reserve rejects nonnumeric/unknown result', async () => {
  for (const result of [null, {}, '1', -1]) {
    await assert.rejects(reserve(configuration(env),1,async()=>new Response(JSON.stringify({result}))));
  }
});
