import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

if (!process.env.STUDIO5_ROOT) throw new Error('Set STUDIO5_ROOT.');
const puppeteer = createRequire(`${process.env.STUDIO5_ROOT}/package.json`)('puppeteer-core');
const plugin = new URL('../plugin/site-diorama/', import.meta.url);
const copy = JSON.parse(readFileSync(new URL('content.zh-Hant.json', plugin)));
const html = readFileSync(new URL('index.html', plugin), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>|<link\b[^>]*>/g, '');
const kit = readFileSync(`${process.env.STUDIO5_ROOT}/src/studio-kit.css`, 'utf8').replace('@import "./design-tokens.css";', readFileSync(`${process.env.STUDIO5_ROOT}/src/design-tokens.css`, 'utf8'));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852 });
  await page.setContent(html);
  await page.addStyleTag({ content: kit });
  await page.addStyleTag({ content: readFileSync(new URL('style.css', plugin), 'utf8') });
  await page.evaluate(copy => {
    for (const module of ['corrective', 'diary', 'inspection']) {
      const marker = document.getElementById(`marker-${module}`);
      marker.querySelector('.marker-title').textContent = copy[module].title;
      marker.querySelector('.marker-value').textContent = '1,104';
      marker.disabled = false;
    }
  }, copy);
  const bounds = () => page.$$eval('.marker', els => els.map(el => {
    const rect = el.getBoundingClientRect();
    return { height: rect.height, bottom: rect.bottom, stageBottom: el.parentElement.getBoundingClientRect().bottom };
  }));
  const normal = await bounds();
  await page.evaluate(copy => {
    document.getElementById('stage').classList.add('no-webgl');
    const error = document.getElementById('scene-error');
    error.textContent = copy.fallback;
    error.hidden = false;
  }, copy);
  const fallback = await bounds();
  for (let i = 0; i < fallback.length; i++) {
    assert.ok(Math.abs(fallback[i].height - normal[i].height) <= 1, `393px fallback marker ${i} must keep its content height: ${fallback[i].height} vs ${normal[i].height}`);
    assert.ok(Math.abs(fallback[i].bottom - normal[i].bottom) <= 1, `393px fallback marker ${i} must retain bottom placement`);
    assert.ok(fallback[i].bottom <= fallback[i].stageBottom, `393px fallback marker ${i} must stay inside the stage`);
  }
  console.log('PASS: 393px fallback markers retain content height and bottom placement.');
} finally { await browser.close(); }
