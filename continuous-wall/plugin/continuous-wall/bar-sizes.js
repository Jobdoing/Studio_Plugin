const BAR_SIZES = [["D10", "#3"], ["D13", "#4"], ["D16", "#5"], ["D19", "#6"], ["D22", "#7"], ["D25", "#8"], ["D29", "#9"], ["D32", "#10"], ["D36", "#11"], ["D39", "#12"], ["D43", "#14"], ["D50", "#16"], ["D57", "#18"]], BAR_SIZE_MARKS = Object.fromEntries(BAR_SIZES), escapeHtml = (t) => String(t ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"), barSizeMark = (t) => BAR_SIZE_MARKS[t] || String(t ?? "").trim(), barSizeLabel = (t) => {
  const e = String(t ?? "").trim();
  return e ? BAR_SIZE_MARKS[e] ? `${e}（${BAR_SIZE_MARKS[e]}）` : `${e}（舊）` : "";
};
function barSizeOptions(t, e = "請選擇") {
  const r = String(t ?? "").trim(), l = BAR_SIZES.map(([n]) => n);
  return r && !l.includes(r) && l.push(r), [`<option value="">${escapeHtml(e)}</option>`, ...l.map((n) => `<option value="${escapeHtml(n)}" ${n === r ? "selected" : ""}>${escapeHtml(barSizeLabel(n))}</option>`)].join("");
}
