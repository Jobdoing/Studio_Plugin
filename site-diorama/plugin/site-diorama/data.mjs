export const MODULES = ['corrective', 'diary', 'inspection'];

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_DATA');
  return value;
}

function date(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('INVALID_DATA');
  return value;
}

export function readSummary(module, result) {
  if (!MODULES.includes(module) || !Array.isArray(result?.rows) || result.rows.length !== 1) throw new Error('INVALID_DATA');
  const row = result.rows[0];
  const total = count(row?.total_count);
  if (module === 'diary') return { total, value: total, latest: date(row.latest_date) };
  const value = count(row[module === 'corrective' ? 'open_count' : 'failed_count']);
  if (value > total) throw new Error('INVALID_DATA');
  const overdue = module === 'corrective' ? count(row.overdue_count) : null;
  if (overdue !== null && overdue > value) throw new Error('INVALID_DATA');
  return { total, value, overdue };
}

export function readDetails(module, result) {
  if (!MODULES.includes(module) || !Array.isArray(result?.rows) || result.rows.length > 20) throw new Error('INVALID_DATA');
  return result.rows.map(row => {
    if (!row || typeof row !== 'object') throw new Error('INVALID_DATA');
    for (const field of ['title', 'status_label', module === 'diary' ? 'variant' : 'note']) {
      if (row[field] !== null && typeof row[field] !== 'string') throw new Error('INVALID_DATA');
    }
    return { title: row.title, status: row.status_label, date: date(row.record_date), note: row.note ?? null, variant: row.variant ?? null };
  });
}

// Scope every call explicitly; the SDK does not add a selected project automatically.
export function queryModule(sdk, project, module, kind) {
  if (!project?.project_handle || project.project_handle === '__all__' || !MODULES.includes(module) || !['summary', 'detail'].includes(kind)) throw new Error('INVALID_SCOPE');
  return sdk.query(`site-diorama-${module}-${kind}`, { project_handle: project.project_handle });
}
