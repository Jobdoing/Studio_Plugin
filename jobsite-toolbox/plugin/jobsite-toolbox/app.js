const calculate = globalThis.toolboxCalculate;
const panels = [...document.querySelectorAll('.tool-panel')];
const numberFormat = new Intl.NumberFormat('zh-TW', { maximumSignificantDigits: 10 });

// Fields tagged data-mode show (and submit) only for the selected [name="mode"] option.
function updateModeFields(panel) {
  const mode = panel.querySelector('[name="mode"]').value;
  for (const field of panel.querySelectorAll('[data-mode]')) {
    const active = field.dataset.mode.split(' ').includes(mode);
    field.hidden = !active;
    field.querySelector('input, select').disabled = !active;
  }
}

function readValues(panel) {
  const values = {};
  // Repeated row fields (data-list) collect into arrays in row order.
  const store = (input, value) => {
    if ('list' in input.dataset) (values[input.name] ??= []).push(value);
    else values[input.name] = value;
  };
  let touched = false;
  let valid = true;
  for (const input of panel.querySelectorAll('input, select, textarea')) {
    if (input.disabled) continue;
    if (input.tagName === 'SELECT') {
      values[input.name] = input.value;
      continue;
    }
    const raw = input.value.trim();
    if (raw) touched = true;
    if (!raw) {
      if (input.required) valid = false;
      store(input, null);
      continue;
    }
    // Free text (a textarea grid, or a plain text field such as a data source) stays a string.
    if (input.tagName === 'TEXTAREA' || (input.type === 'text' && !input.inputMode)) {
      store(input, raw);
      continue;
    }
    // Measured values are text inputs (no wheel nudging); their pattern is the accepted number format.
    if (input.pattern && !new RegExp(`^(?:${input.pattern})$`).test(raw)) valid = false;
    const value = Number(raw);
    const tooLow = 'allowNegative' in input.dataset ? false : 'allowZero' in input.dataset ? value < 0 : value <= 0;
    const tooHigh = input.max !== '' && value > Number(input.max);
    if (!Number.isFinite(value) || tooLow || tooHigh ||
      (input.step === '1' && !Number.isInteger(value))) valid = false;
    store(input, value);
  }
  return { values, valid, touched };
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  return node;
}

// Scale drawing in mm; y runs from the bottom edge up, matching the "left/bottom" start option.
function drawTiles(container, result, { joint, tileWidth, tileHeight }) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const span = (pieces, gaps) => gaps[0] + gaps[1] + pieces.reduce((sum, piece) => sum + piece, 0) + (pieces.length - 1) * joint;
  const width = span(result.xs, result.xGaps);
  const height = span(result.ys, result.yGaps);
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `排版示意：面寬方向 ${result.xs.length} 片、面高方向 ${result.ys.length} 片；實線整磚、虛線切磚`);
  let y = height - result.yGaps[0];
  for (const h of result.ys) {
    let x = result.xGaps[0];
    for (const w of result.xs) {
      const rect = document.createElementNS(svgNs, 'rect');
      const full = Math.abs(w - tileWidth) <= 1e-6 && Math.abs(h - tileHeight) <= 1e-6; // same tolerance as EPS in calculations.js
      rect.setAttribute('class', full ? 'tile-full' : 'tile-cut');
      for (const [name, value] of Object.entries({ x, y: y - h, width: w, height: h })) rect.setAttribute(name, value);
      svg.append(rect);
      x += w + joint;
    }
    y -= h + joint;
  }
  container.replaceChildren(svg, element('p', '實線淺色為整磚，虛線白底為切磚；圖面依比例，左下為起排角。'));
  container.lastChild.className = 'tool-note';
}

