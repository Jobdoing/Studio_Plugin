import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const studioRoot = process.env.STUDIO5_ROOT || '/Volumes/AI-Model/Studio5';
const require = createRequire(join(studioRoot, 'package.json'));
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({
  executablePath: process.env.STUDIO5_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

try {
  const page = await browser.newPage();
  const formNumber = `CHECK-${Date.now()}`;
  await page.goto('http://127.0.0.1:5212/api/auth/dev-login?user=dev&id=inspection-request', { waitUntil: 'load' });
  await page.waitForSelector('#sidebar-project-select option[value="95f87b42-9292-4686-9cea-fba5e6114637"]');
  await page.select('#sidebar-project-select', '95f87b42-9292-4686-9cea-fba5e6114637');
  let frame = await waitForForm(page);
  assert.equal(await frame.$eval('[name="projectName"]', element => element.value), 'Dev Project 1');

  await frame.type('[name="formNumber"]', formNumber);
  await frame.type('[name="inspectionName"]', 'Concrete inspection');
  await frame.type('[name="work1"]', 'Column A');
  await frame.type('[name="item1"]', 'Rebar spacing');
  await frame.type('[name="work10"]', 'Final row');
  await frame.click('[name="attachmentSelfCheck"]');
  await frame.click('[name="conformance"][value="pass"]');
  await frame.click('#save-btn');
  await frame.waitForFunction(() => document.querySelector('#status')?.textContent === '已儲存。');
  await frame.click('#new-btn');
  assert.equal(await frame.$eval('[name="formNumber"]', element => element.value), '');
  await frame.waitForFunction(number => [...document.querySelectorAll('#record-list button')].some(button => button.textContent.includes(number)), {}, formNumber);
  await frame.evaluate(number => [...document.querySelectorAll('#record-list button')].find(button => button.textContent.includes(number)).click(), formNumber);
  await assertSavedValues(frame, formNumber);

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#sidebar-project-select option[value="95f87b42-9292-4686-9cea-fba5e6114637"]');
  await page.select('#sidebar-project-select', '95f87b42-9292-4686-9cea-fba5e6114637');
  frame = await waitForForm(page);
  await frame.waitForFunction(number => [...document.querySelectorAll('#record-list button')].some(button => button.textContent.includes(number)), {}, formNumber);
  await frame.evaluate(number => [...document.querySelectorAll('#record-list button')].find(button => button.textContent.includes(number)).click(), formNumber);
  await assertSavedValues(frame, formNumber);

  await page.select('#sidebar-project-select', 'd57ec5d0-ea86-42a2-a055-f1e760f77d6b');
  await frame.waitForFunction(() => document.querySelector('[name="projectName"]')?.value === 'Dev Project 2');
  assert.equal(await frame.$eval('[name="formNumber"]', element => element.value), '');
  assert.equal(await frame.$eval('#record-list', (element, number) => element.textContent.includes(number), formNumber), false);

  await page.select('#sidebar-project-select', '95f87b42-9292-4686-9cea-fba5e6114637');
  await frame.waitForFunction(number => [...document.querySelectorAll('#record-list button')].some(button => button.textContent.includes(number)), {}, formNumber);
  await frame.evaluate(number => [...document.querySelectorAll('#record-list button')].find(button => button.textContent.includes(number)).click(), formNumber);
  await frame.click('#print-btn');
  const preview = await page.waitForSelector('.print-preview-backdrop iframe');
  const printed = await preview.contentFrame();
  await printed.waitForSelector('.paper');
  assert.equal(await printed.$eval('[name="formNumber"]', element => element.value), formNumber);
  assert.equal(await printed.$eval('[name="attachmentSelfCheck"]', element => element.checked), true);
  assert.equal(await printed.$$eval('.detail-table tbody tr', rows => rows.length), 10);
  assert.equal(await printed.$eval('.screen-only', element => getComputedStyle(element).display), 'none');
  console.log('PASS: project prefill, save, reopen, reload, isolation, and print preview');
} finally {
  await browser.close();
}

async function waitForForm(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some(frame => frame.src.includes('/blocks/inspection-request/')));
  const frame = page.frames().find(candidate => candidate.url().includes('/blocks/inspection-request/'));
  await frame.waitForSelector('#request-form:not([hidden])');
  return frame;
}

async function assertSavedValues(frame, formNumber) {
  const values = await frame.evaluate(() => ({
    projectName: document.querySelector('[name="projectName"]').value,
    formNumber: document.querySelector('[name="formNumber"]').value,
    inspectionName: document.querySelector('[name="inspectionName"]').value,
    work1: document.querySelector('[name="work1"]').value,
    item1: document.querySelector('[name="item1"]').value,
    work10: document.querySelector('[name="work10"]').value,
    attachmentSelfCheck: document.querySelector('[name="attachmentSelfCheck"]').checked,
    conformance: document.querySelector('[name="conformance"][value="pass"]').checked,
  }));
  assert.deepEqual(values, {
    projectName: 'Dev Project 1', formNumber, inspectionName: 'Concrete inspection',
    work1: 'Column A', item1: 'Rebar spacing', work10: 'Final row',
    attachmentSelfCheck: true, conformance: true,
  });
}
