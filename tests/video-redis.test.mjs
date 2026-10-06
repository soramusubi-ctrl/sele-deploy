import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { VIDEO_CREATE_SCRIPT, VIDEO_STARTED_SCRIPT, VIDEO_POLL_SCRIPT, VIDEO_FINISH_POLL_SCRIPT, VIDEO_DOWNLOAD_SCRIPT, VIDEO_MODEL } from '../server/video.mjs';

// No external databases or credentials. CI provides an ephemeral Redis service.
const port = Number(process.env.TEST_REDIS_PORT || 0);
function parseResp(buffer, start = 0) {
  const end = buffer.indexOf('\r\n', start); if (end < 0) return null;
  const type = String.fromCharCode(buffer[start]), text = buffer.subarray(start + 1, end).toString(), next = end + 2;
  if (type === '-') throw Error(text);
  if (type === ':' || type === '+') return { value: type === ':' ? Number(text) : text, next };
  if (type === '$') {
    const length = Number(text); if (length < 0) return { value: null, next };
    if (buffer.length < next + length + 2) return null;
    return { value: buffer.subarray(next, next + length).toString(), next: next + length + 2 };
  }
  if (type === '*') {
    const values = []; let cursor = next;
    for (let i = 0; i < Number(text); i++) { const parsed = parseResp(buffer, cursor); if (!parsed) return null; values.push(parsed.value); cursor = parsed.next; }
    return { value: values, next: cursor };
  }
  throw Error('Unsupported test Redis response');
}
function command(args) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Select a local test Redis port');
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port }); let buffer = Buffer.alloc(0);
    socket.setTimeout(3000, () => socket.destroy(Error('local test Redis timeout')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(`*${args.length}\r\n` + args.map(value => {
      const string = String(value); return `$${Buffer.byteLength(string)}\r\n${string}\r\n`;
    }).join('')));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      try { const result = parseResp(buffer); if (result) { socket.end(); resolve(result.value); } }
      catch (error) { socket.destroy(); reject(error); }
    });
  });
}

