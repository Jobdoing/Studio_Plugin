(() => {
  const app = window.continuousWallApp;
  const studio = window.studio;
  const store = window.continuousWallRecords;
  const hostToolbar = studio?.toolbar?.set && studio?.toolbar?.onAction && studio?.scrollTo ? studio.toolbar : null;
  const controls = document.querySelector('#studio-records');
  const noProjectHint = document.querySelector('#studio-no-project');
  // A project without records shows only 新增一筆, so hide the date and record fields rather than the whole row.
  const dayFields = document.querySelectorAll('.studio-calendar-field, .studio-day-records');
  const projectRows = document.querySelectorAll('.studio-record-browser, .studio-record-actions');
  const picker = document.querySelector('#studio-record-list');
  const dateButton = document.querySelector('#studio-date-button');
  const selectedDate = document.querySelector('#studio-calendar-selected');
  const newButton = document.querySelector('#studio-new-record');
  const stateBadge = document.querySelector('#studio-record-state');
  const projectName = document.querySelector('[data-bind="overview.project"]');
  const status = document.querySelector('#studio-record-status');
  const originalTitle = document.title;
  const draftDelayMs = 3000;
  const formDraftDelayMs = 400; // data.md 2.4(b): 300-500 ms, much shorter than the autosave
  let project = null;
  let record = null; // { id, serial, state, version, published }; null while a new record is not yet stored
  let editing = false;
  let showingPublished = false;
  let baseline = JSON.stringify(app.getState());
  let blankBaseline = null; // baseline of the blank form for the current project; set by clearSelection/startNew
  let transition = Promise.resolve();
  let reviewerName = ''; // signed-in user's display name, the default 填表人 of a blank form (user decision 1.2.3)
  let userId = ''; // signed-in user's id: tells a LEASE_HELD of our own other tab from one of another user
  let saving = Promise.resolve();
  let generation = 0; // bumped by every Clear/Import; a draft response from an older generation is not adopted
  let draftTimer = 0;
  let formDraftTimer = 0;
  let draftQuotaSaid = false; // DRAFT_QUOTA was said and no draft save has succeeded since
  let statusTone; // toolbar tone of the current status text; undefined shows the host's neutral look
  let failedChecks = 0; // 不符合 count last sent as the quality tab badge
  let projectRecords = []; // the current project's records from the last records.list
  let availableDays = [];
  let selectedDay = null;
  let shownMonth = new Date().toISOString().slice(0, 7);
  let dayPicker = null; // studio.kit.datePicker handle on dateButton, created once the Studio SDK is known to be present
  let publishBlock = ''; // status text of a publish refused for malformed measured values, while its summary is shown
  let replacing = null; // { target, body }: the record and form taken just before Clear/Import replaces the form
  let offline = false; // studio.sync.status().online is false: reads, leases and publish/reopen reject OFFLINE
  let syncWaiting = false; // writes were queued (or we were offline) since the last time the queue was drained
  let listFailed = false; // the current project's records.list failed on a switch: nothing is listed until it is read
  const offlineHint = document.querySelector('#studio-offline-hint');
  const restoredNote = document.querySelector('#studio-draft-restored');

  // The status line shows states only (user decision 2026-09-27): while offline (studio.sync.status) the offline
  // text, otherwise the latest state (editing, 草稿已存, 已同步, ...), which also comes back on reconnect. Session expiry
  // is the host's own banner. An action's refusal or failure is a host notice instead (fail / notice).
  let statusState = { value: '', tone: undefined };
  // The same text goes to the host toolbar's status line (studio.toolbar.set status).
  function setStatus(value, tone) {
    status.textContent = value;
    statusTone = tone;
    renderHostToolbar();
  }
  function message(value, tone) {
    statusState = { value, tone };
    if (!offline) setStatus(value, tone);
  }
  // NOTE(ceiling): the host drops notices beyond 2 per second (sdk.md notify), so a burst of refusals (e.g. several
  // photos failing at once) can show only the first two. Upgrade path: none needed on the plugin side unless studio5
  // raises the rate; group such refusals into one notice if it matters.
  function notice(text) { studio.notify(text); }
  // QUEUE_FULL (a write the offline queue refused, kept nowhere) is said by the host banner until the queue drains
  // (Studio bb16c58); a notice would only repeat it on every autosave, so that refusal stays silent here.
  function fail(error) { if (error.message !== 'QUEUE_FULL') notice(describe(error)); }
  const { clock } = store; // HH:MM in Taiwan time
  // Platform error codes (design §4.14); err.lease / err.current stay on the error, only the status line is translated.
  const busy = '系統暫時無法使用，請稍後再試。';
  const storageFull = '儲存空間已滿，請聯絡管理員。';
  const badPhoto = '照片格式無法辨識，或照片太大，請換一張。';
  const errorText = {
    PUBLISHED: '這筆紀錄已發布，要修改請按「解除鎖定」。',
    NOT_PUBLISHED: '這筆紀錄已不是發布狀態，請重新選擇紀錄。',
    NOT_FOUND: '找不到這筆紀錄，可能已被刪除。',
    VERSION_CONFLICT: '這筆紀錄已被其他人更新。',
    CONFLICT_PENDING: '這筆資料正在處理衝突，請稍候', // sdk.md text, verbatim
    OFFLINE: '目前離線，恢復連線後再試。',
    QUEUE_FULL: '離線暫存已滿，最新的修改沒有存下來。請恢復連線後再繼續。', // the host banner's wording
    BODY_TOO_LARGE: '資料太大，無法儲存。',
    QUOTA_EXCEEDED: storageFull,
    DISK_LOW: storageFull,
    FORBIDDEN_ROLE: '你沒有權限執行此操作。',
    INVALID_PROJECT: '案場資訊有誤，請重新整理。',
    INVALID_CONTENT_TYPE: badPhoto,
    IMAGE_TOO_LARGE: badPhoto,
    COMPRESS_FAILED: badPhoto,
    APP_DATA_UNAVAILABLE: busy,
    TOO_MANY_REQUESTS: busy,
    INTERNAL: busy,
    DRAFT_QUOTA: '這台裝置的暫存空間已滿，最新的輸入沒有暫存。',
  };
  function describe(error) {
    // Opening a record someone else holds (a LEASE_HELD while writing goes through the conflict flow instead).
    if (error.message === 'LEASE_HELD' && error.lease) return `目前由 ${error.lease.holder_name} 編輯中，${clock(error.lease.expires_at)} 後可接手。`;
    if (errorText[error.message]) return errorText[error.message];
    if (/[\u4e00-\u9fff]/.test(error.message)) return error.message; // the page's own Chinese refusals
    // Only a platform error code (an uppercase identifier) is named; a raw JS message (TypeError, Failed to fetch) never is.
    return /^[A-Z][A-Z0-9_]*$/.test(error.message) ? `操作失敗，請重新整理後再試（${error.message}）。` : '操作失敗，請重新整理後再試。';
  }
  function changed() { return JSON.stringify(app.getState()) !== baseline; }
  function resetBaseline() { baseline = JSON.stringify(app.getState()); }
  function render() {
    // Help stays usable while read-only (1.2.1), so a re-render must not close it; form dialogs still close.
    if (!editing) for (const dialog of document.querySelectorAll('dialog[open]:not(#help-dialog)')) dialog.close();
    for (const section of document.querySelectorAll('.shared-info-grid, .panel-frame, .action-dock')) section.inert = !editing;
    // Without a project the callout explains what to do; the status line would only repeat it.
    noProjectHint.hidden = Boolean(project);
    for (const row of projectRows) row.hidden = !project;
    newButton.hidden = !project || (editing && !record);
    newButton.disabled = newButton.hidden || offline;
    // Switching or adding needs reads and a lease (online only); the picker's own disabled state is in renderPicker.
    dateButton.disabled = offline;
    offlineHint.hidden = !offline || !project;
    stateBadge.textContent = record ? { draft: '草稿', reopened: '修改中', published: '已發布' }[record.state] : editing ? '新紀錄' : '';
    stateBadge.hidden = !stateBadge.textContent;
    const tone = record ? { reopened: 'warning', published: 'success' }[record.state] : editing ? 'info' : undefined;
    if (tone) stateBadge.dataset.status = tone;
    else delete stateBadge.dataset.status; // a draft uses the chip's default neutral look
    renderHostToolbar();
  }
  function countFailedChecks() {
    return document.querySelectorAll('#quality-check-list input[type="radio"][value="不符合"]:checked').length;
  }
  function renderHostToolbar() {
    if (!hostToolbar) return;
    const activeView = document.querySelector('.tool-view:not([hidden])');
    const tabs = [...(activeView?.querySelectorAll('.tab-navigation [data-tab]') || [])];
    failedChecks = countFailedChecks();
    const menuItem = (id, selector) => ({ id, label: document.querySelector(selector).getAttribute('aria-label') });
    // Print stays listed before publishing, disabled with the reason, so users can see where it is.
    const printItem = (id, selector) => ({ ...menuItem(id, selector), ...(showingPublished ? {} : { disabled: true, hint: '發布後才能列印' }) });
    // Actions that need the server (or would start another record) stay listed offline, disabled with the reason.
    const offlineOff = hint => (offline ? { disabled: true, hint } : {});
    const menu = [
      printItem('pdf-current', '[data-export-format="pdf-current"]'),
      printItem('pdf-all', '[data-export-format="pdf-all"]'),
      menuItem('json', '[data-export-format="json"]'),
      ...(editing ? [{ ...menuItem('import', '#import-json-button'), ...offlineOff('離線時無法匯入') }] : []),
    ];
    hostToolbar.set({
      top: [
        { id: 'record-type', items: [...document.querySelectorAll('[data-select-tool]')].map(button => ({
          id: button.dataset.selectTool,
          label: button.textContent.trim(),
          selected: button.getAttribute('aria-current') === 'page',
          disabled: !project,
        })) },
        ...(tabs.length ? [{ id: 'section-tab', items: tabs.map(button => ({
          id: button.dataset.tab,
          label: button.textContent.trim(),
          selected: button.getAttribute('aria-selected') === 'true',
          disabled: !project,
          ...(button.dataset.tab === 'quality' && failedChecks ? { badge: failedChecks, tone: 'danger' } : {}),
        })) }] : []),
      ],
      bottom: [
        { id: 'help', label: document.querySelector('#help-button').textContent.trim(), icon: 'help' },
        { id: 'clear', label: document.querySelector('#clear-button').textContent.trim(), icon: 'clear', disabled: !editing, ...(editing ? offlineOff('離線時無法清除') : {}) },
        { id: 'file', label: document.querySelector('#export-button').getAttribute('aria-label').slice(0, 2), icon: 'file',
          disabled: !editing && !showingPublished, menu },
        ...(editing && record ? [{ id: 'publish', label: '發布', primary: true, ...offlineOff('離線時無法發布') }] : []),
        ...(record?.state === 'published' ? [{ id: 'unlock', label: '解除鎖定', ...offlineOff('離線時無法解除鎖定') }] : []),
        ...(editing && record ? [{ id: 'delete', label: '刪除', tone: 'danger', ...offlineOff('離線時無法刪除') }] : []),
      ],
      ...(status.textContent ? { status: { text: status.textContent, ...(statusTone ? { tone: statusTone } : {}) } } : {}),
    });
  }
  function handleToolbarAction(action) {
    if (action.kind === 'tab') {
      const buttons = action.rowId === 'record-type'
        ? document.querySelectorAll('[data-select-tool]')
        : document.querySelectorAll('.tool-view:not([hidden]) .tab-navigation [data-tab]');
      const button = [...buttons].find(item => (item.dataset.selectTool || item.dataset.tab) === action.itemId);
      if (!button || !project) return;
      button.click();
      renderHostToolbar();
      const target = action.rowId === 'record-type'
        ? document.querySelector('.tool-view:not([hidden])')
        : document.getElementById(`panel-${action.itemId}`);
      if (target) studio.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY });
      return;
    }
    if (action.kind === 'menu' && action.actionId === 'file' && (editing || showingPublished)) {
      const scope = { 'pdf-current': 'current', 'pdf-all': 'all' }[action.itemId];
      if (scope) { void preview(scope); return; }
      const selector = { json: '[data-export-format="json"]', import: '#import-json-button' }[action.itemId];
      if (selector) document.querySelector(selector).click();
      return;
    }
    if (action.kind !== 'action') return;
    const id = action.actionId || action.itemId;
    // Host actions fire no DOM event here, so each one calls the bridge flow directly.
    if (id === 'unlock' && record?.state === 'published') {
      // Queued like a switch: unlock claims, so a pick meanwhile must wait for it or that lease would stay held.
      const target = record;
      transition = transition.then(() => (record === target ? unlockAction() : undefined));
      return;
    }
    // Help stays usable read-only; the dock button is inert then, so open the dialog directly.
    if (id === 'help') { document.querySelector('#help-dialog').showModal(); return; }
    if (!editing) return;
    if (id === 'publish' && record) void publishAction();
    else if (id === 'delete' && record) void deleteAction();
    else if (id === 'clear') void clearAction();
  }
  // Fills 填表人 only when it is empty, so opened records and imported files keep their own value. Called from the
  // continuous-wall-clear listener, which every blank form passes through (app.newRecord fires it synchronously).
  function useReviewerDefault() {
    const field = document.querySelector('[data-bind="overview.reviewer"]');
    if (!reviewerName || field.value) return;
    field.value = reviewerName;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function useProjectName(selected) {
    const name = selected?.name || '';
    if (projectName.value !== name) {
      projectName.value = name;
      projectName.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function renderCalendar() {
    for (const field of dayFields) field.hidden = !availableDays.length;
    selectedDate.textContent = selectedDay || '';
    dayPicker.update({ month: shownMonth, enabledDates: availableDays, selected: selectedDay });
  }

  async function selectDay(day) {
    if (day === selectedDay) return;
    try {
      await leaveRecord();
      selectedDay = day;
      shownMonth = day.slice(0, 7);
      clearSelection();
      // refresh() lists the records again, which may change the calendar's days.
      await refresh();
      renderCalendar();
    } catch (error) {
      fail(error);
    }
  }

  // The calendar's days come from one records.list of the project (store.recordDays, NOTE(ceiling) gap d there).
  async function refreshDays(selected = project) {
    projectRecords = await store.list(selected);
    availableDays = [...new Set(projectRecords.flatMap(store.recordDays))].sort().reverse();
    listFailed = false;
  }

  function renderPicker() {
    picker.replaceChildren();
    if (!selectedDay) {
      picker.disabled = true;
      return;
    }
    const records = projectRecords.filter(item => store.recordDays(item).includes(selectedDay));
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = records.length ? '選擇當日紀錄' : '當日沒有紀錄';
    picker.append(empty);
    for (const item of records) {
      const option = document.createElement('option');
      option.value = item.record_id;
      option.textContent = store.listText(item);
      picker.append(option);
    }
    picker.disabled = !records.length || offline;
    picker.value = records.some(item => item.record_id === record?.id) ? record.id : '';
  }

  async function refresh(selected = project) {
    await refreshDays(selected);
    renderPicker();
  }

  async function showDays(result) {
    await refreshDays();
    const days = store.recordDays(result);
    if (!days.includes(selectedDay)) selectedDay = days[0];
    shownMonth = selectedDay.slice(0, 7);
    renderCalendar();
    renderPicker();
  }

  function recordOf(result) {
    return { id: result.record_id, serial: result.serial, state: result.state, version: result.version, published: result.published };
  }
  // A write queued offline resolves an optimistic envelope (data.md 2.7, offline spec §4.1): pending:true and op_id,
  // the base version, and only what was sent -- no created_at, state, lease or published. Nothing else is known
  // until the queue sends it, so the day check, re-claim and calendar wait for syncedBack().
  const isQueued = result => result.pending === true;
  // A conflict's 'mine' queued offline resolves such an envelope as its record: what was known of the record stays,
  // with the body and version just sent.
  function mineRecord(result, known) {
    return isQueued(result.record) ? { ...known, body: result.record.body, version: result.record.version } : result.record;
  }
  // A create made offline has serial null until it is applied (data.md 2.1): the text then shows no number.
  function recordName(target = record) { return target.serial == null ? '紀錄' : `紀錄 #${target.serial}`; }
  // The refusals that go to the platform's conflict flow (data.md 2.4(b)): it keeps the edit and asks the user.
  const conflictCodes = ['VERSION_CONFLICT', 'LEASE_HELD', 'PUBLISHED'];
  // get() still returns a record deleted in the meantime (soft delete, deleted_at set): it counts as not found.
  async function required(read) {
    const result = await read;
    if (!result || result.deleted_at) throw new Error('NOT_FOUND');
    return result;
  }

  // editable: this page holds the lease; published: result is the published version, the only printable one.
  function show(result, { editable, published = false }) {
    app.loadState(result.body);
    restoredNote.hidden = true;
    clearPublishBlock();
    useProjectName(project);
    record = recordOf(result);
    editing = editable;
    showingPublished = published;
    resetBaseline();
    record.stored = baseline; // the body the server holds, compared when Clear/Import leaves this record
    picker.value = result.record_id;
    render();
  }

  function clearSelection() {
    // NOTE: app.newRecord() synchronously fires the continuous-wall-clear listener, so our state
    // is set after it (matching startNew()'s ordering) rather than being clobbered by the listener.
    app.newRecord();
    record = null;
    editing = false;
    showingPublished = false;
    useProjectName(project);
    blankBaseline = JSON.stringify(app.getState());
    baseline = blankBaseline;
    render();
  }

  function startNew() {
    app.newRecord();
    useProjectName(project);
    record = null;
    editing = true;
    showingPublished = false;
    blankBaseline = JSON.stringify(app.getState());
    baseline = blankBaseline;
    picker.value = '';
    render();
    message('新紀錄，開始填寫後會自動存成草稿。');
    // The blank form must not replace its own draft before it is restored, nor be autosaved once restored.
    clearTimeout(formDraftTimer);
    formDraftTimer = 0;
    clearTimeout(draftTimer);
    void restoreNewDraft();
  }
  // data.md 2.4(b): a blank new form brings back its own unsent draft, with a small note and no question. It is not
  // autosaved on its own; the next edit or leave stores it as usual.
  async function restoreNewDraft() {
    const key = draftKey(null);
    const draft = await studio.draft.load(key).catch(error => { fail(error); return null; });
    if (!draft || !editing || record || changed() || draftKey(null) !== key) return; // typed or moved on meanwhile
    app.loadState(draft);
    useProjectName(project);
    restoredNote.hidden = false;
  }

  // The fixed open-a-form sequence (data.md 2.4(b)): claim, read, show read only, then ask about a kept edit.
  // Claiming first also makes the form show the latest version once the lease is ours (design §4.2).
  // gap h: a claim does not say whom it took over, so 1.2.x's 「上一位 X 的編輯權已逾時」 is not shown.
  async function open(id) {
    let claimError = null;
    try {
      await store.claim(id);
    } catch (error) {
      // Step 1: only LEASE_HELD stops; any other refusal (published, deleted, ...) goes on, so a kept edit is asked again.
      claimError = error;
    }
    try {
      if (claimError?.message === 'LEASE_HELD') await showLeased(id, claimError);
      else await showOpened(id, claimError, '編輯中');
    } catch (error) { await openFailed(id, !claimError); throw error; }
  }
  // Steps 2-4 refused (a read, or an offline 'mine' rejected OFFLINE: M2 C3): nothing is open, so the screen says so
  // instead of the record left before, and a lease step 1 took is given back. The caller reports why.
  async function openFailed(id, held) {
    clearSelection();
    message('請選擇紀錄，或新增一筆。');
    if (held) await giveBack(id);
  }
  // Every lease this page gives back without a save goes here; a save that leaves uses update({release:true}) instead
  // (data.md 2.6). Offline, the platform queues the release and sends it on reconnect (Studio 9032c34).
  async function giveBack(id) {
    try { await store.release(id); } catch { /* An unreleased lease expires on its own after one hour. */ }
  }
  // Offline as the SDK reports it: 'OFFLINE' (documented, and the mock), or a raw network error message (fetch:
  // 'Failed to fetch' in Chrome, 'Load failed' in Safari). Used by reconnected() to stay quiet about a re-read offline.
  function isOffline(error) {
    return error?.message === 'OFFLINE' || /Failed to fetch|Load failed|NetworkError/.test(error?.message || '');
  }
  // A record of another project is never shown here, so its body never gets this project's name (show() writes the
  // current 案場 into 工程名稱; M2 O4). data.md 2.6: every Record carries its project_key.
  function ownProject(current) {
    if (current && current.project_key !== project.project_key) throw new Error('INVALID_PROJECT');
  }
  // Deleted since the list was read: a blank read-only form and why. The picker lists the records again before
  // opening, so the list already leaves it out.
  function showGone() {
    clearSelection();
    message('請選擇紀錄，或新增一筆。');
    notice(errorText.NOT_FOUND);
  }
  // Steps 2-4 of the sequence. claimError: why step 1 did not lease id (null: this page holds it, as after open or
  // unlock); text follows `${recordName()} ` when held.
  async function showOpened(id, claimError, text) {
    const held = !claimError;
    // Step 2: a soft-deleted record still reads with deleted_at; one gone from the database is current null.
    const current = await store.get(id).catch(error => { if (error.message === 'NOT_FOUND') return null; throw error; });
    ownProject(current);
    const gone = !current || Boolean(current.deleted_at);
    const published = !gone && current.state === 'published';
    // Step 3: read only first.
    if (gone) clearSelection();
    else show(current, { editable: false, published });
    const shown = record; // null when gone
    // Step 4: a kept edit is asked again (a deleted record only offers to drop it).
    const result = (await store.savedConflict(id)) ? await store.resumeConflict(id, current) : null;
    if (record !== shown || editing) return; // another record was opened or started meanwhile
    if (gone) { showGone(); return; }
    if (published) { message(`${recordName()} 已發布，要修改請按「解除鎖定」。`); return; }
    if (result?.choice === 'later') {
      // Only QUEUE_BUSY here (a writable record): the offline queue still holds a write of it and asks first.
      if (held) await giveBack(id); // a read-only view does not keep the lease
      message(`${recordName()} 還有離線時的修改等待上傳，上傳完成後請再開啟一次。`, 'warning');
      return;
    }
    show(result?.choice === 'mine' ? mineRecord(result, current) : current, { editable: held });
    if (!held) { message(describe(claimError), 'danger'); return; } // why this record shows read only
    message(`${recordName()} ${text}`);
    // Step 5: the record's form draft may hold edits typed after its last save. 'theirs' dropped those same edits.
    const key = draftKey(record);
    if (result?.choice === 'theirs') { await dropDraft(key); return; }
    const opened = record;
    const draft = await studio.draft.load(key).catch(error => { fail(error); return null; });
    if (!draft || record !== opened || !editing) return;
    // A draft saved before Studio 7b08942 is a plain body with no base_version: discarded, not submitted
    // (templates/form-app 43f7acc).
    if (draft.base_version === undefined) { await dropDraft(key); return; }
    app.loadState(draft.body);
    if (!changed()) { await dropDraft(key); return; } // already stored
    // data.md 2.4(b): "always draft.base_version -- the version THIS draft's edit started from -- never whichever
    // version step 2's fresh get()/resumeConflict just read". Equal to the current version it is an ordinary save;
    // otherwise an ordinary VERSION_CONFLICT, so resolveConflict asks, and the draft goes once it is stored or decided.
    record.version = draft.base_version;
    await saveNow().catch(writeFailed);
  }
  // data.md 2.4(b) step 1 notice (studio5 2026-09-27: only when a kept edit exists).
  async function keptNotice(id, lease) {
    if (await store.savedConflict(id)) notice(`${lease.holder_name} 編輯中；你有未儲存的修改，待可編輯後再處理`);
  }
  // Someone else edits it: a record being revised shows its published version, a draft shows the draft.
  // The sequence stops here (data.md 2.4(b) step 1): a kept edit is only mentioned, and asked once it can be edited.
  async function showLeased(id, error) {
    const current = await store.get(id).catch(next => { if (next.message === 'NOT_FOUND') return null; throw next; });
    ownProject(current);
    if (!current || current.deleted_at) { showGone(); return; } // its holder deleted it meanwhile
    const reopened = current.state === 'reopened';
    show(reopened ? await required(store.getPublished(id)) : current, { editable: false, published: reopened });
    // Why this record shows read only: a state, kept on the status line (our own other tab keeps takenText's wording).
    message(error.lease?.holder === userId ? takenText(error.lease) : describe(error), 'danger');
    await keptNotice(id, error.lease);
  }

  // release: this save is the leave, so the same update also releases the lease (data.md 2.6).
  // create: store a new form even when nothing else was entered yet (a photo's key names its record).
  async function flushDraft({ release = false, create = false } = {}) {
    clearTimeout(draftTimer);
    // A pending 400 ms draft sync runs now: after a leave it would find the page read only and keep a stale draft
    // (e.g. an edit typed back to the stored form right before leaving).
    if (formDraftTimer) { clearTimeout(formDraftTimer); keepFormDraft(); }
    if (!editing || !(changed() || (create && !record))) return;
    const data = app.getState();
    const text = JSON.stringify(data);
    const started = generation;
    if (!record) {
      const result = await store.create(project, data);
      if (started !== generation) {
        // Cleared or imported meanwhile: keep the created draft as sent, but do not claim it (nobody edits it now).
        if (!isQueued(result)) await showDays(result);
        return;
      }
      record = recordOf(result);
      record.stored = text;
      baseline = text;
      // Stored: the new-form draft goes, and an edit made meanwhile moves to the record's own key.
      // NOTE(ceiling): data.md 2.4(b) -- if the tab is hard-closed after create() reaches the server but before its
      // response, the draft is never cleared, the next blank form restores it and saving it creates a SECOND record (no
      // dedup, no platform API). Upgrade path: none on the plugin side; only a platform dedup would close it.
      void dropDraft(draftKey(null));
      if (changed()) keepFormDraft();
      if (isQueued(result)) {
        // Created offline: the envelope has the client record_id (usable at once) but no state; a create is always a
        // draft. Writes go on without a lease (a record nobody holds accepts them); syncedBack() claims it.
        record.state = 'draft';
        record.queued = true;
        render();
        message(`草稿已存 ${clock(Date.now())}`);
        return;
      }
      render();
      // create does not lease the record (store.mjs create); claim it to keep editing, unless this save is the leave.
      if (!release) await store.claim(result.record_id).catch(inClaim);
      await showDays(result);
    } else {
      const target = record;
      let result;
      try { result = await store.update(target.id, { version: target.version, body: data, release }); }
      catch (error) { if (started !== generation) return; throw error; } // the form now belongs to a new record
      // Kept even after Clear/Import: leaveReplaced() then saves on top of this version.
      target.version = result.version;
      target.stored = text;
      if (started !== generation) return;
      baseline = text;
      // Stored: the draft goes. An edit typed meanwhile is saved again as a draft now, based on the version just written
      // (data.md 2.4(b): base_version is the version "you most recently loaded/wrote for this record").
      if (!changed()) void dropDraft(draftKey(target));
      else keepFormDraft();
      if (!isQueued(result)) {
        // Our lease expired and nobody took over: the write succeeded but did not renew it (data.md 2.6), so claim again.
        if (!release && result.lease === null) await store.claim(target.id).catch(inClaim);
        if (store.recordDays(result).some(day => !availableDays.includes(day))) await showDays(result);
      }
    }
    message(`草稿已存 ${clock(Date.now())}`);
  }
  function saveNow(options) {
    const run = saving.then(() => flushDraft(options));
    saving = run.catch(() => {});
    return run;
  }
  // The two LEASE_HELD cases differ by holder (design §4.4); a lease lost without details (a failed back/forward
  // cache re-claim) keeps 1.2.x's generic text. An unsaved edit is never dropped here: it went to the conflict flow.
  function takenText(lease) {
    const reload = '要重新載入請在清單再選一次這筆紀錄。';
    if (!lease) return `編輯權已被其他人接手，這個畫面改為唯讀。${reload}`;
    if (lease.holder === userId) return `這筆紀錄已在你的另一個分頁或裝置開啟，這個畫面改為唯讀。${reload}`;
    return `已由 ${lease.holder_name} 接手，這個畫面改為唯讀。${reload}`;
  }
  function lockLost(error) {
    if (error.message !== 'LEASE_HELD' && error.message !== 'PUBLISHED') return false;
    editing = false;
    picker.value = '';
    render();
    message(error.message === 'PUBLISHED' ? describe(error) : takenText(error.lease), 'danger');
    return true;
  }
  // A refused write (data.md 2.4(b)): the platform keeps the edit, shows its one dialog and returns the choice. Nothing
  // is sent again on its own; after a refused publish or delete, 'mine' has only saved the edit (press it again).
  async function settleConflict(error) {
    clearTimeout(draftTimer);
    const target = record;
    editing = false; // nothing is written while the user decides (the SDK would refuse it with CONFLICT_PENDING)
    render();
    let result;
    try { result = await store.resolveConflict(error, app.getState()); } catch (next) {
      // The choice itself was refused (an offline 'mine' rejects OFFLINE: M2 C3). The edit stays kept and is asked
      // again at the next open; nothing is edited now, so the screen says so and target's lease is given back.
      if (record?.id === target.id) { clearSelection(); message('請選擇紀錄，或新增一筆。'); }
      await giveBack(target.id);
      throw next;
    }
    if (result.choice !== 'later') await dropDraft(draftKey(target)); // written (mine) or dropped (theirs)
    if (record !== target) return; // another record was opened meanwhile
    if (result.choice === 'mine') {
      show(mineRecord(result, { record_id: target.id, serial: target.serial, state: target.state, published: target.published }), { editable: true });
      // Queued offline (Studio 2bc745b): claimed again once the queue has sent it (syncedBack), as a create made offline.
      if (isQueued(result.record)) record.queued = true;
      // Written without a lease (ours had expired): claim again to keep editing, as after an autosave.
      else if (result.record.lease === null) {
        // Another record opened while claiming: the write is stored, so nothing is said and that record keeps its screen.
        try { await store.claim(target.id); } catch (next) { if (record === target) throw next; return; }
        if (record !== target) { // the claim went through after all: give that lease back
          await giveBack(target.id);
          return;
        }
      }
      message(`草稿已存 ${clock(Date.now())}`);
    } else if (result.choice === 'later') {
      lockLost(error); // 知道了: kept on this device, asked again the next time the record is opened
    } else if (error.message === 'LEASE_HELD') {
      await showLeased(target.id, error); // no claim: it would take the lease back from our own other tab
    } else {
      // The latest server version, opened on the switch queue like any open. Not awaited: this may itself run inside
      // a queued switch (step 5 of an open), which would then wait for itself.
      transition = transition.then(() => (record === target ? open(target.id) : undefined)).catch(next => { if (!lockLost(next)) fail(next); });
    }
  }
  // A claim refused inside a save (re-claiming an expired lease) is a lost lease, not a refused write: it stays out of
  // the conflict flow, which is for refused writes only (data.md 2.4(b)), and goes to lockLost as before.
  function inClaim(error) { throw Object.assign(error, { inClaim: true }); }
  function writeFailed(error) {
    if (record && conflictCodes.includes(error.message) && !error.inClaim) return settleConflict(error).catch(next => { if (!lockLost(next)) fail(next); });
    if (!lockLost(error)) fail(error);
    return undefined;
  }
  function autosave() {
    saveNow().catch(writeFailed);
  }
  // Publish gate: renders the summary of malformed measured values (hidden when none) and returns their count.
  function checkMeasuredValues() {
    const errors = app.measuredValueErrors();
    app.renderMeasuredErrors(errors);
    return errors.length;
  }
  function measuredBlockText(count) { return `有 ${count} 個欄位格式錯誤，修正後才能發布。`; }
  function clearPublishBlock() {
    publishBlock = '';
    app.renderMeasuredErrors([]);
  }
  function scheduleDraft() {
    // Every form edit comes through here (DOM events, and host undo via continuousWallBridge), so the badge follows too.
    if (countFailedChecks() !== failedChecks) renderHostToolbar();
    if (publishBlock) {
      const count = checkMeasuredValues();
      const text = count ? measuredBlockText(count) : '';
      // Only our own status line follows the count; a newer message (e.g. 草稿已存) stays.
      if (status.textContent === publishBlock && text !== publishBlock) message(text, count ? 'danger' : undefined);
      publishBlock = text;
    }
    if (!editing) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(autosave, draftDelayMs);
    clearTimeout(formDraftTimer);
    formDraftTimer = setTimeout(keepFormDraft, formDraftDelayMs);
  }
  // The form draft (data.md 2.4(b), "the gap write-ahead doesn't cover"): the SDK's write-ahead only keeps what was
  // passed to update(), so edits typed since the last autosave, and a new form not yet created, go to studio.draft
  // 400 ms after the edit: rec-<record_id> for a stored record, new-<collection>-<project_key> for a new form. It holds
  // only what the server does not have yet: a form equal to the stored one drops it, so it never brings back removed
  // text. A new form restores it (restoreNewDraft), opening the record submits it (showOpened step 5).
  // NOTE(ceiling): data.md 2.4(b) -- "keystrokes in the final few hundred milliseconds before a hard tab close ... can
  // still be lost; accepted, not solved, the same ceiling any debounced autosave has". Upgrade path: none planned.
  function draftKey(target = record) { return target ? `rec-${target.id}` : `new-${store.COLLECTION}-${project.project_key}`; }
  function dropDraft(key) { return studio.draft.clear(key).catch(fail); }
  function keepFormDraft() {
    formDraftTimer = 0;
    if (!editing || !project) return;
    // data.md 2.4(b): a stored record's draft is {body, base_version} -- base_version the version this edit started
    // from, the one this page holds now; a new form's draft stays a plain body.
    const value = record ? { body: app.getState(), base_version: record.version } : app.getState();
    if (changed()) studio.draft.save(draftKey(), value).then(() => { draftQuotaSaid = false; }, draftFailed);
    else void dropDraft(draftKey());
  }
  // A full draft store (DRAFT_QUOTA) would repeat on every 400 ms draft: said once until a draft save succeeds again.
  function draftFailed(error) {
    if (error.message === 'DRAFT_QUOTA') {
      if (draftQuotaSaid) return;
      draftQuotaSaid = true;
    }
    fail(error);
  }

  async function releaseEdit() {
    if (!editing || !record) return;
    const id = record.id;
    editing = false;
    render();
    // A draft update still in flight (Clear during autosave) must land before its lease is released.
    await saving;
    // A no-op once update({release:true}) released it (the SDK no longer holds that lease, also while it is queued).
    await giveBack(id);
  }
  function lostText(target, error) {
    return `${recordName(target)} 最後的修改沒有存到（${describe(error)}），下次開啟這筆紀錄時會自動再送出。`;
  }
  // Every way out of a record (案場, another record or date, leaving the page in Studio) comes here: unsaved edits go
  // in one update that also releases (design §4.9), otherwise the lease is released alone. When the server refuses
  // that save, the platform keeps the edit and asks the user (data.md 2.4(b)); 'mine' writes it with the release, and
  // the leave goes on whatever the choice, so the user is never trapped and nothing is dropped unasked.
  async function leaveRecord() {
    try { await saveNow({ release: true }); } catch (error) {
      if (!record || !conflictCodes.includes(error.message)) throw error;
      const target = record;
      const { id } = target;
      editing = false; // nothing else is written while the user decides
      render();
      const result = await store.resolveConflict(error, app.getState(), { release: true });
      if (result.choice !== 'later') await dropDraft(draftKey(target));
      await giveBack(id); // a no-op after 'mine', whose write released it
      return;
    }
    await releaseEdit();
  }
  // Clear/Import leave the record they replace the same way (user decision 2026-09-26): the edit still unsaved when
  // the form was replaced goes in one update that also releases, otherwise only the lease is released. It runs
  // behind the form's new record: a conflict is asked about like any other, any other failure only reports (the SDK's
  // own write-ahead entry keeps that edit, and opening the record asks about it again).
  async function leaveReplaced(target, body) {
    await saving; // a save of this record still in flight lands first (and moves target.version)
    const text = body && JSON.stringify(body);
    try {
      if (body && text !== target.stored) {
        await store.update(target.id, { version: target.version, body, release: true });
        await dropDraft(draftKey(target));
      } else await giveBack(target.id);
    } catch (error) {
      if (!body || text === target.stored) return; // An unreleased lease expires on its own after one hour.
      if (!conflictCodes.includes(error.message)) { notice(lostText(target, error)); return; }
      try {
        if ((await store.resolveConflict(error, body, { release: true })).choice !== 'later') await dropDraft(draftKey(target));
      } catch (next) { fail(next); return; }
      await giveBack(target.id); // a no-op after 'mine', whose write released it
    }
  }

  // A publish or remove of target refused after another record was opened: only the action did not happen. A publish
  // saved the edit before it; a remove saves nothing (unsaved edits are deleted along with the record), so a refused
  // remove leaves the record as last saved. The conflict flow or lockLost would act on the record now shown (its form as mine), so
  // neither runs; one notice says what happened to target, and its lease is given back.
  async function movedOnRefusal(target, error, what) {
    await giveBack(target.id);
    notice(`${recordName(target)} ${what}：${describe(error)}`);
  }
  async function publishRecord() {
    // Drafts may hold malformed values; a published record must not (every measured value stays computable).
    const malformed = checkMeasuredValues();
    if (malformed) {
      publishBlock = measuredBlockText(malformed);
      message(publishBlock, 'danger');
      studio.scrollTo({ top: document.querySelector('#measured-errors').getBoundingClientRect().top + window.scrollY });
      return;
    }
    const target = record;
    if (!(await studio.confirm('發布後這筆紀錄會鎖定成唯讀，其他人看到和列印的都是這個版本。確定發布？'))) return;
    if (!editing || record !== target) return; // the lease was lost or another record opened meanwhile
    await saveNow();
    // Nothing is written after this final save (a leave stops editing the same way): an autosave before the publish
    // would move the version, and the publish would be refused VERSION_CONFLICT on the user's own edit. Every exit
    // that does not publish makes the form editable again.
    // NOTE(ceiling): text typed while the final save is on its way is not in it, and the published view replaces it.
    // Upgrade path: turn the form read only before the final save (flushDraft would then have to save a read-only form).
    editing = false;
    clearTimeout(draftTimer);
    render();
    const resume = () => { if (record === target) { editing = true; render(); } };
    let result;
    try {
      // Publish only what the server holds (design §4.6): a write still queued offline would be left out.
      await studio.sync.flush();
      const { pending, conflicts } = studio.sync.status();
      // A queued write that became a conflict is not on the server either: publishing now would drop that edit.
      if (conflicts > 0) { resume(); notice('有未處理的離線衝突，處理後才能發布。'); return; }
      // Offline, publish is disabled; here the page is online and writes still wait (host paused for login, retrying).
      if (pending > 0) { resume(); notice('還有資料等待上傳，上傳完成後再發布。'); return; }
      if (record !== target) {
        // Another record was opened meanwhile: its leave found this form read only, so the lease is given back here.
        await giveBack(target.id);
        return;
      }
      result = await store.publish(target.id, target.version);
    } catch (error) {
      if (record !== target) { await movedOnRefusal(target, error, '沒有發布'); return; }
      resume(); // editable again before writeFailed decides, as for an autosave
      throw error;
    }
    // Another record was opened while the publish was on its way: it stays shown (the publish released this lease),
    // and the list shows this one as published.
    if (record !== target) { await refresh(); return; }
    show(result, { editable: false, published: true });
    await refresh();
    message(`已發布${recordName()}`);
  }
  // gap c: reopen takes no lease (store.mjs reopenRecord), so claim right after it; someone may claim in between.
  async function unlockRecord() {
    const target = record;
    // The host dialog enforces the platform's 1-200 characters (sdk.md prompt maxLength/required).
    const reason = (await studio.prompt('請輸入解除鎖定的原因（會留在紀錄歷程裡）', { maxLength: 200, required: true }))?.trim();
    if (!reason || record !== target) return; // cancelled, left blank, or another record opened meanwhile
    await store.reopen(target.id, target.version, reason);
    if (record !== target) return; // another record was opened meanwhile
    try {
      await store.claim(target.id);
    } catch (error) {
      if (error.message !== 'LEASE_HELD') { await open(target.id); return; } // show what the server now holds
      // Unlocked, but another user edits it now: like open(), show its published version read only.
      show(await required(store.getPublished(target.id)), { editable: false, published: true });
      await refresh();
      message(`已解除鎖定，但 ${error.lease.holder_name} 已先開始編輯。`, 'danger');
      await keptNotice(target.id, error.lease);
      return;
    }
    // A kept edit is asked about here too, as when opening.
    try { await showOpened(target.id, null, '已解除鎖定，編輯中。'); } catch (error) { await openFailed(target.id, true); throw error; }
    await refresh();
  }

  async function changeProject(next) {
    // NOTE(ceiling): a rename in the same project does not refresh blankBaseline, so an untouched blank new form
    // sees the name change as an edit and autosaves a name-only draft. Upgrade path: in this branch also set
    // overview.project inside blankBaseline, and baseline too when the form still equals the blank one.
    if (project && next && project.project_key === next.project_key) { project = next; useProjectName(next); return; }
    dayPicker.close();
    try { await leaveRecord(); } catch (error) {
      fail(error);
      await releaseEdit(); // release against the old project before switching
    }
    project = next;
    clearSelection();
    document.querySelector('.app-shell').inert = !next;
    if (!next) {
      picker.replaceChildren();
      picker.disabled = true;
      availableDays = [];
      selectedDay = null;
      renderCalendar();
      controls.hidden = false;
      message('請先選擇案場。');
      return;
    }
    // Nothing of the previous project stays listed (M2 O4): emptied before the read, so a refused read leaves an empty,
    // disabled list until reconnected() reads it again.
    listFailed = true;
    projectRecords = [];
    availableDays = [];
    selectedDay = null;
    renderCalendar();
    renderPicker();
    message('');
    await listProject();
    controls.hidden = false;
  }
  async function listProject() {
    await refreshDays();
    selectedDay = availableDays[0] || null;
    shownMonth = (selectedDay || new Date().toISOString().slice(0, 10)).slice(0, 7);
    renderCalendar();
    renderPicker();
    if (!editing) message(availableDays.length ? '請選擇紀錄，或新增一筆。' : ''); // a new form started meanwhile keeps its text
  }

  // A soft delete (design §4.8); photo blobs stay (gap e), as a deleted record can still be restored on the platform.
  async function deleteRecord() {
    const target = record;
    // Nothing is written from here to the remove (as for publish): an autosave in between would move the version and
    // the remove would be refused VERSION_CONFLICT on the user's own edit. An edit not yet saved goes with the record.
    editing = false;
    clearTimeout(draftTimer);
    render();
    const body = app.getState(); // taken now (defensive): once another record is opened, the form is that record's
    try {
      await saving; // an autosave in flight moves target.version first
      await store.remove(target.id, target.version, body);
    } catch (error) {
      if (record !== target) { await movedOnRefusal(target, error, '沒有刪除'); return; }
      editing = true; // editable again before writeFailed decides
      render();
      throw error;
    }
    void dropDraft(draftKey(target));
    // Another record was opened while the remove was on its way: it stays shown (the remove released this lease).
    if (record !== target) { await refresh(); return; }
    // Nothing of it is left to save, release or restore: clearSelection() below then leaves no record behind.
    record = null;
    editing = false;
    clearSelection();
    await refreshDays();
    if (!availableDays.includes(selectedDay)) selectedDay = availableDays[0] || null;
    shownMonth = (selectedDay || new Date().toISOString().slice(0, 10)).slice(0, 7);
    renderCalendar();
    await refresh();
    message('已刪除紀錄');
  }

  async function publishAction() {
    // The save before publishing is the autosave, so a refused save or publish takes the same way.
    try { await publishRecord(); } catch (error) { await writeFailed(error); }
  }
  async function unlockAction() {
    try { await unlockRecord(); } catch (error) { fail(error); }
  }
  async function deleteAction() {
    const target = record;
    const confirmed = await studio.confirm('刪除後無法從清單找回這筆紀錄，草稿和已發布的版本都會一起刪除。',
      { title: '刪除施工紀錄？', confirmLabel: '確認刪除', cancelLabel: '取消', tone: 'danger' });
    // The host dialog does not block autosave: skip if the lock was lost or another record opened meanwhile.
    if (!confirmed || !editing || record !== target) return;
    try { await deleteRecord(); } catch (error) { await writeFailed(error); }
  }
  async function clearAction() {
    const confirmed = await studio.confirm('將「連續壁、導溝、鋼筋籠」三種表單還原到未輸入的狀態，無法復原，確定清除？',
      { title: '清空全部資料', confirmLabel: '還原預設', cancelLabel: '取消', tone: 'danger' });
    // app.newRecord() fires continuous-wall-clear, whose listener below schedules the draft.
    if (!confirmed || !editing) return;
    void dropDraft(draftKey(null)); // an explicit Clear also drops the new-form draft (data.md 2.4(b))
    app.newRecord();
  }

  async function preview(scope) {
    if (!showingPublished) { notice('發布後才能列印；列印內容是正式版。'); return; }
    let html;
    try {
      app.preparePrint(scope);
      html = printHtml();
    } catch (error) { fail(error); return; } finally {
      document.body.dataset.printScope = 'none';
      document.title = originalTitle;
    }
    // Resolves 'printed' or 'closed'; either way the page has nothing left to undo.
    try { await studio.print({ html, preview: true }); } catch (error) { fail(error); }
  }

  function printHtml() {
    // @media print rules stay wrapped: the host preview applies them as print media (Studio 8a3201e).
    const css = [...document.styleSheets]
      .flatMap(sheet => [...sheet.cssRules])
      // An @import in the middle of one <style> is dropped, so inline the imported rules (the Kit design tokens).
      // Studio serves /studio-kit.css already token-inlined, so this only matters for the local check server,
      // which serves the Kit source file with its @import.
      .map(rule => (rule instanceof CSSImportRule ? [...rule.styleSheet.cssRules].map(inner => inner.cssText).join('\n') : rule.cssText))
      .join('\n');
    const title = document.createElement('title');
    title.textContent = document.title;
    return `<!doctype html><html lang="zh-Hant-TW" style="${document.documentElement.style.cssText}"><head><meta charset="UTF-8">${title.outerHTML}<style>${css}\n@media print{.continuous-wall .print-report{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body data-print-scope="${document.body.dataset.printScope}"><div class="continuous-wall" data-print-preview>${document.querySelector('#print-report').outerHTML}</div></body></html>`;
  }

  // Design §4.5 step 2: a photo needs its record_id first, so a new form is created (and claimed) right away.
  // Null when this page does not edit a stored record afterwards (the form was replaced meanwhile).
  async function photoRecordId() {
    if (!project) throw new Error('請先選擇案場。');
    if (!editing) throw new Error('這個畫面目前是唯讀，照片沒有加入。');
    if (!record) await saveNow({ create: true });
    return editingRecordId();
  }
  function editingRecordId() { return editing && record ? record.id : null; }

  // knownText: the text of a platform code this page has its own text for, else '' (app.js import failure).
  window.continuousWallBridge = { preview, scheduleDraft, photoRecordId, editingRecordId, fail, describe, knownText: error => errorText[error.message] || '' };

  // Clear and import both replace the whole form and fire this same event (app.js clearAllData /
  // importJsonFile). Resetting to blankBaseline (not the live state) means Clear -- which leaves the
  // form blank -- has nothing to autosave, while an import -- which differs from blank -- autosaves
  // as a new draft after the usual 3 s pause. The previous record keeps its last autosaved draft and is released.
  // The replaced record's pending 400 ms form draft is not flushed here: it relies on the 清除 confirm and the 匯入 file
  // pick taking longer than that debounce, so the draft has already run. Without the confirm, continuous-wall-clear's
  // scheduleDraft would cancel it and the replaced record's draft would miss its last keystrokes.
  window.addEventListener('continuous-wall-replacing', () => {
    replacing = editing && record ? { target: record, body: app.getState() } : null;
  });
  window.addEventListener('continuous-wall-clear', () => {
    generation += 1;
    clearPublishBlock();
    restoredNote.hidden = true;
    // app.js fires continuous-wall-replacing right before every Clear/Import, so replacing holds the record left.
    const { target, body } = replacing || {};
    replacing = null;
    if (target) void leaveReplaced(target, body);
    record = null;
    editing = true;
    showingPublished = false;
    useProjectName(project);
    useReviewerDefault();
    baseline = blankBaseline;
    picker.value = '';
    render();
    scheduleDraft();
  });

  if (!studio?.records || !studio.onProjectChange) return;
  if (hostToolbar) {
    hostToolbar.onAction(handleToolbarAction);
    const observer = new MutationObserver(renderHostToolbar);
    observer.observe(document.querySelector('#record-switcher'), { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
    for (const navigation of document.querySelectorAll('.tab-navigation')) {
      observer.observe(navigation, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    }
    renderHostToolbar();
  }
  projectName.readOnly = true;
  // Project changes queue behind this, so the first blank form already has the name and does not count as an edit.
  transition = studio.me().then(me => { reviewerName = me?.displayName || ''; userId = me?.userId || ''; }).catch(() => {});
  render();
  controls.hidden = false;
  // Until the host reports a project the form stays inert, so say why instead of showing an empty card.
  message('請先選擇案場。');
  // Every switch (date, record list, 新增一筆, 案場) runs one at a time on `transition`: a pick while another
  // record is still being claimed would find nothing editable to leave, and that record's lease would stay held.
  // NOTE(ceiling): a burst of picks opens each record in turn, and an open waiting on its conflict question holds back
  // later switches and onCanClose (then the host's 10 s onCanClose limit, unverified). Upgrade path: skip a queued
  // open that a newer pick has replaced.
  dayPicker = studio.kit.datePicker(dateButton, { month: shownMonth, enabledDates: availableDays, selected: selectedDay, onSelect: day => { transition = transition.then(() => selectDay(day)); }, dayLabel: d => `${d} 的施工紀錄` });
  newButton.addEventListener('click', () => {
    transition = transition.then(async () => {
      try {
        await leaveRecord();
        startNew();
      } catch (error) { fail(error); }
    });
  });
  picker.addEventListener('change', () => {
    const id = picker.value; // read now: a queued open may still move the picker
    const day = selectedDay;
    const from = project?.project_key; // picked from this project's list
    transition = transition.then(async () => {
      // A 案場 switch queued before this pick replaced that list (M2 O4): the pick is dropped, not opened here.
      if (project?.project_key !== from) return;
      try {
        await leaveRecord();
        if (availableDays.includes(day)) selectedDay = day;
        shownMonth = selectedDay.slice(0, 7);
        await refresh();
        renderCalendar();
        if (id) await open(id);
        else clearSelection();
      } catch (error) { fail(error); picker.value = record?.id || ''; }
    });
  });
  studio.onProjectChange(next => {
    transition = transition.then(() => changeProject(next)).catch(error => fail(error));
  });
  // In-app navigation: flush the pending draft, then release. A throw makes Studio ask
  // 「此外掛尚未完成儲存，仍要離開嗎？」, so a failed save never traps the user.
  studio.onCanClose(async () => {
    await transition;
    try {
      await leaveRecord();
      if (record) { clearSelection(); message('已結束編輯，請重新選擇紀錄。'); }
    } catch (error) { fail(error); throw error; }
  });
  for (const type of ['input', 'change', 'submit', 'click']) document.addEventListener(type, scheduleDraft);
  // Our lease was taken by our own other tab or device, or a back/forward-cache re-claim failed (sdk.md, data.md 2.6).
  studio.records.lease.onLost(event => {
    if (event.collection !== store.COLLECTION || event.record_id !== record?.id || !editing) return;
    const target = record;
    // A refused write of ours fires this before its own rejection reaches writeFailed: let that save settle first.
    void saving.then(() => {
      if (record !== target || !editing) return;
      // An unsaved edit is sent, so its refusal goes to the conflict flow (kept and asked) instead of being dropped.
      if (changed()) autosave();
      else lockLost(Object.assign(new Error('LEASE_HELD'), { lease: event.lease }));
    });
  });
  // The offline queue (studio.sync, data.md 2.7): offline, the status line says drafts wait on this device and the
  // actions that need the server are disabled; once every queued write is sent, say so and claim a record created
  // offline, like an online create does.
  function offlineText(pending) { return `離線中：草稿暫存在這台裝置，恢復連線後會自動上傳${pending ? `（待上傳 ${pending} 筆）` : ''}。`; }
  async function syncedBack() {
    const target = record;
    if (!target) return;
    if (target.queued && editing) {
      await store.claim(target.id);
      delete target.queued;
    }
    if (record === target) await showDays(await required(store.get(target.id)));
  }
  function renderSync() {
    const sync = studio.sync.status();
    const was = offline;
    offline = !sync.online;
    if (offline) setStatus(offlineText(sync.pending), 'warning');
    else if (was) setStatus(statusState.value, statusState.tone);
    if (offline !== was) {
      if (offline) dayPicker.close();
      else reconnected();
      renderPicker();
      render();
    }
    const drained = sync.online && !sync.pending && !sync.conflicts;
    if (drained && syncWaiting) {
      if (sync.last_synced_at) message(`已同步 ${clock(sync.last_synced_at)}`); // null: nothing was ever sent
      // Not inside the queue's own event: after any save in flight, like every other write of this page.
      const run = saving.then(syncedBack);
      saving = run.catch(() => {});
      run.catch(error => { if (!lockLost(error)) fail(error); });
    }
    syncWaiting = !drained;
  }
  // Back online (renderSync, on the sync status event; Studio 2bc745b reports every online/offline change): a list read
  // refused on a switch is read again (M2 O4).
  // NOTE(ceiling): if that event is missed or a read still fails then, the list stays empty (never another project's
  // records) until the next 案場 pick or create. Upgrade path: a retry on the next user action if M2 shows that gap.
  function reconnected() {
    transition = transition.then(async () => {
      if (listFailed && project) await listProject();
    }).catch(error => { if (!isOffline(error)) fail(error); });
  }
  studio.sync.onChange(renderSync);
  renderSync();
})();
