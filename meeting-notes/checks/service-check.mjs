import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const archive = process.argv[2];
if (!archive) throw new Error('Usage: node service-check.mjs <backend.tar.gz>');
const root = existsSync('/Volumes/Vibe-Temp') ? '/Volumes/Vibe-Temp/meeting-notes/checks' : new URL('../.tmp/checks', import.meta.url).pathname;
await mkdir(root, { recursive: true });
const scratch = await mkdtemp(`${root}/service-`);
let child;
let exited;
try {
  await promisify(execFile)('tar', ['-xf', archive, '-C', scratch]);
  assert.equal(existsSync(`${scratch}/backend/.env`), false, 'Release must not contain credentials.');
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  await writeFile(`${scratch}/backend/.env`, `PORT=${port}\nMEETING_NOTES_SCRATCH=${scratch}/uploads\nSTUDIO5_URL=http://127.0.0.1:1\n`, { mode: 0o600 });
  const env = { ...process.env };
  delete env.PORT;
  delete env.MEETING_NOTES_SCRATCH;
  delete env.STUDIO5_URL;
  child = spawn(process.execPath, [`${scratch}/server.mjs`], { cwd: scratch, env, stdio: ['ignore', 'pipe', 'pipe'] });
  exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Packaged backend did not start.')), 10000);
    child.once('error', reject);
    child.stdout.on('data', data => {
      if (String(data).includes('backend ready')) { clearTimeout(timeout); resolve(); }
    });
    child.stderr.on('data', data => { clearTimeout(timeout); reject(new Error(String(data))); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Packaged backend exited before readiness.')); });
  });
  assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 401, 'Packaged service must enforce Studio authentication.');
  child.kill('SIGTERM');
  assert.deepEqual(await exited, { code: 0, signal: null });
  child = null;
  assert.deepEqual(await readdir(`${scratch}/uploads`), [], 'Service shutdown must remove its temporary run directory.');
  console.log('Backend archive passed: secure environment loading, production entry point, authentication and clean shutdown.');
} finally {
  if (child) { child.kill('SIGTERM'); await exited; }
  await rm(scratch, { recursive: true, force: true });
}
