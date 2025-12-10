const fs = require('fs');
const path = require('path');

function readEnvFile(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
}

const envRaw = readEnvFile(path.join(__dirname, '..', '.env'));
let redisUrl;
const m = envRaw.match(/^REDIS_URL=(.*)$/m);
if (m && m[1]) {
  redisUrl = m[1].replace(/^"|"$/g, '')
}
if (!redisUrl && process.env.REDIS_URL) redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  console.error('REDIS_URL not set');
  process.exit(2);
}

const Redis = require('ioredis');
const r = new Redis(redisUrl);

r.ping().then(res => {
  console.log('PING ->', res);
  return r.quit();
}).catch(err => {
  console.error('PING error', err);
  r.disconnect();
  process.exit(1);
});
