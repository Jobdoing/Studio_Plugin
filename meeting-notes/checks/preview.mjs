import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../../Studio5/', import.meta.url));
const plugin = fileURLToPath(new URL('../plugin/meeting-notes/', import.meta.url));
const gitRead = async path => (await promisify(execFile)('git', ['-C', repository, 'show', `origin/main:${path}`], { maxBuffer: 2000000 })).stdout;
const [sdk, kit, tokens] = await Promise.all([
  gitRead('public/studio-mock.js'), gitRead('src/studio-kit.css'), gitRead('src/design-tokens.css'),
]);
const shared = new Map([
  ['/studio-plugin.js', ['text/javascript', sdk]],
  ['/studio-kit.css', ['text/css', kit]],
  ['/design-tokens.css', ['text/css', tokens]],
  ['/preview-bootstrap.mjs', ['text/javascript', await readFile(new URL('./preview-bootstrap.mjs', import.meta.url))]],
  ['/preview-fixture.json', ['application/json', await readFile(new URL('./transcript.json', import.meta.url))]],
]);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/favicon.ico') return response.writeHead(204).end();
  const resource = shared.get(path);
  if (resource) return response.writeHead(200, { 'Content-Type': resource[0], 'Cache-Control': 'no-store' }).end(resource[1]);
  const target = resolve(plugin, `.${path === '/' ? '/index.html' : path}`);
  if (!target.startsWith(plugin)) return response.writeHead(404).end();
  try {
    let body = await readFile(target);
    if (extname(target) === '.html') body = body.toString().replace('src="./app.mjs"', 'src="/preview-bootstrap.mjs"');
    response.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.json': 'application/json' }[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end(); }
});
server.listen(8940, '127.0.0.1', () => console.log('Meeting notes preview: http://127.0.0.1:8940/ (simulated data).'));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
