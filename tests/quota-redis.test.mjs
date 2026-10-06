import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { RESERVE_SCRIPT } from '../server/security.mjs';

// Only an explicitly selected local test Redis. Never production/store credentials.
const port = Number(process.env.TEST_REDIS_PORT || 0);
function command(args) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let data = Buffer.alloc(0);
    socket.setTimeout(3000, () => socket.destroy(new Error('test Redis timeout')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(`*${args.length}\r\n` + args.map(value => {
      const s = String(value); return `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
    }).join('')));
    socket.on('data', chunk => {
      data = Buffer.concat([data,chunk]);
      const s=data.toString(); const end=s.indexOf('\r\n'); if(end<0)return;
      const value=s.slice(1,end);
      if(s[0]==='-') { socket.end(); reject(new Error(value)); }
      else if(s[0]===':' || s[0]==='+') { socket.end(); resolve(s[0]===':' ? Number(value) : value); }
      else if(s[0]==='$' && data.length >= end+2+Number(value)+2) { socket.end(); resolve(Number(value)<0 ? null : s.slice(end+2,end+2+Number(value))); }
    });
  });
}
test('real Redis: atomic budget across concurrent instances, midnight, missing ledger and leases', { skip: !port }, async () => {
  const prefix=`test:sele:{${randomUUID()}}`, ledger=`${prefix}:budget`, leases=`${prefix}:leases`;
  const reserve = (daily=200,lifetime=1000,cost=1) => command(['EVAL',RESERVE_SCRIPT,2,ledger,leases,daily,lifetime,cost,randomUUID()]);
  const seed=(total=0,day=0,daily=0)=>command(['HSET',ledger,'total',total,'day',day,'daily',daily]);
  try {
    assert.equal(await reserve(),-1,'missing ledger is never recreated');
    await seed();
    const results=await Promise.all(Array.from({length:25},()=>reserve(200,1000,10)));
    assert.equal(results.filter(x=>x===1).length,2,'only two in-flight calls');
    assert.equal(await command(['HGET',ledger,'total']),'20');
    await command(['DEL',leases]);
    assert.equal(await reserve(20,1000,1),0,'daily shared budget');
    await seed(990,0,0); await command(['DEL',leases]);
    assert.equal(await reserve(200,1000,10),1); await command(['DEL',leases]);
    assert.equal(await reserve(200,1000,1),0,'lifetime limit survives day rollover');
    await seed(); await command(['EXPIRE',ledger,60]);
    assert.equal(await reserve(),-1,'evictable ledger fails closed');
    await command(['PERSIST',ledger]); await command(['HSET',ledger,'total','broken']);
    assert.equal(await reserve(),-1,'corrupt counters fail closed');
    await seed(); await command(['DEL',leases]); await command(['ZADD',leases,1,'expired']);
    assert.equal(await reserve(),1,'expired lease can be reclaimed');
  } finally { await command(['DEL',ledger,leases]); }
});
