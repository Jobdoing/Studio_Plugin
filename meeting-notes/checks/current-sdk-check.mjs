import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, symlink, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const repository = process.env.STUDIO5_REPOSITORY || fileURLToPath(new URL('../../../Studio5/', import.meta.url));
const plugin = fileURLToPath(new URL('../plugin/meeting-notes/', import.meta.url));
const root = existsSync('/Volumes/Vibe-Temp') ? '/Volumes/Vibe-Temp/meeting-notes/checks' : fileURLToPath(new URL('../.tmp/checks', import.meta.url));
if (!existsSync('/Volumes/Vibe-Temp')) console.warn('External scratch volume unavailable; using project .tmp/checks.');
await mkdir(root, { recursive: true });
const scratch = await mkdtemp(`${root}/current-sdk-`);
const snapshot = `${scratch}/studio`;
const originalCwd = process.cwd();
const digest = value => createHash('sha256').update(value).digest('hex');
try {
  // Reuse the official platform checker; read platform source only from the current Git commit.
  await exec('git', ['-C', repository, 'fetch', '--quiet', 'origin', 'main'], { timeout: 60000 });
  const commit = (await exec('git', ['-C', repository, 'rev-parse', 'origin/main'])).stdout.trim();
  const remote = (await exec('git', ['-C', repository, 'ls-remote', 'origin', 'refs/heads/main'], { timeout: 60000 })).stdout.split(/\s/)[0];
  assert.equal(commit, remote, 'origin/main does not match the current remote main.');
  await mkdir(snapshot);
  await exec('git', ['-C', repository, 'archive', '--format=tar', '--output', `${scratch}/studio.tar`, commit]);
  await exec('tar', ['-xf', `${scratch}/studio.tar`, '-C', snapshot]);
  await rm(`${scratch}/studio.tar`);
  // Reuse installed dependencies, but keep writable Vite caches inside this disposable snapshot.
  await mkdir(`${snapshot}/node_modules`);
  for (const name of await readdir(`${repository}/node_modules`)) {
    if (name.startsWith('.') && name !== '.bin') continue;
    if (name.startsWith('@')) {
      await mkdir(`${snapshot}/node_modules/${name}`);
      for (const child of await readdir(`${repository}/node_modules/${name}`)) {
        await symlink(`${repository}/node_modules/${name}/${child}`, `${snapshot}/node_modules/${name}/${child}`);
      }
    } else await symlink(`${repository}/node_modules/${name}`, `${snapshot}/node_modules/${name}`);
  }
  const manifest = JSON.parse(await readFile(`${snapshot}/package.json`, 'utf8'));
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    if (!version.startsWith('file:') || !version.endsWith('.tgz')) continue;
    const target = `${snapshot}/node_modules/${name}`;
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await exec('tar', ['-xf', `${snapshot}/${version.slice(5)}`, '-C', target, '--strip-components=1']);
  }
  process.env.TMPDIR = scratch;
  process.chdir(snapshot);
  const { assembleSdk } = await import(pathToFileURL(`${snapshot}/scripts/build-sdk.mjs`).href);
  const sdk = assembleSdk();
  assert.doesNotMatch(sdk.toString('utf8'), /addEventListener\(\s*['"]unload['"]/);
  const expectedHash = digest(sdk);
  const { runPluginCheck, formatCheckSummary } = await import(pathToFileURL(`${snapshot}/scripts/lib/blocks/plugin-check.mjs`).href);
  const { default: puppeteer } = createRequire(`${snapshot}/package.json`)('puppeteer-core');
  const chromePath = process.env.CHROME_FOR_TESTING || '/Volumes/Vibe-Temp/browsers/chrome/mac_arm-154.0.8037.92/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const sdkResponses = [];
  const diagnostics = [];
  const result = await runPluginCheck({ dir: plugin, chromePath,
    async launch(options) {
      const browser = await puppeteer.launch({ ...options, userDataDir: `${scratch}/profile` });
      const newPage = browser.newPage.bind(browser);
      browser.newPage = async () => {
        const page = await newPage();
        const cdp = await page.createCDPSession();
        await cdp.send('Log.enable');
        cdp.on('Log.entryAdded', ({ entry }) => {
          if (/unload/i.test(entry.text)) diagnostics.push({ text: entry.text, url: entry.url, line: (entry.lineNumber ?? -1) + 1 });
        });
        page.on('console', message => {
          if (['error', 'warn'].includes(message.type())) diagnostics.push({ text: message.text(), ...message.location() });
        });
        page.on('response', response => {
          if (new URL(response.url()).pathname === '/studio-plugin.js') {
            sdkResponses.push(response.text().then(body => ({ url: response.url(), status: response.status(), sha256: digest(body) }))
              .catch(error => ({ error: error.message })));
          }
        });
        return page;
      };
      return browser;
    },
  });
  const responses = await Promise.all(sdkResponses);
  assert.ok(responses.length, 'The browser did not load /studio-plugin.js.');
  for (const response of responses) {
    assert.equal(response.status, 200, JSON.stringify(response));
    assert.equal(response.sha256, expectedHash, 'The served SDK differs from origin/main.');
  }
  console.log(`SDK origin/main ${commit}; SHA-256 ${expectedHash}; verified ${responses.length} browser response(s).`);
  console.log(formatCheckSummary(result));
  if (diagnostics.length) console.log(JSON.stringify({ browserDiagnostics: diagnostics }));
  assert.equal(diagnostics.some(item => /unload/i.test(item.text)), false, 'Browser reported an unload violation; inspect its source above.');
  assert.equal(result.ok, true, 'Current-platform check failed.');
  assert.equal(result.lint.warnings.length, 0, 'Resolve lint warnings before packaging.');
  const flow = await exec(process.execPath, [fileURLToPath(new URL('./browser-check.mjs', import.meta.url))], {
    env: { ...process.env, STUDIO5_ROOT: snapshot, CHROME_FOR_TESTING: chromePath }, timeout: 120000, maxBuffer: 200000,
  });
  console.log(flow.stdout.trim());
  const recording = await exec(process.execPath, [fileURLToPath(new URL('./recorder-check.mjs', import.meta.url))]);
  console.log(recording.stdout.trim());
  const host = await exec(process.execPath, [fileURLToPath(new URL('./host-browser-check.mjs', import.meta.url))], {
    env: { ...process.env, STUDIO5_ROOT: snapshot, CHROME_FOR_TESTING: chromePath }, timeout: 120000, maxBuffer: 200000,
  });
  console.log(host.stdout.trim());
  const { installPlugin } = await import(pathToFileURL(`${snapshot}/scripts/lib/blocks/plugin-install.mjs`).href);
  const pluginManifest = JSON.parse(await readFile(`${plugin}/plugin.json`, 'utf8'));
  const release = `${root}/../releases/${pluginManifest.version}`;
  await mkdir(release, { recursive: true });
  const bundle = `${release}/meeting-notes-${pluginManifest.version}.zip`;
  const packaged = await exec('python3', [fileURLToPath(new URL('./package-release.py', import.meta.url)), release]);
  console.log(packaged.stdout.trim());
  await installPlugin({ blocksDir: `${scratch}/installed/blocks`, appDataRoot: `${scratch}/installed/app-data`,
    blobRoot: `${scratch}/installed/blob`, source: bundle, strict: true, expectedId: 'meeting-notes' });
  assert.deepEqual(await readFile(`${scratch}/installed/blocks/meeting-notes/app.mjs`), await readFile(`${plugin}/app.mjs`));
  const service = await exec(process.execPath, [fileURLToPath(new URL('./service-check.mjs', import.meta.url)),
    `${release}/meeting-notes-backend-${pluginManifest.version}.tar.gz`], { timeout: 30000 });
  console.log(service.stdout.trim());
  console.log(`Release packages created and plugin ZIP install verified: ${release}`);
} finally {
  process.chdir(originalCwd);
  await rm(scratch, { recursive: true, force: true });
}
