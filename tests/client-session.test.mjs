import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual TypeScript client modules with isolated, offline browser APIs.
function moduleFor(path, globals) {
  const exports = {};
  const script = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(script, { exports, TextEncoder, AbortSignal, crypto: webcrypto, ...globals });
  return exports;
}
test('parallel browser actions share bootstrap, expiry rechecks, failures never auto-retry', async () => {
  let calls = 0, finish;
  const client = moduleFor('src/services/aiSession.ts', { fetch: async (url, options) => {
    calls++; assert.equal(url, '/api/session'); assert.equal(options.credentials, 'same-origin');
    assert.equal(options.body, '{}'); assert.equal(options.headers.Authorization, undefined);
    return new Promise(resolve => { finish = resolve; });
  } });
  const first = client.ensureAiSession(), second = client.ensureAiSession();
  assert.equal(first, second); assert.equal(calls, 1);
  finish({ ok: true, json: async () => ({ ready: true }) }); await first;
  const expired = client.ensureAiSession(); assert.equal(calls, 2);
  finish({ ok: false, json: async () => ({ error: 'configuration missing' }) });
  await assert.rejects(expired, /configuration missing/); assert.equal(calls, 2);
});
test('legacy pending video records block migration without any bootstrap or paid request', async () => {
  let calls = 0;
  const client = moduleFor('src/services/geminiService.ts', {
    require: name => name.includes('aiImageInput') ? { prepareAiImage: async (base64, mimeType) => ({ base64, mimeType }) } : { ensureAiSession: async () => { calls++; } },
    sessionStorage: { length: 1, key: () => `sele:video:pending:${'a'.repeat(64)}` },
    fetch: async () => { calls++; throw Error('must not be called'); },
  });
  await assert.rejects(client.generateVideo('tree', 'AAAA', 'image/png', '16:9', () => {}), /更新前/);
  assert.equal(calls, 0);
});
test('first visits in different tabs serialize cookie bootstrap with Web Locks', async () => {
  let queue = Promise.resolve(), active = 0, max = 0, calls = 0;
  const globals = {
    navigator: { locks: { request(name, callback) {
      assert.equal(name, 'sele-ai-session');
      const next = queue.then(callback); queue = next.catch(() => {}); return next;
    } } },
    fetch: async () => {
      calls++; active++; max = Math.max(max, active);
      await new Promise(resolve => setImmediate(resolve)); active--;
      return { ok: true, json: async () => ({ ready: true }) };
    },
  };
  const first = moduleFor('src/services/aiSession.ts', globals), other = moduleFor('src/services/aiSession.ts', globals);
  await Promise.all([first.ensureAiSession(), other.ensureAiSession()]);
  assert.equal(calls, 2); assert.equal(max, 1);
});