const render = {
  tileLayout(panel, result, values) {
    drawTiles(panel.querySelector('.tile-diagram'), result, values);
    const list = panel.querySelector('.tile-cutlist');
    if (!result.cutList.length) {
      list.replaceChildren(element('p', '沒有切磚。'));
      return;
    }
    const table = element('table');
    table.className = 'kit-table';
    const head = element('tr');
    head.append(element('th', '切片寬 × 高（mm）'), element('th', '片數'));
    table.append(head);
    for (const piece of result.cutList) {
      const row = element('tr');
      row.append(element('td', `${numberFormat.format(piece.w)} × ${numberFormat.format(piece.h)}`), element('td', numberFormat.format(piece.count)));
      table.append(row);
    }
    list.replaceChildren(element('h3', '切料清單'), table);
    list.firstChild.className = 'tool-subhead';
  },
  conduitFill(panel, result) {
    const list = element('ol');
    list.className = 'kit-list';
    result.rows.forEach((row, index) => {
      const item = element('li', `第 ${index + 1} 條：外徑 ${numberFormat.format(row.d)} mm × ${numberFormat.format(row.n)} 條＝${numberFormat.format(row.area)} mm²`);
      item.className = 'kit-list-item';
      list.append(item);
    });
    panel.querySelector('.row-list').replaceChildren(list);
  },
  cutFill(panel, result) {
    const list = element('ol');
    list.className = 'kit-list';
    result.cells.forEach((cell, index) => {
      const where = `第 ${cell.row + 1} 列第 ${cell.col + 1} 格`;
      const diff = `平均差 ${numberFormat.format(cell.avgDiff)} m`;
      let text = cell.mixed ? `${where}：同格有挖有填，需細分網格（未計入）` :
        cell.cut > 0 ? `${where}：${diff}，挖方 ${numberFormat.format(cell.cut)} m³` :
        cell.fill > 0 ? `${where}：${diff}，填方 ${numberFormat.format(cell.fill)} m³` : `${where}：無挖填`;
      if (index === result.maxCell) text += '（高差最大）';
      const item = element('li', text);
      item.className = 'kit-list-item';
      list.append(item);
    });
    const container = panel.querySelector('.cell-list');
    container.replaceChildren(element('h3', '逐格明細'), list);
    container.firstChild.className = 'tool-subhead';
  },
};

function updatePanel(panel) {
  const output = panel.querySelector('.tool-output');
  const error = panel.querySelector('.tool-error');
  const { values, valid, touched } = readValues(panel);
  if (!valid) {
    output.hidden = true;
    error.hidden = !touched;
    return;
  }
  try {
    const result = calculate[panel.dataset.tool](values);
    for (const field of panel.querySelectorAll('[data-result]')) {
      const value = result[field.dataset.result];
      field.textContent = value == null ? '' : typeof value === 'string' ? value : numberFormat.format(value);
    }
    for (const field of panel.querySelectorAll('[data-optional]')) {
      field.hidden = result[field.dataset.optional] == null;
    }
    render[panel.dataset.tool]?.(panel, result, values);
    output.hidden = false;
    error.hidden = true;
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause;
    output.hidden = true;
    error.hidden = false;
  }
}

// Repeatable rows (#31 cables): number the legend, labels and ids; keep at least one row.
function renumberRows(panel) {
  const rows = [...panel.querySelectorAll('.cable-row')];
  rows.forEach((row, index) => {
    const n = index + 1;
    row.querySelector('legend').textContent = `第 ${n} 條`;
    for (const label of row.querySelectorAll('label')) {
      const input = label.nextElementSibling.querySelector('input');
      input.id = `${panel.dataset.tool}-${input.name}-${n}`;
      label.htmlFor = input.id;
      label.textContent = label.textContent.replace(/^第 \d+ 條/, `第 ${n} 條`);
    }
    row.querySelector('.row-remove').disabled = rows.length === 1;
  });
}

for (const panel of panels.filter(p => p.querySelector('.cable-row'))) {
  const list = panel.querySelector('.row-list-inputs');
  const add = panel.querySelector('.row-add');
  add.addEventListener('click', () => {
    const row = list.lastElementChild.cloneNode(true);
    for (const input of row.querySelectorAll('input')) input.value = '';
    list.append(row);
    renumberRows(panel);
    row.querySelector('input').focus();
    updatePanel(panel);
  });
  list.addEventListener('click', event => {
    const row = event.target.closest('.row-remove')?.closest('.cable-row');
    if (!row || list.children.length === 1) return;
    const previous = row.previousElementSibling;
    row.remove();
    renumberRows(panel);
    (previous?.querySelector('input') ?? add).focus();
    updatePanel(panel);
  });
  renumberRows(panel);
}

// "帶入範例": fill a worked example so a first-time user sees a complete, labelled result.
function fillExample(panel, values) {
  for (const field of panel.querySelectorAll('input, textarea')) field.value = '';
  const list = panel.querySelector('.row-list-inputs');
  const rowCount = Object.values(values).find(Array.isArray)?.length;
  while (list && rowCount && list.children.length < rowCount) panel.querySelector('.row-add').click();
  while (list && rowCount && list.children.length > rowCount) list.lastElementChild.querySelector('.row-remove').click();
  for (const [name, value] of Object.entries(values)) {
    const fields = [...panel.querySelectorAll(`[name="${name}"]`)];
    [value].flat().forEach((item, index) => { fields[index].value = String(item); });
  }
  if (panel.querySelector('[data-mode]')) updateModeFields(panel);
  updatePanel(panel);
}

