import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { WebSocket } from 'ws';
import { attachLiveRelay, liveStart, liveSetup, LIVE_LIMITS, LIVE_MODEL } from '../server/live.mjs';
import { createLiveServer } from '../api/live.mjs';

const ACCESS = 'a'.repeat(32);
const config = { origin: 'https://app.example', accessCode: ACCESS, apiKey: 'server-only-provider-secret',
  redisUrl: 'https://test.upstash.io', redisToken: 'server-only-redis-secret', daily: 200, lifetime: 2000 };
const start = { type: 'start', accessCode: ACCESS, characterName: 'セレ', otherCharacters: ['友人'], silent: false };
const tick = () => new Promise(resolve => setImmediate(resolve));
class Socket extends EventEmitter {
  readyState = 1; bufferedAmount = 0; sent = []; terminated = 0;
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { if (this.readyState === 3) return; this.readyState = 3; this.emit('close'); }
  terminate() { this.terminated++; this.close(); }
  receive(value, binary = false) { this.emit('message', binary ? value : Buffer.from(JSON.stringify(value)), binary); }
}
function harness({ reserveResult = 1, openError = false } = {}) {
  const client = new Socket(), provider = new Socket(), commands = [], timers = [];
  let calls = 0, clock = 0;
  const relay = attachLiveRelay(client, { headers: { origin: config.origin } }, config, {
    fetchImpl: async (url, init) => {
      assert.equal(url, config.redisUrl);
      const command = JSON.parse(init.body); commands.push(command);
      return { ok: true, json: async () => ({ result: command[0] === 'EVAL' ? reserveResult : 1 }) };
    },
    openProvider: value => { assert.equal(value.apiKey, config.apiKey); calls++; if (openError) throw Error('sensitive upstream URL'); return provider; },
    now: () => clock,
    schedule: (callback, ms) => { const timer = { callback, ms, cancelled: false }; timers.push(timer); return timer; },
    cancel: timer => { timer.cancelled = true; },
  });
  return { client, provider, commands, timers, relay, get calls() { return calls; }, advance: value => { clock = value; },
    async ready(silent = false) {
      client.receive({ ...start, silent }); await tick(); provider.emit('open');
      provider.receive({ setupComplete: {} });
      assert.equal(client.sent.at(-1)?.type, 'ready');
    },
  };
}