test('real Redis video scripts: one durable charge, ownership, poll leases, download caps, expiry and lifetime budget', { skip: !port }, async () => {
  const prefix = `test:video:{${randomUUID()}}`, ledger = `${prefix}:budget`, leases = `${prefix}:leases`, active = `${prefix}:active`;
  const keys = new Set([ledger, leases, active]), owner = 'test-owner';
  const jobKey = id => `${prefix}:job:${id}`;
  const evaluate = (script, keys, args) => command(['EVAL', script, keys.length, ...keys, ...args]);
  const create = (requestId, { fingerprint = 'fingerprint', daily = 200, lifetime = 2000, session = owner } = {}) => {
    const id = randomUUID(), job = jobKey(id); keys.add(job);
    return evaluate(VIDEO_CREATE_SCRIPT, [ledger, leases, active, job], [lifetime, daily, 160, session, `${session}:${fingerprint}`, id, `video:${requestId}`]);
  };
  const seed = (total = 0, day = 0, daily = 0) => command(['HSET', ledger, 'total', total, 'day', day, 'daily', daily]);
  const op = `models/${VIDEO_MODEL}/operations/test-op`;
  try {
    assert.deepEqual(await create('missing'), [-1]);
    await seed();
    const attempts = await Promise.all(Array.from({ length: 24 }, () => create('same-request')));
    assert.equal(attempts.filter(value => value[0] === 1).length, 1);
    const id = attempts[0][1], job = jobKey(id);
    assert.ok(attempts.every(value => value[1] === id));
    assert.equal(await command(['HGET', ledger, 'total']), '160');
    assert.equal(await command(['TTL', ledger]), -1, 'idempotency tombstones share the non-expiring budget ledger');
    assert.equal(await command(['TTL', leases]), -1, 'shared leases use score expiry, never key expiry');
    assert.ok(await command(['TTL', job]) > 0, 'sensitive provider job metadata expires');
    assert.deepEqual(await create('same-request', { fingerprint: 'changed' }), [-2]);
    assert.deepEqual(await create('daily-limit'), [0]);
    assert.deepEqual(await create('same-request', { session: 'other-browser' }), [-2], 'cookie replacement cannot reopen uncertain create');
    assert.deepEqual(await create('new-session', { session: 'other-browser' }), [0], 'new session cannot reset global daily quota');
    assert.deepEqual(await evaluate(VIDEO_POLL_SCRIPT, [job, active, leases], ['another-owner', 'token', id]), [-1]);
    assert.deepEqual(await evaluate(VIDEO_POLL_SCRIPT, [job, active, leases], [owner, 'token', id]), [0, 'uncertain']);
    assert.equal(await evaluate(VIDEO_STARTED_SCRIPT, [job, leases], [owner, op, id]), 1);
    assert.equal(await command(['ZCARD', leases]), 1, 'pending video retains the shared global lease');
    assert.deepEqual(await evaluate(VIDEO_POLL_SCRIPT, [job, active, leases], [owner, 'token', id]), [1, op]);
    assert.deepEqual(await evaluate(VIDEO_POLL_SCRIPT, [job, active, leases], [owner, 'other-token', id]), [0, 'pending']);
    assert.equal(await command(['HGET', job, 'polls']), '1');
    assert.equal(await evaluate(VIDEO_FINISH_POLL_SCRIPT, [job, active, leases], [owner, 'stale-token', 'ready', 'uri', id]), 0);
    assert.equal(await evaluate(VIDEO_FINISH_POLL_SCRIPT, [job, active, leases], [owner, 'token', 'ready', 'safe-uri', id]), 1);
    assert.equal(await command(['ZCARD', active]), 0);
    assert.equal(await command(['ZCARD', leases]), 0, 'terminal video releases the shared global lease');
    assert.deepEqual(await evaluate(VIDEO_DOWNLOAD_SCRIPT, [job], ['another-owner']), [-1]);
    assert.deepEqual(await evaluate(VIDEO_DOWNLOAD_SCRIPT, [job], [owner]), [1, 'safe-uri']);
    assert.deepEqual(await evaluate(VIDEO_DOWNLOAD_SCRIPT, [job], [owner]), [2], 'download spacing is atomic');
    await command(['HSET', job, 'downloads', 3, 'lastDownload', 0]);
    assert.deepEqual(await evaluate(VIDEO_DOWNLOAD_SCRIPT, [job], [owner]), [2], 'download count persists');
    await command(['DEL', job]);
    assert.deepEqual(await create('same-request'), [2, id], 'expired job cannot trigger a second billable attempt');
    assert.deepEqual(await evaluate(VIDEO_POLL_SCRIPT, [job, active, leases], [owner, 'token', id]), [-1]);
    await seed(1990, 0, 0);
    assert.deepEqual(await create('lifetime-limit'), [0], 'day rollover never resets lifetime spend');
    await command(['DEL', ledger]);
    assert.deepEqual(await create('lost-ledger'), [-1], 'eviction fails closed');
    await seed(); await command(['EXPIRE', ledger, 60]);
    assert.deepEqual(await create('expiring-ledger'), [-1]);
    await command(['PERSIST', ledger]); await command(['HSET', ledger, 'total', 'corrupt']);
    assert.deepEqual(await create('corrupt-ledger'), [-1]);
    await seed(); await command(['DEL', leases, active]);
    const jobs = await Promise.all([create('active-1', { daily: 1000 }), create('active-2', { daily: 1000 }), create('active-3', { daily: 1000 })]);
    assert.equal(jobs.filter(value => value[0] === 1).length, 2);
    assert.equal(jobs.filter(value => value[0] === 3).length, 1, 'concurrent in-flight jobs are capped');
    const activeId = jobs.find(value => value[0] === 1)[1], activeJob = jobKey(activeId);
    await evaluate(VIDEO_STARTED_SCRIPT, [activeJob, leases], [owner, op, activeId]);
    await command(['HSET', activeJob, 'polls', 90]);
    assert.deepEqual(await evaluate(VIDEO_POLL_SCRIPT, [activeJob, active, leases], [owner, 'token', activeId]), [0, 'expired']);
  } finally { await command(['DEL', ...keys]); }
});
