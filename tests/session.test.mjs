import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionHandler } from '../api/session.mjs';
import { authorize, configuration } from '../server/security.mjs';

const env = { AI_ENABLED: 'true', APP_ORIGIN: 'https://example.test', GEMINI_API_KEY: 'fake-server-key',
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'fake-store-key',
  AI_DAILY_UNITS: '200', AI_LIFETIME_UNITS: '2000' };
const req = (headers = {}) => ({ method: 'POST', headers: {
  origin: env.APP_ORIGIN, 'content-type': 'application/json', ...headers }, body: {} });
async function call(request = req(), options = env) {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.body = JSON.parse(value); } };
  await createSessionHandler({ env: options })(request, res);
  return res;
}
test('automatic bootstrap needs no code; emits only a secure private anonymous cookie', async () => {
  const first = await call(), second = await call();
  assert.equal(first.statusCode, 200); assert.deepEqual(first.body, { ready: true });
  assert.match(first.headers['Set-Cookie'], /^__Host-sele-session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=86400; Secure$/);
  assert.notEqual(first.headers['Set-Cookie'], second.headers['Set-Cookie']);
  assert.equal(first.headers['Cache-Control'], 'no-store');
  assert.equal(first.headers['Access-Control-Allow-Origin'], undefined);
  assert.ok(!JSON.stringify(first).includes(env.GEMINI_API_KEY));
  const cookie = first.headers['Set-Cookie'].split(';')[0];
  const owner = authorize(req({ cookie }), configuration(env));
  assert.match(owner, /^[a-f0-9]{64}$/);
  const reused = await call(req({ cookie }));
  assert.equal(reused.statusCode, 200); assert.equal(reused.headers['Set-Cookie'], undefined);
  assert.equal(authorize(req({ cookie }), configuration(env)), owner);
  assert.notEqual(authorize(req({ cookie: second.headers['Set-Cookie'].split(';')[0] }), configuration(env)), owner);
});
test('CSRF, malformed, ambiguous or misconfigured bootstrap cannot issue cookies', async () => {
  const cookie = `__Host-sele-session=${'a'.repeat(43)}`;
  for (const request of [
    { ...req(), method: 'GET' }, req({ origin: undefined }), req({ origin: 'null' }),
    req({ origin: 'https://attacker.test' }), req({ 'sec-fetch-site': 'same-site' }),
    req({ 'content-type': 'text/plain' }), { ...req(), body: { accessCode: 'old-code' } },
    req({ cookie: cookie + '; ' + cookie }), req({ cookie: '__Host-sele-session=short' }),
  ]) {
    const res = await call(request); assert.ok(res.statusCode >= 400); assert.equal(res.headers['Set-Cookie'], undefined);
  }
  for (const key of ['AI_ENABLED', 'GEMINI_API_KEY', 'APP_ORIGIN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'AI_DAILY_UNITS', 'AI_LIFETIME_UNITS']) {
    const res = await call(req(), { ...env, [key]: '' });
    assert.equal(res.statusCode, 503); assert.equal(res.headers['Set-Cookie'], undefined);
  }
});
test('HTTP development cookie exception is limited to configured loopback origin', async () => {
  const origin = 'http://localhost:3000';
  const res = await call(req({ origin }), { ...env, APP_ORIGIN: origin });
  assert.match(res.headers['Set-Cookie'], /^sele-local-session=/);
  assert.ok(!res.headers['Set-Cookie'].includes('; Secure'));
  assert.throws(() => configuration({ ...env, APP_ORIGIN: 'http://example.test' }));
});
