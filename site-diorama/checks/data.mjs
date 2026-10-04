import assert from 'node:assert/strict';
import { MODULES, readSummary, readDetails, queryModule } from '../plugin/site-diorama/data.mjs';

export function checkData(api) {
  assert.deepEqual(api.readSummary('corrective', { rows: [{ total_count: 10, open_count: 4, overdue_count: 2 }] }), { total: 10, value: 4, overdue: 2 });
  assert.deepEqual(api.readSummary('inspection', { rows: [{ total_count: 10, failed_count: 0 }] }), { total: 10, value: 0, overdue: null });
  assert.deepEqual(api.readSummary('diary', { rows: [{ total_count: 0, latest_date: null }] }), { total: 0, value: 0, latest: null });
  for (const row of [{ total_count: 1, open_count: 2, overdue_count: 0 }, { total_count: 2, open_count: 1, overdue_count: 2 }, { total_count: 2, open_count: null, overdue_count: 0 }, { total_count: -1, open_count: 0, overdue_count: 0 }]) assert.throws(() => api.readSummary('corrective', { rows: [row] }), /INVALID_DATA/);
  assert.throws(() => api.readSummary('diary', { rows: [{ total_count: 1, latest_date: '2026-02-30' }] }), /INVALID_DATA/);
  assert.throws(() => api.readSummary('diary', { rows: [] }), /INVALID_DATA/);
  const record = { title: '<img src=x onerror=alert(1)>', status_label: null, record_date: null, note: null };
  assert.deepEqual(api.readDetails('corrective', { rows: [record] }), [{ title: record.title, status: null, date: null, note: null, variant: null }]);
  assert.deepEqual(api.readDetails('diary', { rows: [] }), []);
  assert.throws(() => api.readDetails('corrective', { rows: [record, { ...record, title: 12 }] }), /INVALID_DATA/);
  assert.throws(() => api.readDetails('corrective', { rows: Array(21).fill(record) }), /INVALID_DATA/);
  const calls = [];
  const sdk = { query: (block, params) => { calls.push([block, params]); return Promise.resolve({ rows: [] }); } };
  for (const module of MODULES) api.queryModule(sdk, { project_handle: 'authorized-handle' }, module, 'summary');
  assert.deepEqual(calls, MODULES.map(module => [`site-diorama-${module}-summary`, { project_handle: 'authorized-handle' }]));
  for (const project of [null, {}, { project_handle: '__all__' }]) assert.throws(() => api.queryModule(sdk, project, 'diary', 'detail'), /INVALID_SCOPE/);
  assert.throws(() => api.queryModule(sdk, { project_handle: 'authorized-handle' }, 'unknown', 'detail'), /INVALID_SCOPE/);
  assert.equal(calls.length, 3, 'Rejected scopes must never reach the SDK');
}
checkData({ readSummary, readDetails, queryModule });
console.log('PASS: exact populations, zero/null distinction, invalid data rejection and explicit project scope.');
