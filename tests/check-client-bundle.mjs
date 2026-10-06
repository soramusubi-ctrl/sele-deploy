import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const forbidden = ['BUILD_ONLY_LEGACY_SECRET_SENTINEL', 'BUILD_ONLY_PROVIDER_SECRET_SENTINEL', 'BUILD_ONLY_ACCESS_SECRET_SENTINEL',
  'generativelanguage.googleapis.com', 'process.env.API_KEY', 'UPSTASH_REDIS_REST_TOKEN'];
for (const file of await readdir('dist/assets')) {
  if (!file.endsWith('.js')) continue;
  const text = await readFile(`dist/assets/${file}`,'utf8');
  for(const value of forbidden) assert.ok(!text.includes(value), `client bundle contains forbidden marker: ${value}`);
}
console.log('Client bundle contains no server-secret sentinels, direct provider endpoint, or server configuration.');
