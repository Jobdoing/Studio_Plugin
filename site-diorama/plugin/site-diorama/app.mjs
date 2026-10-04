import { MODULES, readSummary, readDetails, queryModule } from './data.mjs';

const $ = id => document.getElementById(id);
const labels = Object.fromEntries(MODULES.map(module => [module, $(`marker-${module}`)]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let copy, current, viewer, scopeVersion = 0, detailVersion = 0, selected = null;
let values = {}, active = studio.isActive(), projectEvent = false;
const number = value => new Intl.NumberFormat('zh-TW').format(value);

function showMotion() {
  const running = $('motion').checked && !reduced.matches && active;
  $('stage').dataset.motion = String(running);
  viewer?.setMotion($('motion').checked && !reduced.matches);
  viewer?.setActive(active);
  $('motion').disabled = reduced.matches || !viewer;
  if (copy) $('motion').title = reduced.matches ? copy.motionReduced : copy.animation;
}

function clearDetails() {
  ++detailVersion; selected = null;
  $('details').setAttribute('aria-busy', 'false');
  $('detail-heading').textContent = copy.detail;
  $('detail-status').textContent = copy.pick;
  $('detail-count').textContent = '';
  $('population').textContent = '';
  $('detail-list').replaceChildren();
  $('detail-limit').hidden = true;
  MODULES.forEach(module => labels[module].setAttribute('aria-pressed', 'false'));
  viewer?.select(null);
}

function renderSummary(module, summary, message) {
  const node = $(`summary-${module}`);
  const value = summary ? number(summary.value) : '—';
  node.querySelector('.metric-value').textContent = value;
  labels[module].querySelector('.marker-value').textContent = value;
  labels[module].title = message || `${copy[module].metric} ${value}`;
  node.querySelector('.module-secondary').textContent = message || (module === 'diary'
    ? `${copy[module].secondary} ${'2026/06/01'}`
    : `${copy[module].secondary} ${number(module === 'corrective' ? summary.overdue : summary.total)}`);
  node.setAttribute('aria-busy', String(message === copy.loading));
}

async function loadProject(project) {
  const version = ++scopeVersion;
  current = project;
  values = {};
  clearDetails(); viewer?.setValues(values);
  const usable = Boolean(project?.project_handle && project.project_handle !== '__all__');
  $('heading').textContent = usable ? `${project.name}｜${copy.heading}` : copy.heading;
  $('guard').textContent = usable ? copy.loading : project?.project_handle === '__all__' ? copy.all : copy.choose;
  $('refresh').disabled = !usable;
  $('freshness').textContent = '';
  for (const module of MODULES) {
    labels[module].disabled = !usable;
    $(`summary-${module}`).disabled = !usable;
    renderSummary(module, null, usable ? copy.loading : copy.choose);
  }
  if (!usable) return;
  const requests = MODULES.map(async module => {
    try {
      const summary = readSummary(module, await queryModule(studio, project, module, 'summary'));
      if (version !== scopeVersion) return;
      values[module] = summary; renderSummary(module, summary); viewer?.setValues(values);
    } catch (error) {
      if (version === scopeVersion) renderSummary(module, null, error.message === 'INVALID_DATA' ? copy.invalid : copy.failed);
    }
  });
  requests.push((async () => {
    try {
      const result = await studio.dataset();
      if (version !== scopeVersion) return;
      if (!Array.isArray(result.sources)) throw new Error('INVALID_DATA');
      $('freshness').textContent = result.sources.length ? result.sources.map(source => `${source.name}：${copy.updated} ${source.last_sync_at || copy.unknown}`).join(' · ') : copy.freshnessEmpty;
    } catch { if (version === scopeVersion) $('freshness').textContent = copy.freshnessFailed; }
  })());
  await Promise.all(requests);
  if (version === scopeVersion) $('guard').textContent = copy.snapshot;
}

async function selectModule(module) {
  if (!current?.project_handle || current.project_handle === '__all__') return;
  const version = ++detailVersion, scope = scopeVersion, project = current;
  selected = module;
  $('detail-heading').textContent = copy[module].title;
  $('detail-heading').focus({ preventScroll: true });
  $('detail-status').textContent = copy.loading;
  $('detail-list').replaceChildren();
  $('detail-count').textContent = '';
  $('detail-limit').hidden = true;
  $('population').textContent = copy[module].population;
  $('details').setAttribute('aria-busy', 'true');
  for (const key of MODULES) labels[key].setAttribute('aria-pressed', String(module === key));
  viewer?.select(module);
  try {
    const rows = readDetails(module, await queryModule(studio, project, module, 'detail'));
    if (version !== detailVersion || scope !== scopeVersion) return;
    $('detail-list').replaceChildren(...rows.map(row => {
      const li = document.createElement('li'); li.className = 'record';
      const title = document.createElement('h3'); title.textContent = row.title || copy.unknown;
      const meta = document.createElement('span'); meta.className = 'record-meta'; meta.textContent = `${row.date || copy.unknown} · ${row.status || copy.unknown}`;
      const note = document.createElement('p'); note.textContent = module === 'diary' ? copy.variants[row.variant] || row.variant || copy.unknown : row.note || copy.unknown;
      li.append(title, meta, note); return li;
    }));
    $('detail-status').textContent = rows.length ? '' : module === 'diary' ? copy.diary.empty : copy.empty;
    $('detail-count').textContent = `${number(rows.length)} ${copy.units}`;
    $('detail-limit').hidden = !rows.length;
  } catch (error) {
    if (version === detailVersion && scope === scopeVersion) $('detail-status').textContent = error.message === 'INVALID_DATA' ? copy.invalid : copy.failed;
  } finally { if (version === detailVersion && scope === scopeVersion) $('details').setAttribute('aria-busy', 'false'); }
}

studio.onProjectChange(project => {
  projectEvent = true; current = project;
  if (copy) void loadProject(project);
});
studio.onActiveChange(value => { active = value; showMotion(); });
reduced.addEventListener('change', showMotion);
window.addEventListener('pagehide', () => viewer?.dispose());

async function initialize() {
  const response = await fetch('./content.zh-Hant.json');
  if (!response.ok) throw new Error('COPY_UNAVAILABLE');
  copy = await response.json();
  document.title = copy.heading;
  for (const [id, key] of Object.entries({ subtitle: 'subtitle', heading: 'heading', refresh: 'refresh', 'model-note': 'model', gesture: 'gesture', reset: 'reset', 'motion-label': 'animation', 'detail-caption': 'detail', 'detail-limit': 'limit', snapshot: 'snapshot' })) $(id).textContent = copy[key];
  $('left').setAttribute('aria-label', copy.rotateLeft); $('right').setAttribute('aria-label', copy.rotateRight);
  for (const module of MODULES) {
    labels[module].querySelector('.marker-title').textContent = copy[module].title;
    labels[module].querySelector('.marker-metric').textContent = copy[module].metric;
    labels[module].addEventListener('click', () => void selectModule(module));
    const button = document.createElement('button');
    button.type = 'button'; button.id = `summary-${module}`; button.className = 'kit-button kit-button--secondary module'; button.dataset.module = module;
    for (const [className, text] of [['module-title', copy[module].metric], ['metric-value', '—'], ['module-secondary', copy.loading]]) {
      const span = document.createElement('span'); span.className = className; span.textContent = text; button.append(span);
    }
    button.addEventListener('click', () => void selectModule(module)); $('modules').append(button);
  }
  $('refresh').addEventListener('click', () => void loadProject(current));
  $('motion').checked = !reduced.matches;
  $('motion').addEventListener('change', showMotion);
  $('left').addEventListener('click', () => viewer?.rotate(-Math.PI / 8));
  $('right').addEventListener('click', () => viewer?.rotate(Math.PI / 8));
  $('reset').addEventListener('click', () => viewer?.reset());
  const initialEvent = projectEvent;
  const initial = initialEvent ? current : await studio.project();
  if (!initialEvent && projectEvent) void loadProject(current);
  else void loadProject(initial);
  try {
    const { createSite } = await import('./scene.mjs');
    viewer = createSite($('stage'), labels, module => void selectModule(module));
    viewer.setValues(values); viewer.select(selected);
  } catch {
    $('stage').classList.add('no-webgl'); $('scene-error').textContent = copy.fallback; $('scene-error').hidden = false;
    for (const id of ['left', 'right', 'reset']) $(id).disabled = true;
  }
  showMotion();
}

initialize().catch(error => {
  $('startup-error').hidden = false;
  studio.log.error(error.message);
});
