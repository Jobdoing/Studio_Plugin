// Browser RWD check. Start Studio5's harness first:
//   node scripts/plugin-dev.mjs --blocks <this repo>/jobsite-toolbox/plugin --port 5210
// NOTE(ceiling): puppeteer-core and Chrome paths are this machine's; set STUDIO5_ROOT / CHROME to move it.
import { createRequire } from 'node:module';
if (!process.env.STUDIO5_ROOT) throw new Error('Set STUDIO5_ROOT to a Studio5 checkout with npm ci done (it provides puppeteer-core)');
const require = createRequire(`${process.env.STUDIO5_ROOT}/package.json`);
const puppeteer = require('puppeteer-core');
const base = 'http://127.0.0.1:5210';
const shots = process.env.SHOTS_DIR; // optional folder for a 320 px screenshot

// The same worked examples the UI offers through "帶入範例" (spec-derived expected values).
import '../plugin/jobsite-toolbox/examples.js';
const examples = globalThis.toolboxExamples;
const close = (shown, want) => Math.abs(Number(shown) - want) <= Math.max(1e-6, Math.abs(want) * 1e-6);

const failures = [];
const pluginFrame = async page => {
  for (let i = 0; i < 100; i++) {
    const frame = page.frames().find(f => f.url().includes('/blocks/jobsite-toolbox/'));
    if (frame && await frame.$('.kit-launcher-tile').catch(() => null)) return frame;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
};
const check = (ok, message) => { if (!ok) failures.push(message); };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`${msg.text()} @ ${msg.location().url}`); });
page.on('pageerror', err => consoleErrors.push(String(err)));
const badResponses = [];
page.on('response', res => { if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url()}`); });
// studio.copy writes from the host window; record what it writes instead of touching the real clipboard.
await page.evaluateOnNewDocument(() => {
  if (window.top !== window) return;
  window.__copied = [];
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: text => { window.__copied.push(text); return Promise.resolve(); } } });
});
await page.goto(`${base}/api/auth/dev-login?user=dev`, { waitUntil: 'domcontentloaded' });

for (const [width, mobile] of [[320, true], [375, true], [1024, false]]) {
  await page.setViewport({ width, height: 800, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${base}/app/jobsite-toolbox`, { waitUntil: 'load' });
  const frame = await pluginFrame(page);
  check(frame, `${width}: plugin iframe not found`);
  if (!frame) continue;
  const tools = await frame.$$eval('.kit-launcher-tile', tiles => tiles.filter(t => t.offsetParent !== null).map(t => t.dataset.id));
  const webOnly = ['tileLayout', 'ceilingGrid', 'formworkPressure', 'adhesive', 'coverage', 'grout', 'gypsum', 'cutFill', 'membrane', 'voltageDrop', 'pipePressureLoss'];
  check(tools.length === (mobile ? 21 : 32), `${width}: expected ${mobile ? 21 : 32} visible tools, got ${tools.length}`);
  check(webOnly.every(tool => tools.includes(tool) !== mobile), `${width}: web-only tiles ${mobile ? 'shown on phone' : 'missing on desktop'}`);
  for (const tool of tools) {
    const expected = examples[tool].expect;
    const state = await frame.evaluate(tool => {
      document.querySelector(`.kit-launcher-tile[data-id="${tool}"]`).click();
      const homeHidden = document.querySelector('.tool-home').offsetParent === null;
      const visible = [...document.querySelectorAll('.tool-panel')].filter(p => p.offsetParent !== null);
      const panel = document.querySelector(`.tool-panel[data-tool="${tool}"]`);
      panel.querySelector('.tool-example').click();
      const exampleNote = panel.querySelector('.example-note').offsetParent !== null;
      const results = Object.fromEntries([...panel.querySelectorAll('[data-result]')].map(n => [n.dataset.result, n.textContent.replaceAll(',', '')]));
      const output = panel.querySelector('.tool-output');
      const unitsOk = [...panel.querySelectorAll('.kit-stat')].every(stat => stat.hidden || stat.querySelector('.kit-stat-unit')?.textContent.trim());
      const hiddenModeFields = [...panel.querySelectorAll('[data-mode][hidden]')].map(f => ({ rendered: f.offsetParent !== null, disabled: f.querySelector('input, select').disabled }));
      const extra = {
        svgRects: panel.querySelectorAll('.tile-diagram rect').length,
        cutRows: panel.querySelectorAll('.tile-cutlist tr').length - 1,
        cells: [...panel.querySelectorAll('.cell-list li')].map(li => li.textContent),
      };
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const box = panel.getBoundingClientRect();
      const fieldsInside = [...panel.querySelectorAll('input, select, textarea')].filter(el => el.offsetParent !== null)
        .every(el => { const r = el.getBoundingClientRect(); return r.left >= box.left - .5 && r.right <= box.right + .5; });
      // Invalid input: first numeric field negative must hide results and show the error.
      const first = panel.querySelector('input[inputmode]:not(:disabled)');
      const keep = first.value;
      // Elevation fields accept negatives; for them '-1' must be accepted and '--1' rejected instead.
      const negativeOk = 'allowNegative' in first.dataset;
      let negativeAccepted = true;
      if (negativeOk) {
        first.value = '-1';
        first.dispatchEvent(new Event('input', { bubbles: true }));
        negativeAccepted = !output.hidden;
      }
      const rejects = [negativeOk ? '--1' : '-1', '0x10', '.'].map(bad => {
        first.value = bad;
        first.dispatchEvent(new Event('input', { bubbles: true }));
        return output.hidden && !panel.querySelector('.tool-error').hidden;
      });
      // Measured fields are not credentials: without autocomplete=off Safari offers iCloud Passwords on them.
      const autofillOff = [...panel.querySelectorAll('input, textarea')].every(el => el.autocomplete === 'off');
      const invalid = { outputHidden: rejects.every(Boolean), errorShown: rejects.every(Boolean), negativeAccepted };
      // Measured values must not be number inputs (a focused number input changes on mouse wheel).
      const wheelSafe = [...panel.querySelectorAll('input[inputmode="decimal"]')].every(i => i.type === 'text' && i.pattern);
      first.value = keep;
      first.dispatchEvent(new Event('input', { bubbles: true }));
      return { autofillOff, exampleNote, wheelSafe, fieldsInside, homeHidden, visible: visible.map(p => p.dataset.tool), outputShown: !output.hidden, results, unitsOk, hiddenModeFields, extra, overflow, invalid,
        docHeight: document.documentElement.scrollHeight };
    }, tool);
    check(state.homeHidden, `${width} ${tool}: tile home still shown`);
    check(state.visible.length === 1 && state.visible[0] === tool, `${width} ${tool}: visible panels ${state.visible}`);
    check(state.outputShown, `${width} ${tool}: output not shown`);
    check(state.exampleNote, `${width} ${tool}: example note not shown after 帶入範例`);
    for (const [key, value] of Object.entries(expected)) check(close(state.results[key], value), `${width} ${tool}: ${key}=${state.results[key]} expected ${value}`);
    check(state.unitsOk, `${width} ${tool}: a shown result lacks a unit`);
    check(state.autofillOff, `${width} ${tool}: an input lacks autocomplete=off (password autofill prompt)`);
    check(!state.overflow, `${width} ${tool}: horizontal overflow inside plugin`);
    check(state.fieldsInside, `${width} ${tool}: a field spills outside its card`);
    check(state.invalid.outputHidden && state.invalid.errorShown, `${width} ${tool}: invalid input (-1, 0x10 or .) not rejected`);
    check(state.invalid.negativeAccepted, `${width} ${tool}: negative elevation rejected`);
    check(state.wheelSafe, `${width} ${tool}: a measured field is not type=text with a pattern`);
    for (const f of state.hiddenModeFields) check(!f.rendered && f.disabled, `${width} ${tool}: hidden mode field still rendered (Kit [hidden])`);
    if (tool === 'slope') check(state.hiddenModeFields.length === 1, `${width} slope: expected one hidden field`);
    if (tool === 'tileLayout') check(state.extra.svgRects === 2 && state.extra.cutRows === 1, `${width} tileLayout: rects ${state.extra.svgRects}, cut rows ${state.extra.cutRows}`);
    if (tool === 'cutFill') check(state.extra.cells.length === 4 && state.extra.cells.filter(c => c.includes('高差最大')).length === 1 && state.extra.cells.filter(c => c.includes('需細分')).length === 2, `${width} cutFill: cells ${state.extra.cells}`);
    const outer = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, iframe: document.querySelector('iframe')?.getBoundingClientRect().height }));
    check(!outer.overflow, `${width} ${tool}: shell horizontal overflow`);
    // The SDK reports height asynchronously; allow up to 2 s before calling it broken.
    let iframeHeight, docHeight;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 100));
      iframeHeight = await page.evaluate(() => document.querySelector('iframe').getBoundingClientRect().height);
      docHeight = await frame.evaluate(() => document.documentElement.scrollHeight);
      if (Math.abs(iframeHeight - docHeight) <= 2) break;
    }
    check(Math.abs(iframeHeight - docHeight) <= 2, `${width} ${tool}: iframe ${iframeHeight} vs content ${docHeight} (auto-height)`);
    if (tool === 'pipePressureLoss') {
      const computed = await frame.evaluate(() => {
        const panel = document.querySelector('.tool-panel[data-tool="pipePressureLoss"]');
        const mode = panel.querySelector('[name="mode"]');
        mode.value = 'computed';
        mode.dispatchEvent(new Event('change', { bubbles: true }));
        const shown = name => panel.querySelector(`[name="${name}"]`).closest('.kit-field').offsetParent !== null;
        const layout = { roughness: shown('roughness'), viscosity: shown('viscosity'), manualHidden: !shown('frictionFactor'), manualDisabled: panel.querySelector('[name="frictionFactor"]').disabled };
        for (const [name, value] of [['roughness', '0.000481584'], ['viscosity', '1.12208']]) {
          const input = panel.querySelector(`[name="${name}"]`);
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const text = key => panel.querySelector(`[data-result="${key}"]`).textContent.replaceAll(',', '');
        const out = { ...layout, reynolds: Number(text('reynolds')), f: Number(text('frictionFactor')), method: text('frictionMethod') };
        mode.value = 'manual';
        mode.dispatchEvent(new Event('change', { bubbles: true }));
        return out;
      });
      check(computed.roughness && computed.viscosity && computed.manualHidden && computed.manualDisabled && Math.abs(computed.reynolds - 41578) < 5 && computed.f.toFixed(5) === '0.02186' && computed.method.includes('Manadilli'),
        `${width} pipePressureLoss computed mode: ${JSON.stringify(computed)}`);
    }
    if (tool === 'sidewallPressure') {
      const single = await frame.evaluate(() => {
        const panel = document.querySelector('.tool-panel[data-tool="sidewallPressure"]');
        const mode = panel.querySelector('[name="mode"]');
        mode.value = 'single';
        mode.dispatchEvent(new Event('change', { bubbles: true }));
        const field = panel.querySelector('[name="weightFactor"]');
        const out = { wHidden: field.closest('.kit-field').offsetParent === null, wDisabled: field.disabled,
          pressure: Number(panel.querySelector('[data-result="pressure"]').textContent.replaceAll(',', '')) };
        mode.value = 'cradled';
        mode.dispatchEvent(new Event('change', { bubbles: true }));
        return out;
      });
      check(single.wHidden && single.wDisabled && Math.abs(single.pressure - 25.67222989) < 1e-6,
        `${width} sidewallPressure single mode: ${JSON.stringify(single)}`);
    }
    if (tool === 'staking') {
      // Signed elevations keep the numeric keypad; the Kit ± button flips the sign and recalculates.
      const sign = await frame.evaluate(() => {
        const panel = document.querySelector('.tool-panel[data-tool="staking"]');
        const measured = panel.querySelector('[name="measured"]');
        const buttons = panel.querySelectorAll('.kit-sign-toggle');
        const before = panel.querySelector('[data-result="difference"]').textContent;
        const noteBefore = !panel.querySelector('.example-note').hidden;
        measured.previousElementSibling.click();
        const noteAfter = !panel.querySelector('.example-note').hidden;
        const flipped = { value: measured.value, fillShown: !panel.querySelector('[data-optional="fill"]').hidden };
        measured.previousElementSibling.click();
        return { buttons: buttons.length, modes: [...panel.querySelectorAll('[data-allow-negative]')].map(i => i.inputMode),
          before, flipped, restored: measured.value, noteBefore, noteAfter };
      });
      check(sign.buttons === 2 && sign.modes.every(m => m === 'decimal') && sign.flipped.value === '-12.735' && sign.flipped.fillShown && sign.restored === '12.735' && sign.noteBefore && !sign.noteAfter,
        `${width} staking ± toggle: ${JSON.stringify(sign)}`);
    }
    if (tool === 'formworkPressure') {
      // A real select change fires 'input' before 'change'; switching codes must not throw a page error.
      const errorsBefore = consoleErrors.length;
      await frame.select('#formworkPressure-mode', 'jass5');
      await frame.evaluate(() => {
        const weight = document.querySelector('#formworkPressure-unitWeight');
        weight.value = '24';
        weight.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await frame.select('#formworkPressure-mode', 'aci');
      await new Promise(r => setTimeout(r, 200));
      check(consoleErrors.length === errorsBefore, `${width} formworkPressure select switch threw: ${consoleErrors.slice(errorsBefore).join(' | ')}`);
      const jass = await frame.evaluate(() => {
        const panel = document.querySelector('.tool-panel[data-tool="formworkPressure"]');
        const mode = panel.querySelector('[name="mode"]');
        mode.value = 'jass5';
        mode.dispatchEvent(new Event('change', { bubbles: true }));
        const member = panel.querySelector('[name="member"]');
        const weight = panel.querySelector('[name="unitWeight"]');
        weight.value = '24';
        weight.dispatchEvent(new Event('input', { bubbles: true }));
        const out = { memberHidden: member.closest('.kit-field').offsetParent === null, memberDisabled: member.disabled,
          pressure: Number(panel.querySelector('[data-result="pressure"]').textContent.replaceAll(',', '')) };
        mode.value = 'aci';
        mode.dispatchEvent(new Event('change', { bubbles: true }));
        return out;
      });
      check(jass.memberHidden && jass.memberDisabled && Math.abs(jass.pressure - 24 * 3.048) < 1e-6, `${width} formworkPressure JASS 5 mode: ${JSON.stringify(jass)}`);
    }
    if (tool === 'conduitFill') {
      const rows = await frame.evaluate(() => {
        const panel = document.querySelector('.tool-panel[data-tool="conduitFill"]');
        const fill = () => panel.querySelector('[data-result="fill"]').textContent;
        const single = panel.querySelector('.row-remove').disabled;
        const oneRow = fill();
        panel.querySelector('.row-add').click();
        const second = panel.querySelectorAll('.cable-row')[1];
        const focusedNewRow = document.activeElement === second.querySelector('input');
        for (const [name, value] of [['cableDiameter', 20], ['cableCount', 1]]) {
          const input = second.querySelector(`[name="${name}"]`);
          input.value = String(value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const ids = [...panel.querySelectorAll('.cable-row input')].map(i => i.id);
        const labelsOk = [...panel.querySelectorAll('.cable-row label')].every(l => document.getElementById(l.htmlFor));
        const twoRows = fill();
        second.querySelector('.row-remove').click();
        return { oneRow, single, focusedNewRow, twoRows, back: fill(), unique: new Set(ids).size === ids.length, labelsOk,
          legend: second.querySelector('legend').textContent, left: panel.querySelectorAll('.cable-row').length };
      });
      check(rows.single && rows.focusedNewRow && rows.twoRows !== rows.oneRow && rows.back === rows.oneRow && rows.unique && rows.labelsOk && rows.legend === '第 2 條' && rows.left === 1,
        `${width} conduitFill rows: ${JSON.stringify(rows)}`);
    }
    if (tool === 'tileLayout') {
      await frame.evaluate(() => document.querySelector('.tool-panel[data-tool="tileLayout"] .tool-copy').click());
      await new Promise(r => setTimeout(r, 300));
      const copied = (await page.evaluate(() => window.__copied)).at(-1) ?? '';
      check(copied.includes('切片寬 × 高（mm）\t片數') && /\n[0-9.,]+ × [0-9.,]+\t1(\n|$)/.test(copied), `${width}: tileLayout cut list copy ${JSON.stringify(copied)}`);
    }
    if (tool === 'outrigger') {
      await frame.evaluate(() => document.querySelector('.tool-panel[data-tool="outrigger"] .tool-copy').click());
      await new Promise(r => setTimeout(r, 300));
      const copied = (await page.evaluate(() => window.__copied)).at(-1) ?? '';
      check(copied.includes('最大單支腿反力 F：1,108.15145') && copied.includes('有效接地面積 A：9') && copied.includes('平均接地壓力：123.1279'),
        `${width}: outrigger copy lacks F/A ${JSON.stringify(copied)}`);
    }
    if (tool === 'sealant') {
      await frame.evaluate(() => document.querySelector('.tool-panel[data-tool="sealant"] .tool-copy').click());
      await new Promise(r => setTimeout(r, 300));
      const copied = (await page.evaluate(() => window.__copied)).at(-1) ?? '';
      check(copied.startsWith('接縫填料\n') && copied.includes('採購整支數：59支'), `${width}: copy wrote ${JSON.stringify(copied)}`);
    }
    await frame.evaluate(() => document.querySelector('.tool-back').click());
    const backHome = await frame.evaluate(() => document.querySelector('.tool-home').offsetParent !== null && document.querySelectorAll('.tool-panel:not([hidden])').length === 0);
    check(backHome, `${width} ${tool}: back button did not return to tiles`);
  }
  // Phone/browser back from a tool returns to the tile home (studio.setRoute + onRoute).
  // Real input, not a DOM click: a finger tap on phones, a mouse click on desktop.
  // ElementHandle.tap/click scroll the tile into view first (19 tiles no longer fit one phone screen).
  const slab = await frame.$('.kit-launcher-tile[data-id="slab"]');
  if (mobile) await slab.tap();
  else await slab.click();
  await new Promise(r => setTimeout(r, 200));
  const tapped = await frame.evaluate(() => [...document.querySelectorAll('.tool-panel:not([hidden])')].map(p => p.dataset.tool).join());
  check(tapped === 'slab', `${width}: real ${mobile ? 'tap' : 'click'} opened "${tapped}"`);
  const typeScale = await frame.evaluate(() => {
    const size = el => parseFloat(getComputedStyle(el).fontSize);
    const h2 = document.querySelector('.tool-panel[data-tool="slab"] h2');
    return { h1: size(document.querySelector('h1')), h2: size(h2), p: size(document.querySelector('.toolbox-header p')),
      focused: document.activeElement === h2, outline: getComputedStyle(h2).outlineStyle };
  });
  check(typeScale.h1 > typeScale.h2 && typeScale.h2 > typeScale.p, `${width}: heading sizes h1 ${typeScale.h1} h2 ${typeScale.h2} p ${typeScale.p}`);
  check(typeScale.focused && typeScale.outline === 'none', `${width}: tool heading focus=${typeScale.focused} outline=${typeScale.outline}`);
  check(page.url().includes('r=%2Fslab') || page.url().includes('r=/slab'), `${width}: route not written: ${page.url()}`);
  await page.goBack();
  await new Promise(r => setTimeout(r, 300));
  const afterBack = await frame.evaluate(() => [document.querySelector('.tool-home').hidden, [...document.querySelectorAll('.tool-panel:not([hidden])')].map(p => p.dataset.tool)]);
  check(!afterBack[0] && afterBack[1].length === 0, `${width}: history back did not show tiles (home hidden=${afterBack[0]}, panels=${afterBack[1]})`);
  // Deep link opens the tool directly.
  await page.goto(`${base}/app/jobsite-toolbox?r=/cutFill`, { waitUntil: 'load' });
  const linked = await pluginFrame(page);
  const deep = await linked.evaluate(() => [...document.querySelectorAll('.tool-panel:not([hidden])')].map(p => p.dataset.tool).join());
  check(deep === 'cutFill', `${width}: deep link showed ${deep}`);
  await page.goto(`${base}/app/jobsite-toolbox`, { waitUntil: 'load' });
  const f2 = await pluginFrame(page);
  await new Promise(r => setTimeout(r, 500)); // let the saved order load
  const order = () => f2.$$eval('.kit-launcher-tile', tiles => tiles.filter(t => t.offsetParent !== null).map(t => t.dataset.id));
  const before = await order();
  // Drag the first tile onto the third: touch long-press on phones, direct mouse drag on desktop.
  const a = await (await f2.$(`.kit-launcher-tile[data-id="${before[0]}"]`)).boundingBox();
  const c = await (await f2.$(`.kit-launcher-tile[data-id="${before[2]}"]`)).boundingBox();
  const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const to = { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  if (mobile) {
    await page.touchscreen.touchStart(from.x, from.y);
    await new Promise(r => setTimeout(r, 700));
    for (let i = 1; i <= 8; i++) await page.touchscreen.touchMove(from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8);
    await page.touchscreen.touchEnd();
  } else {
    // Mouse drags directly (no long press since Studio5 5f8197f); the drag ghost follows the pointer
    // (3e546e8) and a drag across the page header must not select any text.
    const h1 = await (await f2.$('h1')).boundingBox();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 10, { steps: 4 });
    const ghostAt = () => f2.evaluate(() => { const g = document.querySelector('.kit-sortable-ghost'); if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.x, y: r.y }; });
    const ghost1 = await ghostAt();
    await page.mouse.move(h1.x + h1.width / 2, h1.y + h1.height / 2, { steps: 6 });
    const ghost2 = await ghostAt();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    check(ghost1 && ghost2 && (Math.abs(ghost2.x - ghost1.x) > 5 || Math.abs(ghost2.y - ghost1.y) > 5), `${width}: drag ghost did not follow the pointer ${JSON.stringify([ghost1, ghost2])}`);
    const leftovers = await f2.evaluate(() => ({ ghost: !!document.querySelector('.kit-sortable-ghost'), selection: String(getSelection()) }));
    check(!leftovers.ghost && leftovers.selection === '', `${width}: after drag ghost=${leftovers.ghost} selection="${leftovers.selection}"`);
  }
  const dragged = await order();
  check(dragged.indexOf(before[0]) === 2, `${width}: drag did not move ${before[0]} to 3rd: ${dragged}`);
  const stillHome = await f2.evaluate(() => document.querySelector('.tool-home').offsetParent !== null);
  check(stillHome, `${width}: long-press drag opened a tool`);
  // A quick swipe (no long press) must not reorder.
  const b = await (await f2.$(`.kit-launcher-tile[data-id="${dragged[1]}"]`)).boundingBox();
  if (mobile) {
    await page.touchscreen.touchStart(b.x + 10, b.y + 10);
    for (let i = 1; i <= 5; i++) await page.touchscreen.touchMove(b.x + 10, b.y + 10 + i * 15);
    await page.touchscreen.touchEnd();
    check((await order()).join() === dragged.join(), `${width}: swipe reordered tiles`);
  }
  // Keyboard: Alt+ArrowDown moves the focused tile one place later (studio.kit.sortable).
  await f2.focus(`.kit-launcher-tile[data-id="${dragged[0]}"]`);
  await page.keyboard.down('Alt');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Alt');
  const keyed = await order();
  check(keyed[1] === dragged[0] && keyed[0] === dragged[1], `${width}: arrow key move failed ${keyed}`);
  if (mobile) {
    // Put a hidden (web-only) tile between the first two visible ones; sortable reads DOM order.
    const beforeHidden = await f2.evaluate(() => {
      const all = [...document.querySelectorAll('.kit-launcher-tile')];
      const shown = all.filter(t => t.offsetParent !== null);
      const hidden = all.find(t => t.offsetParent === null);
      shown[1].before(hidden);
      return shown[0].dataset.id;
    });
    check(beforeHidden, `${width}: no visible tile sits before a hidden one, Alt+Arrow skip case not exercised`);
    if (beforeHidden) {
      const shown = await order();
      await f2.focus(`.kit-launcher-tile[data-id="${beforeHidden}"]`);
      await page.keyboard.down('Alt');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.up('Alt');
      check((await order()).join() !== shown.join(), `${width}: Alt+ArrowDown next to a hidden tile changed nothing visible`);
    }
  }
  const saved = await order();
  await new Promise(r => setTimeout(r, 800)); // let records.put finish
  const status = await f2.$eval('#order-status', n => n.textContent);
  check(status.includes('已儲存'), `${width}: order save status "${status}"`);
  // Saved order is per account: survives a reload.
  await page.reload({ waitUntil: 'load' });
  const f3 = await pluginFrame(page);
  await new Promise(r => setTimeout(r, 800));
  const reloaded = await f3.$$eval('.kit-launcher-tile', tiles => tiles.filter(t => t.offsetParent !== null).map(t => t.dataset.id));
  check(reloaded.join() === saved.join(), `${width}: saved order lost after reload ${reloaded}`);
  if (width === 1024) {
    // An order saved before a tool existed (27 ids, no 'coverage') must still show the new tile.
    await f3.evaluate(async () => {
      const ids = [...document.querySelectorAll('.kit-launcher-tile')].map(t => t.dataset.id).filter(id => id !== 'coverage');
      await studio.records.put('preferences', 'tile-order', { scope: 'user', body: { order: ids } });
    });
    await page.reload({ waitUntil: 'load' });
    const f4 = await pluginFrame(page);
    await new Promise(r => setTimeout(r, 800));
    const merged = await f4.$$eval('.kit-launcher-tile', tiles => tiles.filter(t => t.offsetParent !== null).map(t => t.dataset.id));
    check(merged.length === 32 && merged.includes('coverage'), `${width}: new tile missing after an older saved order ${merged}`);
  }
  if (width === 320 && shots) await page.screenshot({ path: `${shots}/shell-320.png`, fullPage: true });
}
console.log('HTTP >= 400:', [...new Set(badResponses)].join('\n  ') || 'none');
check(badResponses.length === 0, 'unexpected HTTP errors');
check(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);
await browser.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('Browser checks passed at 320/375/1024: 21 phone / 32 desktop tools, tile home, back, deep link, drag, keyboard, copy, saved order, new tile after old order.');
