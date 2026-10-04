import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

if (!process.env.STUDIO5_ROOT || !process.env.EVIDENCE_DIR) throw new Error('Set STUDIO5_ROOT and EVIDENCE_DIR; start the isolated harness on port 5224.');
const puppeteer = createRequire(`${process.env.STUDIO5_ROOT}/package.json`)('puppeteer-core');
const copy = JSON.parse(readFileSync(new URL('../plugin/site-diorama/content.zh-Hant.json', import.meta.url)));
const shellCopy = JSON.parse(readFileSync(`${process.env.STUDIO5_ROOT}/src/copy.zh-Hant.json`));
const manifest = JSON.parse(readFileSync(new URL('../plugin/site-diorama/plugin.json', import.meta.url)));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = [], calls = [];
let mode = 'normal', release, delayed;
const summary = module => ({ corrective: { total_count: 10, open_count: 4, overdue_count: 2 }, diary: { total_count: 3, latest_date: '2026-06-01' }, inspection: { total_count: 20, failed_count: 5 } })[module];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('503')) errors.push(message.text()); });
await page.setRequestInterception(true);
page.on('request', async request => {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/block/site-diorama-')) return request.continue();
  const name = url.pathname.split('/').pop(), module = name.split('-')[2];
  calls.push({ name, project: url.searchParams.get('project_handle') });
  if (mode === 'failure') return request.respond({ status: 503, contentType: 'application/json', body: '{}' });
  const isDetail = name.endsWith('detail');
  let rows = isDetail ? [{ title: mode === 'text' ? '<img src=x onerror=alert(1)>' : 'Guardrail inspection', status_label: null, record_date: null, note: null, variant: 'normal' }] : [summary(module)];
  if (mode === 'empty') rows = isDetail ? [] : [module === 'diary' ? { total_count: 0, latest_date: null } : module === 'corrective' ? { total_count: 0, open_count: 0, overdue_count: 0 } : { total_count: 0, failed_count: 0 }];
  if (mode === 'delay' && !isDetail && module === 'corrective') {
    delayed?.();
    await new Promise(resolve => { release = resolve; });
    rows = [{ total_count: 99, open_count: 99, overdue_count: 0 }];
  }
  await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ fields: [], rows }) });
});
const frameOf = async () => (await page.$('iframe')).contentFrame();
const settle = frame => frame.waitForFunction(() => [...document.querySelectorAll('.module')].every(el => el.getAttribute('aria-busy') !== 'true'));
async function screenshot(frame) { return Buffer.from(await (await frame.$('canvas')).screenshot()); }
async function clickNav(label) {
  for (const button of await page.$$('.nav-item')) if ((await button.evaluate(el => el.textContent)).trim() === label) return button.click();
  throw new Error('Navigation item missing');
}
try {
  await page.goto('http://127.0.0.1:5224/api/auth/dev-login?user=dev&id=site-diorama');
  await page.waitForSelector('iframe');
  let frame = await frameOf();
  await frame.waitForSelector('canvas');
  assert.equal(calls.length, 0, 'Unselected project must never query data');
  await page.select('#sidebar-project-select', '__all__');
  await frame.waitForFunction(() => document.getElementById('refresh').disabled);
  assert.equal(calls.length, 0, 'All-project scope must never query data');
  const options = await page.$$eval('#sidebar-project-select option', els => els.map(el => ({ value: el.value, label: el.textContent })));
  const p1 = options.find(o => o.label === 'Dev Project 1').value, p2 = options.find(o => o.label === 'Dev Project 2').value;
  await page.select('#sidebar-project-select', p1); await settle(frame);
  assert.ok(calls.every(call => call.project === p1), 'Every SDK query explicitly carries the selected handle');
  assert.equal(await frame.$eval('#summary-corrective .metric-value', el => el.textContent), '4');
  assert.equal(await frame.$eval('#summary-diary .module-secondary', el => el.textContent), `${copy.diary.secondary} 2026/06/01`);
  assert.equal(await frame.$eval('#summary-inspection .metric-value', el => el.textContent), '5');
  await frame.click('#marker-corrective');
  await frame.waitForFunction(() => document.querySelectorAll('.record').length === 1);
  assert.equal(await frame.$eval('#detail-heading', el => el.textContent), copy.corrective.title);
  assert.equal(await frame.$eval('#detail-list h3', el => el.textContent), 'Guardrail inspection');
  assert.equal(await frame.evaluate(() => document.activeElement.id), 'detail-heading');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${width}: plugin overflow`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${width}: shell overflow`);
    const bounds = await frame.$$eval('.marker', els => els.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i], b = bounds[j];
      assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `${width}: labels overlap`);
    }
    await page.screenshot({ path: `${process.env.EVIDENCE_DIR}/preview-${width}.png`, fullPage: true });
  }
  mode = 'text'; await frame.click('#summary-corrective');
  await frame.waitForFunction(() => document.querySelector('#detail-list h3')?.textContent === '<img src=x onerror=alert(1)>');
  assert.equal(await frame.$$('#detail-list img').then(els => els.length), 0, 'Query text must not become HTML');
  mode = 'normal';
  await frame.click('#motion');
  await frame.waitForFunction(() => document.getElementById('stage').dataset.motion === 'false');
  // Allow the final GPU render to reach the screenshot before comparing frozen frames.
  await new Promise(resolve => setTimeout(resolve, 250));
  const frozen = await screenshot(frame); await new Promise(resolve => setTimeout(resolve, 250));
  assert.ok(frozen.equals(await screenshot(frame)), 'Animation off must stop actual canvas changes');
  await frame.click('#right'); assert.ok(!frozen.equals(await screenshot(frame)), 'Rotation must change 3D geometry');
  await frame.click('#reset'); await frame.click('#motion');
  const moving = await screenshot(frame); await new Promise(resolve => setTimeout(resolve, 500));
  assert.ok(!moving.equals(await screenshot(frame)), 'Animation on must move the model');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await frame.waitForFunction(() => document.getElementById('motion').disabled);
  assert.equal(await frame.$eval('#stage', el => el.dataset.motion), 'false');
  await page.emulateMediaFeatures([]);
  await clickNav(shellCopy.nav.dashboard);
  await frame.waitForFunction(() => document.getElementById('stage').dataset.motion === 'false');
  await clickNav(manifest.title);
  await frame.waitForFunction(() => document.getElementById('stage').dataset.motion === 'true');
  mode = 'empty'; await frame.click('#refresh'); await settle(frame);
  assert.equal(await frame.$eval('#summary-corrective .metric-value', el => el.textContent), '0');
  await frame.click('#summary-diary');
  await frame.waitForFunction(text => document.getElementById('detail-status').textContent === text, {}, copy.diary.empty);
  mode = 'failure'; await frame.click('#refresh'); await settle(frame);
  assert.equal(await frame.$eval('#summary-corrective .metric-value', el => el.textContent), '—');
  assert.equal(await frame.$eval('#summary-corrective .module-secondary', el => el.textContent), copy.failed);
  mode = 'delay';
  const started = new Promise(resolve => { delayed = resolve; });
  await frame.click('#refresh'); await started;
  mode = 'normal'; await page.select('#sidebar-project-select', p2); await settle(frame);
  assert.equal(await frame.$eval('#detail-list', el => el.children.length), 0, 'Project changes must clear previous details');
  release(); await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(await frame.$eval('#summary-corrective .metric-value', el => el.textContent), '4', 'Old project response must never overwrite the new scope');
  assert.ok((await frame.$eval('#heading', el => el.textContent)).startsWith('Dev Project 2'));
  assert.deepEqual(errors, []);
  console.log('PASS: real SDK/project events with explicitly simulated responses; 3D motion/rotation, responsive layout, zero/error/empty, XSS and stale-scope protection.');
} finally { await browser.close(); }