test('start is allowlisted: no provider URL, model, config, sessions or instructions', () => {
  for (const extra of ['model', 'apiKey', 'url', 'config', 'session', 'systemInstruction']) {
    assert.throws(() => liveStart({ ...start, [extra]: 'untrusted' }));
  }
  for (const invalid of [{ characterName: '' }, { characterName: 'x'.repeat(81) }, { otherCharacters: Array(6).fill('x') }, { silent: 'true' }]) {
    assert.throws(() => liveStart({ ...start, ...invalid }));
  }
  const setup = liveSetup(liveStart(start));
  assert.equal(setup.model, `models/${LIVE_MODEL}`);
  assert.equal(setup.generationConfig.maxOutputTokens, 512);
  assert.deepEqual(setup.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.equal(setup.sessionResumption, undefined);
  assert.equal(setup.contextWindowCompression, undefined);
});

test('auth and durable reservation precede the sole provider connection; keys never reach client', async () => {
  const h = harness(); await h.ready();
  assert.equal(h.calls, 1);
  assert.equal(h.commands[0][0], 'EVAL');
  assert.equal(h.commands[0].at(-2), String(LIVE_LIMITS.reservation));
  assert.equal(h.commands.length, 1, 'do not release concurrency when session starts');
  assert.deepEqual(h.provider.sent[0], { setup: liveSetup(liveStart(start)) });
  const output = JSON.stringify(h.client.sent);
  assert.ok(!output.includes(config.apiKey) && !output.includes(config.redisToken));
  h.relay.close(); await tick();
  assert.equal(h.provider.terminated, 1);
  assert.equal(h.commands[1][0], 'ZREM');
});

test('unauthenticated and quota-denied starts never connect upstream', async () => {
  const bad = harness(); bad.client.receive({ ...start, accessCode: 'wrong' }); await tick();
  assert.equal(bad.calls, 0); assert.equal(bad.commands.length, 0); assert.equal(bad.client.sent[0].reason, 'auth');
  const quota = harness({ reserveResult: 0 }); quota.client.receive(start); await tick();
  assert.equal(quota.calls, 0); assert.equal(quota.client.sent[0].reason, 'quota');
  const missingLedger = harness({ reserveResult: -1 }); missingLedger.client.receive(start); await tick();
  assert.equal(missingLedger.calls, 0); assert.equal(missingLedger.client.sent[0].reason, 'error');
});

test('duplicate starts and malformed messages fail closed without duplicate provider calls', async () => {
  const h = harness(); h.client.receive(start); h.client.receive(start); await tick();
  assert.equal(h.calls, 0);
  assert.equal(h.commands.filter(c => c[0] === 'EVAL').length, 1);
  const live = harness(); await live.ready(); live.client.receive({ type: 'generateContent', model: 'expensive' }); await tick();
  assert.equal(live.provider.terminated, 1);
});

test('fixed PCM format and real-time pacing reject audio floods before forwarding', async () => {
  const h = harness(); await h.ready();
  h.client.receive(Buffer.alloc(8192), true); await tick();
  assert.equal(h.provider.sent.at(-1).realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
  assert.equal(Buffer.from(h.provider.sent.at(-1).realtimeInput.audio.data, 'base64').length, 8192);
  h.client.receive(Buffer.alloc(16384), true); h.client.receive(Buffer.alloc(16384), true); await tick();
  assert.equal(h.client.sent.at(-1).reason, 'limit');
  assert.equal(h.provider.sent.length, 3, 'over-limit packet never reaches provider');
});

test('absolute PCM byte cap, packet cap and odd-sized PCM are enforced', async () => {
  const h = harness(); await h.ready(); h.advance(45_000);
  for (let i = 0; i < 100; i++) h.client.receive(Buffer.alloc(16_384), true);
  await tick(); assert.equal(h.client.sent.at(-1).reason, 'limit');
  const count = harness(); await count.ready();
  for (let i = 0; i < LIVE_LIMITS.packets + 1; i++) count.client.receive(Buffer.alloc(2), true);
  await tick(); assert.equal(count.client.sent.at(-1).reason, 'limit');
  const odd = harness(); await odd.ready(); odd.client.receive(Buffer.alloc(3), true); await tick();
  assert.equal(odd.provider.sent.length, 1); assert.equal(odd.provider.terminated, 1);
});

test('48kHz browser fallback remains connected for all 45 seconds after resampling', async () => {
  const h = harness(); await h.ready();
  // A 4096-sample callback at 48kHz becomes 1365 PCM samples at 16kHz.
  for (let i = 0; i < 527; i++) {
    h.advance(i * 4096 / 48);
    h.client.receive(Buffer.alloc(1365 * 2), true);
  }
  await tick();
  assert.equal(h.provider.terminated, 0);
  assert.equal(h.provider.sent.length, 528);
});

test('45 second server timer terminates provider even if browser ignores expiration', async () => {
  const h = harness(); await h.ready();
  const timer = h.timers.find(t => t.ms === 45_000);
  assert.ok(timer && !timer.cancelled); timer.callback(); await tick();
  assert.equal(h.client.sent.at(-1).reason, 'duration'); assert.equal(h.provider.terminated, 1);
  h.client.receive(Buffer.alloc(8192), true); assert.equal(h.provider.sent.length, 1);
});

test('auth timeout and setup timeout never leave a paid upstream open', async () => {
  const h = harness(); h.timers[0].callback(); assert.equal(h.calls, 0);
  const pending = harness(); pending.client.receive(start); await tick();
  pending.timers.find(t => t.ms === 5000 && !t.cancelled).callback(); await tick();
  assert.equal(pending.provider.terminated, 1); assert.equal(pending.client.sent.at(-1).reason, 'error');
});

test('speaking mode streams bounded audio; silent mode suppresses it; interruptions survive', async () => {
  const event = { serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAA' } }] } } };
  const speaking = harness(); await speaking.ready(); speaking.provider.receive(event);
  assert.deepEqual(speaking.client.sent.at(-1), { type: 'audio', data: 'AAAA' });
  speaking.provider.receive({ serverContent: { interrupted: true } }); assert.equal(speaking.client.sent.at(-1).type, 'interrupted');
  const silent = harness(); await silent.ready(true); silent.provider.receive(event);
  assert.equal(silent.client.sent.length, 1);
});

test('tools preserve draw_image while allowing only exact pending IDs and fixed responses', async () => {
  const h = harness(); await h.ready();
  h.provider.receive({ toolCall: { functionCalls: [{ id: 'draw1', name: 'draw_image', args: { prompt: '青い海', style: '水彩' } }] } });
  assert.deepEqual(h.client.sent.at(-1), { type: 'draw', id: 'draw1', prompt: '青い海', style: '水彩' });
  h.client.receive({ type: 'toolResult', id: 'draw1', ok: true }); await tick();
  assert.deepEqual(h.provider.sent.at(-1).toolResponse.functionResponses[0], {
    id: 'draw1', name: 'draw_image', response: { result: 'Image generated and displayed.' },
  });
  h.client.receive({ type: 'toolResult', id: 'draw1', ok: true }); await tick();
  assert.equal(h.provider.terminated, 1, 'replayed tool response fails closed');
  const injected = harness(); await injected.ready();
  injected.client.receive({ type: 'toolResult', id: 'unknown', ok: true, response: 'arbitrary text' }); await tick();
  assert.equal(injected.provider.sent.length, 1);
});

test('turn, drawing, downstream bytes and slow-client caps all terminate upstream', async () => {
  const turns = harness(); await turns.ready();
  for (let i = 0; i < LIVE_LIMITS.responses; i++) turns.provider.receive({ serverContent: { modelTurn: { parts: [] }, turnComplete: true } });
  assert.equal(turns.client.sent.at(-1).reason, 'limit'); assert.equal(turns.provider.terminated, 1);
  const drawing = harness(); await drawing.ready();
  for (let i = 0; i < 4; i++) drawing.provider.receive({ toolCall: { functionCalls: [{ id: `draw${i}`, name: 'draw_image', args: { prompt: '青い海' } }] } });
  assert.equal(drawing.client.sent.filter(m => m.type === 'draw').length, 3); assert.equal(drawing.provider.terminated, 1);
  const bytes = harness(); await bytes.ready(); bytes.provider.receive({ unknown: 'x'.repeat(LIVE_LIMITS.responseBytes) });
  assert.equal(bytes.client.sent.at(-1).reason, 'limit');
  const slow = harness(); await slow.ready(); slow.client.bufferedAmount = 300_000;
  slow.provider.receive({ serverContent: { interrupted: true } }); assert.equal(slow.provider.terminated, 1);
});

test('upstream errors are sanitized and are never retried', async () => {
  const h = harness(); await h.ready(); h.provider.emit('error', Error(`provider secret ${config.apiKey}`)); await tick();
  assert.equal(h.calls, 1); assert.ok(!JSON.stringify(h.client.sent).includes(config.apiKey));
  assert.equal(h.client.sent.at(-1).reason, 'error');
});

test('real local WebSocket handshake: exact path/origin only, no query-string credentials', async t => {
  let admitted = 0;
  const server = createLiveServer({ env: { AI_ENABLED: 'true', APP_ORIGIN: config.origin, APP_ACCESS_CODE: ACCESS,
    GEMINI_API_KEY: 'fake-key', UPSTASH_REDIS_REST_URL: config.redisUrl, UPSTASH_REDIS_REST_TOKEN: 'fake-redis',
    AI_DAILY_UNITS: '200', AI_LIFETIME_UNITS: '2000' }, relay: socket => { admitted++; socket.close(); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `ws://127.0.0.1:${server.address().port}`;
  const good = new WebSocket(`${base}/api/live`, { origin: config.origin }); await once(good, 'close'); assert.equal(admitted, 1);
  for (const [path, origin] of [['/api/live?key=secret', config.origin], ['/api/other', config.origin], ['/api/live', 'https://attacker.example']]) {
    const ws = new WebSocket(base + path, { origin });
    const error = await new Promise(resolve => ws.once('error', resolve));
    assert.match(error.message, /403/);
  }
  assert.equal(admitted, 1);
});
