import { PAGE_SIZE, searchUrl, readTransactions, mapsUrl } from './data.mjs';

const $ = id => document.getElementById(id);
const form = $('search-form');
let copy;
let activeFilters;
let offset = 0;
let requestVersion = 0;

function busy(value) {
  form.setAttribute('aria-busy', String(value));
  $('results').setAttribute('aria-busy', String(value));
  $('search').disabled = value;
  $('previous').disabled = true;
  $('next').disabled = true;
  $('retry').disabled = value;
}

function error(message) {
  $('error-message').textContent = message;
  $('error').hidden = false;
}

function fact(label, value, unit, price) {
  const box = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const definition = document.createElement('dd');
  definition.textContent = value == null ? copy.unknown : studio.fmt.number(value, { decimals: 1 });
  if (price) definition.dataset.price = price;
  if (value != null) {
    const suffix = document.createElement('span');
    suffix.className = 'fact-unit';
    suffix.textContent = unit;
    definition.append(suffix);
  }
  box.append(term, definition);
  return box;
}

function render(rows) {
  const cards = rows.map(row => {
    const card = document.createElement('article');
    card.className = 'kit-card transaction';
    const location = document.createElement('div');
    const date = document.createElement('time');
    date.dateTime = row.date;
    date.textContent = `${copy.date} ${studio.fmt.date(row.date)}`;
    const heading = document.createElement('h3');
    heading.textContent = row.community || row.address || copy.unknown;
    const address = document.createElement('p');
    address.textContent = row.address || copy.unknown;
    const description = document.createElement('p');
    description.textContent = [row.buildingType || copy.unknown, `${copy.floor} ${row.floor == null ? copy.unknown : `${row.floor}${copy.floorUnit}`}`,
      `${copy.age} ${row.age == null ? copy.unknown : `${studio.fmt.number(row.age, { decimals: 1 })}${copy.years}`}`].join(' · ');
    location.append(date, heading, address, description);
    const facts = document.createElement('dl');
    facts.className = 'facts';
    facts.append(fact(copy.total, row.totalWan, copy.wan, 'total'), fact(copy.unit, row.unitWan, copy.wanPerPing, 'unit'), fact(copy.area, row.area, copy.ping));
    const map = document.createElement('button');
    map.type = 'button';
    map.className = 'kit-button kit-button--secondary';
    map.textContent = copy.maps;
    map.disabled = !row.address.trim();
    map.addEventListener('click', () => openExternal(mapsUrl(row.address)));
    card.append(location, facts, map);
    return card;
  });
  $('list').replaceChildren(...cards);
  $('range').textContent = rows.length ? copy.pageRange.replace('{start}', String(offset + 1)).replace('{end}', String(offset + rows.length)) : '';
  $('results').hidden = false;
  $('previous').disabled = offset === 0;
  // NOTE(ceiling): the upstream count is a page count, not a total; a full final page may lead to an empty next page. Upgrade when the API supplies has_more.
  $('next').disabled = rows.length < PAGE_SIZE;
}

async function openExternal(url) {
  try { await studio.openExternal(url); }
  catch { error(copy.mapFailed); }
}

async function query(pageOffset) {
  const version = ++requestVersion;
  offset = pageOffset;
  busy(true);
  $('error').hidden = true;
  $('results').hidden = true;
  $('attribution').hidden = true;
  $('list').replaceChildren();
  $('status').textContent = copy.loading;
  try {
    const response = await studio.http.fetch(searchUrl(activeFilters, offset));
    if (version !== requestVersion) return;
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (!response.ok) throw new Error('SERVICE_FAILED');
    const data = await response.json();
    if (version !== requestVersion) return;
    const rows = readTransactions(data);
    busy(false);
    render(rows);
    $('status').textContent = rows.length ? $('range').textContent : (offset ? copy.pageEmpty : copy.empty);
    const sources = Array.isArray(data.sources) ? data.sources.map(s => typeof s?.attribution === 'string' ? s.attribution : '').filter(Boolean) : [];
    $('attribution').textContent = [...new Set(sources)].join(' · ');
    $('attribution').hidden = !sources.length;
  } catch (failure) {
    if (version !== requestVersion) return;
    busy(false);
    $('results').hidden = false;
    $('range').textContent = '';
    $('previous').disabled = offset === 0;
    $('status').textContent = '';
    const messages = { RATE_LIMITED: copy.rateLimited, INVALID_FILTERS: copy.invalid, INVALID_DATA: copy.invalidData };
    error(messages[failure.message] || copy.failed);
  }
}

async function init() {
  try {
    const response = await fetch('./content.zh-Hant.json');
    if (!response.ok) throw new Error('CONTENT_FAILED');
    copy = await response.json();
    document.querySelectorAll('[data-copy]').forEach(el => { el.textContent = copy[el.dataset.copy]; });
    $('town').placeholder = copy.townPlaceholder;
    $('address').placeholder = copy.addressPlaceholder;
    $('county').replaceChildren(...copy.counties.map(county => new Option(county, county)));
    if (!window.studio?.http?.fetch || !studio.fmt || !studio.openExternal) {
      $('status').textContent = copy.sdkUnavailable;
      form.setAttribute('aria-busy', 'false');
      return;
    }
    form.querySelectorAll('input, select').forEach(el => { el.disabled = false; });
    busy(false);
    $('status').textContent = copy.ready;
    $('retry').disabled = true;
    $('source-link').disabled = false;
    $('source-link').addEventListener('click', () => openExternal('https://toestate.tw/mcp-guide'));
    form.addEventListener('submit', event => {
      event.preventDefault();
      activeFilters = Object.fromEntries(new FormData(form));
      query(0);
    });
    form.addEventListener('input', () => {
      requestVersion++;
      activeFilters = null;
      offset = 0;
      busy(false);
      $('retry').disabled = true;
      $('results').hidden = true;
      $('error').hidden = true;
      $('attribution').hidden = true;
      $('list').replaceChildren();
      $('status').textContent = copy.ready;
    });
    $('previous').addEventListener('click', () => query(Math.max(0, offset - PAGE_SIZE)));
    $('next').addEventListener('click', () => query(offset + PAGE_SIZE));
    $('retry').addEventListener('click', () => { if (activeFilters) query(offset); });
  } catch {
    $('status').textContent = copy?.contentFailed || 'Unable to load interface content. Reload this page.';
    form.setAttribute('aria-busy', 'false');
  }
}

init();
