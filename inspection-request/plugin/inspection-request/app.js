'use strict';

const collection = 'requests';
const form = document.getElementById('request-form');
const guard = document.getElementById('guard');
const status = document.getElementById('status');
const savedSection = document.getElementById('saved-section');
const recordList = document.getElementById('record-list');
const emptyRecords = document.getElementById('empty-records');
const saveButton = document.getElementById('save-btn');
const newButton = document.getElementById('new-btn');
const printButton = document.getElementById('print-btn');

let currentProject = null;
let currentRecord = null;
let isDirty = false;
let projectGeneration = 0;

function showStatus(kind) {
  status.textContent = kind ? document.getElementById(`message-${kind}`).textContent : '';
}

// NOTE(ceiling): The source form has ten entry rows; supporting more requires a multi-page print layout.
function readForm() {
  const body = {};
  for (const field of form.elements) {
    if (!field.name) continue;
    if (field.type === 'checkbox') body[field.name] = field.checked;
    else if (field.type === 'radio') {
      if (!(field.name in body)) body[field.name] = '';
      if (field.checked) body[field.name] = field.value;
    } else body[field.name] = field.value.trim();
  }
  return body;
}

function fillForm(body) {
  form.reset();
  for (const field of form.elements) {
    if (!field.name) continue;
    if (field.type === 'checkbox') field.checked = body[field.name] === true;
    else if (field.type === 'radio') field.checked = body[field.name] === field.value;
    else field.value = body[field.name] ?? '';
  }
  isDirty = false;
  studio.dirty(false);
  showStatus(null);
}

function newForm() {
  currentRecord = null;
  fillForm({ projectName: currentProject?.name ?? '' });
}

function renderList(records) {
  recordList.replaceChildren();
  emptyRecords.hidden = records.length !== 0;
  for (const record of records) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kit-button kit-button--secondary';
    button.textContent = `#${record.serial ?? record.record_id.slice(0, 8)} ${record.body.formNumber || record.body.inspectionName || record.body.projectName || ''}`;
    button.addEventListener('click', () => {
      if (isDirty) return showStatus('unsaved');
      currentRecord = record;
      fillForm(record.body);
      form.scrollIntoView({ block: 'start' });
    });
    recordList.appendChild(button);
  }
}

async function refreshList(projectHandle, generation) {
  try {
    const records = await studio.records.list(collection, {
      scope: 'project', project_handle: projectHandle, order: 'created_at desc',
    });
    if (generation === projectGeneration) renderList(records);
  } catch (error) {
    if (generation === projectGeneration) showStatus('load-error');
    studio.log.error('Record list failed', { code: error?.message });
  }
}

async function saveRecord() {
  if (!currentProject?.project_handle || !form.reportValidity()) return false;
  saveButton.disabled = true;
  try {
    const body = readForm();
    const record = currentRecord
      ? await studio.records.update(collection, currentRecord.record_id, {
        version: currentRecord.version, schema: 'v1', body,
      })
      : await studio.records.create(collection, {
        scope: 'project', project_handle: currentProject.project_handle, schema: 'v1', body,
      });
    currentRecord = record;
    isDirty = false;
    studio.dirty(false);
    showStatus('saved');
    await refreshList(currentProject.project_handle, projectGeneration);
    return true;
  } catch (error) {
    showStatus(error?.message === 'VERSION_CONFLICT' ? 'conflict' : 'save-error');
    studio.log.error('Record save failed', { code: error?.message });
    return false;
  } finally {
    saveButton.disabled = false;
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
for (const eventName of ['input', 'change']) {
  form.addEventListener(eventName, () => {
    isDirty = true;
    studio.dirty(true);
    showStatus(null);
  });
}
saveButton.addEventListener('click', saveRecord);
newButton.addEventListener('click', () => {
  if (isDirty) return showStatus('unsaved');
  newForm();
});
printButton.addEventListener('click', async () => {
  try { await studio.print({ preview: true }); }
  catch (error) {
    showStatus('print-error');
    studio.log.error('Print preview failed', { code: error?.message });
  }
});

studio.onCanClose(async ({ save }) => {
  if (save) return saveRecord();
  if (isDirty) newForm();
  return true;
}, { saves: true });

studio.onProjectChange((project) => {
  projectGeneration += 1;
  currentProject = project;
  newForm();
  const available = Boolean(project?.project_handle);
  guard.hidden = available;
  form.hidden = !available;
  savedSection.hidden = !available;
  saveButton.disabled = !available;
  newButton.disabled = !available;
  printButton.disabled = !available;
  recordList.replaceChildren();
  emptyRecords.hidden = true;
  if (available) refreshList(project.project_handle, projectGeneration);
});
