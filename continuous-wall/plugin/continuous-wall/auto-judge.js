const FULL_WIDTH_DIGITS = "０１２３４５６７８９";
function normalizeMeasureText(e) {
  return String(e ?? "").replace(/[０-９]/g, (t) => String(FULL_WIDTH_DIGITS.indexOf(t))).replace(/[．。，]/g, ".").replace(/[－—–−]/g, "-").replace(/[＋]/g, "+").replace(/[／]/g, "/").replace(/\s+/g, " ").trim();
}
function parseMeasure(e, { ratio: t = false } = {}) {
  const u = normalizeMeasureText(e);
  if (!u) return { value: null, empty: true, invalid: false };
  if (t) {
    const a = u.match(/^1\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (a) return { value: Number(a[1]), empty: false, invalid: false };
  }
  const l = u.match(/^(?:GL\s*)?([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([^\d]*)$/i), n = l ? Number(l[1]) : NaN;
  return !l || /[+-]/.test(l[2]) || !Number.isFinite(n) ? { value: null, empty: false, invalid: true } : { value: n, empty: false, invalid: false };
}
const AUTO_RESULTS = { pass: "符合", fail: "不符合" };
function rejudge(e, t, { valueChanged: u = false } = {}) {
  if (e.result === "不適用") return null;
  const l = !e.auto && e.result !== "待確認";
  if (l && !u) return null;
  const n = AUTO_RESULTS[t], a = e.result;
  return n ? (e.result = n, e.auto = t) : e.auto && (e.result = "待確認", e.auto = ""), l && e.result !== a ? a : null;
}
function autoLockedResults(e, t) {
  return !e.auto && AUTO_RESULTS[t] && e.result === AUTO_RESULTS[t] && (e.auto = t), t !== "fail" ? [] : (e.result === "符合" && (e.result = "不符合", e.auto = "fail"), ["符合"]);
}
const INVALID_MEASURE_MESSAGE = "非數值，請手動判定", AUTO_JUDGE_BADGE = '<small class="kit-chip auto-badge" data-status="info" title="填入數值後自動判定 ✓／✗；可再手動改判，改數值後重新判定">自動判定</small>';
function markManualResult(e) {
  e.auto = "";
}
function syncAutoResultCard(e, t, u) {
  e && (e.querySelectorAll('input[type="radio"]').forEach((l) => {
    l.checked = l.value === t.result, l.disabled = u.includes(l.value);
  }), t.result === "不符合" ? e.dataset.status = "danger" : e.removeAttribute("data-status"));
}