const examples = globalThis.toolboxExamples;
for (const panel of panels) {
  const example = examples[panel.dataset.tool];
  const note = element('p', `範例資料：${example.note} 請改成實際數值後再使用。`);
  note.className = 'kit-callout example-note';
  note.dataset.status = 'info';
  note.hidden = true;
  const button = element('button', '帶入範例');
  button.type = 'button';
  button.className = 'kit-button kit-button--link tool-example';
  button.addEventListener('click', () => {
    fillExample(panel, example.values);
    note.hidden = false;
  });
  panel.querySelector('h2').after(button, note);
  // Any real edit turns the example into the user's own numbers.
  panel.querySelector('form').addEventListener('input', event => { if (event.isTrusted) note.hidden = true; });
  // The Kit ± button fires synthetic input events; its own click is the user's real edit.
  panel.querySelector('form').addEventListener('click', event => { if (event.target.closest('.kit-sign-toggle')) note.hidden = true; });
}

for (const panel of panels) {
  const form = panel.querySelector('form');
  form.addEventListener('submit', event => event.preventDefault());
  // A select fires 'input' before 'change', so mode fields must switch on both before recalculating.
  const refresh = () => {
    if (panel.querySelector('[data-mode]')) updateModeFields(panel);
    updatePanel(panel);
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  if (panel.querySelector('[data-mode]')) updateModeFields(panel);
}

const home = document.querySelector('.tool-home');
const tiles = document.getElementById('tool-tiles');
const back = document.querySelector('.tool-back');
const orderStatus = document.getElementById('order-status');
let openedFromHome = false;

// Empty tool = the tile home. Returns the tool actually shown, so unknown routes fall back to home.
function show(tool) {
  const panel = panels.find(p => p.dataset.tool === tool);
  home.hidden = Boolean(panel);
  back.hidden = !panel;
  for (const p of panels) p.hidden = p !== panel;
  return panel;
}

const routeTool = route => (route ?? '').replace(/^\//, '');

tiles.addEventListener('click', event => {
  const tile = event.target.closest('.kit-launcher-tile');
  if (!tile || tile.hasAttribute('data-dragging')) return;
  const panel = show(tile.dataset.id);
  studio.setRoute(`/${tile.dataset.id}`, { push: true });
  openedFromHome = true;
  panel.querySelector('h2').focus();
});

back.addEventListener('click', () => {
  const tool = panels.find(p => !p.hidden)?.dataset.tool;
  // Pop our own history entry so the phone's back button stays in step; a deep link has none to pop.
  if (openedFromHome) history.back();
  else studio.setRoute('');
  show('');
  openedFromHome = false;
  tiles.querySelector(`[data-id="${tool}"]`)?.focus();
});

// The phone back button and a second tap on the rail item both arrive here as null.
studio.onRoute(route => {
  show(routeTool(route));
  openedFromHome = false;
});

for (const panel of panels) panel.querySelector('h2').tabIndex = -1;
// Signed fields keep the numeric keypad; the Kit's ± button supplies the minus sign phones lack.
for (const input of document.querySelectorAll('[data-allow-negative]')) studio.kit.signToggle(input);
show(routeTool(new URLSearchParams(location.search).get('r')));

for (const button of document.querySelectorAll('.tool-copy')) {
  button.addEventListener('click', () => {
    const panel = button.closest('.tool-panel');
    const lines = [panel.querySelector('h2').textContent];
    for (const stat of panel.querySelectorAll('.kit-stat:not([hidden])')) {
      lines.push(`${stat.querySelector('dt').textContent}：${stat.querySelector('dd').textContent}`);
    }
    // Table cells are tab-separated so a cut size and its count do not run together.
    for (const row of panel.querySelectorAll('.tile-cutlist tr, .cell-list li, .row-list li, .tool-source:not([hidden]), .tool-output .kit-callout:not([hidden])')) {
      lines.push(row.cells ? [...row.cells].map(cell => cell.textContent).join('\t') : row.textContent);
    }
    studio.copy(lines.join('\n'));
  });
}

// Personal tile order in the user's own records; reorder and merge rules come from the Kit.
const ORDER_COLLECTION = 'preferences';
const ORDER_KEY = 'tile-order';
let orderChanged = false;

studio.records.getByKey(ORDER_COLLECTION, ORDER_KEY, { scope: 'user' }).then(record => {
  const saved = record?.body?.order;
  if (orderChanged || !Array.isArray(saved)) return;
  const items = [...tiles.children].map(tile => ({ id: tile.dataset.id, tile }));
  tiles.append(...studio.kit.mergeOrder(saved.filter(id => typeof id === 'string'), items).map(item => item.tile));
}, () => {
  orderStatus.textContent = '暫時讀不到你的方塊順序，先用預設順序。';
});

studio.kit.sortable(tiles, {
  itemSelector: '.kit-launcher-tile',
  onChange: async order => {
    orderChanged = true;
    try {
      await studio.records.put(ORDER_COLLECTION, ORDER_KEY, { scope: 'user', body: { order } });
      orderStatus.textContent = '已儲存你的方塊順序。';
    } catch {
      orderStatus.textContent = '方塊順序未能儲存，請稍後再調整一次。';
    }
  },
});
