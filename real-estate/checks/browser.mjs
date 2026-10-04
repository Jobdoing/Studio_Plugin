import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mapsUrl } from '../plugin/real-estate/data.mjs';

if (!process.env.STUDIO5_ROOT || !process.env.EVIDENCE_DIR) throw new Error('Set STUDIO5_ROOT and EVIDENCE_DIR. Start the plugin-dev harness on port 5220 first.');
const require = createRequire(`${process.env.STUDIO5_ROOT}/package.json`);
const puppeteer = require('puppeteer-core');
const copy = JSON.parse(readFileSync(new URL('../plugin/real-estate/content.zh-Hant.json', import.meta.url)));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const base = 'http://127.0.0.1:5220';
const errors = [];
const injectedConsole = [];
page.on('pageerror', err => errors.push(err.message));
const isRelay = url => url.includes('/api/app/http/real-estate?');
let mode = 'live';
let release;
let injectedItems = [];
page.on('console', msg => {
  if (msg.type() !== 'error') return;
  const expected = (mode === 'rate' && msg.text().includes('429')) || (mode === 'failure' && msg.text().includes('503'));
  if (expected && isRelay(msg.location().url)) injectedConsole.push(msg.text());
  else errors.push(msg.text());
});
await page.setRequestInterception(true);
page.on('request', async request => {
  if (!isRelay(request.url()) || mode === 'live') return request.continue();
  const status = mode === 'rate' ? 429 : mode === 'failure' ? 503 : 200;
  if (mode === 'slow') await new Promise(resolve => { release = resolve; });
  await request.respond({ status, contentType: 'application/json', body: JSON.stringify({ items: mode === 'text' ? injectedItems : [] }) });
});

async function settle(frame) {
  await frame.waitForFunction(() => document.getElementById('search-form').getAttribute('aria-busy') === 'false');
}

async function checkLayout(frame, width) {
  const result = await frame.evaluate(() => {
    const doc = document.documentElement;
    return { overflow: doc.scrollWidth > doc.clientWidth, unlabeled: [...document.querySelectorAll('input, select')].filter(el => !document.querySelector(`label[for="${el.id}"]`)).length,
      controls: [...document.querySelectorAll('button, input, select')].filter(el => el.offsetParent !== null).every(el => el.getBoundingClientRect().height >= 43) };
  });
  assert.equal(result.overflow, false, `${width}: plugin overflow`);
  assert.equal(result.unlabeled, 0);
  assert.equal(result.controls, true, `${width}: control below touch target size`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${width}: shell overflow`);
}

try {
  await page.goto(`${base}/api/auth/dev-login?user=dev`);
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`${base}/app/real-estate`);
    await page.waitForSelector('iframe');
    const frame = await (await page.$('iframe')).contentFrame();
    await frame.waitForFunction(() => !document.getElementById('search').disabled);
    assert.equal(await frame.$eval('#list', el => el.children.length), 0, 'No automatic data query');
    await frame.type('#town', copy.townPlaceholder.split('：')[1]);
    const responsePromise = page.waitForResponse(response => isRelay(response.url()));
    await frame.click('#search');
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const live = await response.json();
    assert.ok(live.items.length > 0, 'Live query must return transactions');
    await settle(frame);
    assert.equal(await frame.$eval('#list', el => el.children.length), live.items.length);
    assert.equal(await frame.$eval('#error', el => el.hidden), true);
    const first = live.items[0];
    const format = value => new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 10000);
    assert.equal(await frame.$eval('[data-price="total"]', el => el.firstChild.textContent), format(first.total_price));
    assert.equal(await frame.$eval('[data-price="unit"]', el => el.firstChild.textContent), format(first.unit_price_ping));
    assert.equal(await frame.$eval('.transaction h3', el => el.textContent), first.community_name || first.address_norm);
    await checkLayout(frame, width);
    await page.screenshot({ path: `${process.env.EVIDENCE_DIR}/query-${width}.png`, fullPage: true });
    if (width !== 1024) continue;

    const popupPromise = browser.waitForTarget(target => target.type() === 'page' && target.url().startsWith('https://www.google.com/maps/'), { timeout: 10000 });
    await frame.click('.transaction button');
    await page.waitForSelector('.plugin-confirm-backdrop');
    assert.ok(await page.$eval('.plugin-confirm-backdrop', el => el.textContent.includes('www.google.com')));
    await page.click('.plugin-confirm-actions button:first-child');
    const popup = await (await popupPromise).page();
    assert.ok(popup.url().startsWith('https://www.google.com/maps/'));
    assert.equal(new URL(popup.url()).searchParams.get('query'), new URL(mapsUrl(first.address_norm)).searchParams.get('query'));
    await popup.close();

    const secondResponsePromise = page.waitForResponse(response => isRelay(response.url()));
    await frame.click('#next');
    const secondResponse = await secondResponsePromise;
    const target = new URL(new URL(secondResponse.url()).searchParams.get('url'));
    assert.equal(target.searchParams.get('offset'), '20');
    assert.equal(target.searchParams.get('town'), copy.townPlaceholder.split('：')[1]);
    await settle(frame);
    const second = await secondResponse.json();
    assert.notEqual(second.items[0].transaction_id, first.transaction_id);
    assert.equal(await frame.$eval('#range', el => el.textContent), copy.pageRange.replace('{start}', '21').replace('{end}', String(20 + second.items.length)));

    // These injected responses only verify error/empty UI, never live data availability.
    for (const [injected, expected] of [['rate', copy.rateLimited], ['failure', copy.failed], ['empty', copy.pageEmpty]]) {
      mode = injected;
      await frame.click(injected === 'rate' ? '#next' : '#retry');
      await settle(frame);
      const selector = injected === 'empty' ? '#status' : '#error-message';
      assert.equal(await frame.$eval(selector, el => el.textContent), expected);
      assert.equal(await frame.$eval('#list', el => el.children.length), 0, 'Failed or empty query must clear old cards');
      assert.equal(await frame.$eval('#previous', el => el.disabled), false);
    }
    mode = 'slow';
    await frame.click('#search');
    await frame.waitForFunction(() => document.getElementById('search-form').getAttribute('aria-busy') === 'true');
    while (!release) await new Promise(resolve => setTimeout(resolve, 10));
    await frame.type('#address', 'obsolete-query-check');
    assert.equal(await frame.$eval('#status', el => el.textContent), copy.ready);
    release();
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await frame.$eval('#results', el => el.hidden), true, 'Old response cannot overwrite changed filters');

    mode = 'text';
    const hostileText = '<img src=x onerror="throw new Error(\'unsafe data\')">';
    injectedItems = [{ ...first, community_name: '', address_norm: hostileText }];
    await frame.click('#search');
    await settle(frame);
    assert.equal(await frame.$eval('.transaction h3', el => el.textContent), hostileText);
    assert.equal(await frame.$eval('#list', el => el.querySelectorAll('img, script').length), 0, 'Source text must never become executable markup');

    mode = 'live';
    await frame.$eval('#address', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await frame.focus('#address');
    await page.keyboard.press('Enter');
    await settle(frame);
    assert.ok(await frame.$eval('#list', el => el.children.length > 0), 'Enter must submit the form');
  }
  assert.deepEqual(errors, []);
  assert.equal(injectedConsole.length, 2, 'Only the deliberately injected 429 and 503 resource errors are expected');
  console.log('PASS: real Studio5 SDK and live data, units, pagination, Maps popup, 4 responsive widths, keyboard, injected errors/empty state, text safety and stale-response protection. Live console clean; two expected resource errors from injected 429/503.');
} finally {
  await browser.close();
}
