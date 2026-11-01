// Start the dashboard in Docker on the first free port and print the address.
//
//   npm run docker                    build + start (port 3000, or the next free one up to 3010)
//   npm run docker -- --no-build      start without rebuilding
//
// Why a script: with a port range in docker-compose.yml, Docker moves to the
// next port on every restart (3001, 3002, ...). This script checks which port
// is free right now, starting at 3000, so the address stays the same when it can.
// If you set PORT in .env (or in your shell), that wins.

import fs from 'node:fs';
import net from 'node:net';
import { spawnSync } from 'node:child_process';

const FIRST = 3000, LAST = 3010;

const run = (args, opts = {}) => spawnSync('docker', ['compose', ...args], { encoding: 'utf8', shell: process.platform === 'win32', ...opts });

function portFromDotEnv() {
  try {
    const m = fs.readFileSync('.env', 'utf8').match(/^\s*PORT\s*=\s*([^\s#]+)/m);
    return m ? m[1] : null;
  } catch { return null; }
}

function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function firstFreePort() {
  for (let p = FIRST; p <= LAST; p++) if (await isFree(p)) return p;
  return null;
}

// Stop our own container first so it doesn't hold on to the port we want.
run(['down'], { stdio: 'ignore' });

const env = { ...process.env };
const fixed = env.PORT || portFromDotEnv();
if (!fixed) {
  const port = await firstFreePort();
  if (!port) {
    console.error(`Ports ${FIRST}-${LAST} are all in use. Set PORT in .env to a free port (e.g. PORT=8080).`);
    process.exit(1);
  }
  if (port !== FIRST) console.log(`Port ${FIRST} is in use, using ${port} instead.`);
  env.PORT = String(port);
}

const extra = process.argv.slice(2);
const build = extra.includes('--no-build') ? [] : ['--build'];
const up = run(['up', '-d', ...build, ...extra], { stdio: 'inherit', env });
if (up.status !== 0) process.exit(up.status ?? 1);

// Ask Docker which host port the container got.
const out = run(['port', 'dashboard', '3000'], { env }).stdout || '';
const m = out.match(/:(\d+)\s*$/m);
console.log(m
  ? `\nClaude Context Dashboard is running → http://localhost:${m[1]}\n`
  : '\nStarted, but could not read the port. Run: docker compose port dashboard 3000\n');
