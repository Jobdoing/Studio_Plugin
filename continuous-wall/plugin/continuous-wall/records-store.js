// Thin data layer over studio.records (data.md §2.1, §2.6) for the one wall-records collection: it only fills in
// the fixed arguments (collection, scope, project_handle, schema, label), also for studio.sync's conflict flow. The SDK itself is the data layer, so there
// is no caching or error mapping here. Also holds two pure helpers, recordDays and listText, testable on their own.
(() => {
  const COLLECTION = 'wall-records';
  const SCHEMA = 'cw-2';
  const records = () => window.studio.records;
  // Shown by the host if a write queued while offline later needs a decision (data.md §2.1).
  const label = body => `連續壁 ${body.wall.unitNo || '未填單元'}`;

  // Only real YYYY-MM-DD values count: the pattern and a real calendar date (no 2026-02-30).
  function validDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  // The prework phase ids of PHASES in plugin/app.js.
  const preworkPhases = ['slurry', 'lowerCage', 'upperCage', 'splice', 'cageComplete', 'tremie'];

  // NOTE(ceiling): gap d -- the platform has no date query, so the calendar computes each record's days in the
  // browser over a full records.list of the project (a full scan, no index). Upgrade path: switch to a platform
  // date query / indexed field once studio5 ships gap d.
  function recordDays(record) {
    const body = record.body;
    const createdDay = new Date(new Date(record.created_at).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const candidates = [createdDay, body.dates?.excavationStart, body.dates?.excavationEnd,
      body.dates?.pouring, body.guideWall?.date, body.rebarCage?.date,
      ...preworkPhases.map(id => body.prework?.[id]?.date)];
    return [...new Set(candidates.filter(validDay))].sort().reverse();
  }

  // HH:MM in Taiwan time; also the bridge's status texts.
  function clock(value) {
    return new Date(value).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' });
  }
  // The list row's state, in 1.2.x wording: the platform's 'reopened' is 1.2.x's 修改中.
  function stateText(record) {
    if (record.state === 'published') {
      const at = record.published.at;
      return `已發布 ${new Date(at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit' })} ${clock(at)}`;
    }
    return record.state === 'reopened' ? '修改中' : '草稿';
  }
  // One record-list row, in the order of the 1.2.x list: #n · unit · sequence · state · created time.
  function listText(record) {
    const wall = record.body.wall;
    const time = clock(record.created_at);
    // A create made offline has serial null until the server applies it (data.md 2.1): show no number yet.
    return [record.serial == null ? '' : `#${record.serial}`, wall.unitNo || '未填單元', wall.sequenceNo ? `順序 ${wall.sequenceNo}` : '',
      stateText(record), time].filter(Boolean).join(' · ');
  }

  window.continuousWallRecords = {
    COLLECTION,
    list: project => records().list(COLLECTION, { scope: 'project', project_handle: project.project_handle, order: 'created_at desc' }),
    get: id => records().get(COLLECTION, id),
    getPublished: id => records().get(COLLECTION, id, { view: 'published' }),
    create: (project, body) => records().create(COLLECTION,
      { scope: 'project', project_handle: project.project_handle, schema: SCHEMA, body, label: label(body) }),
    update: (id, { version, body, release }) => records().update(COLLECTION, id,
      { version, body, schema: SCHEMA, label: label(body), release }),
    // Always takeover:true: it only differs from a plain claim when another user's lease has expired, and then the
    // platform records a takeover history row (store.mjs leaseClaim), keeping 1.2.x's "a takeover is always logged".
    claim: id => records().lease.claim(COLLECTION, id, { takeover: true }),
    release: id => records().lease.release(COLLECTION, id),
    publish: (id, version) => records().publish(COLLECTION, id, { version }),
    reopen: (id, version, reason) => records().reopen(COLLECTION, id, { version, reason }),
    remove: (id, version, body) => records().remove(COLLECTION, id, { version, label: label(body) }),
    // The platform's conflict flow (data.md 2.4(b), 2.7): it keeps the edit, asks the user and, on 'mine', writes it
    // with the same fixed schema/label as update (a resumed entry carries those of the update that saved it).
    resolveConflict: (error, body, { release } = {}) => window.studio.sync.resolveConflict(error,
      { mine: body, schema: SCHEMA, label: label(body), release, claim: { takeover: true } }),
    savedConflict: id => window.studio.sync.savedConflict(COLLECTION, id),
    resumeConflict: (id, current) => window.studio.sync.resumeConflict(COLLECTION, id, { current, claim: { takeover: true } }),
    recordDays,
    listText,
    clock,
  };
})();
