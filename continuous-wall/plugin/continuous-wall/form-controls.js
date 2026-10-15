(function() {
  let t = null;
  document.addEventListener("pointerdown", (e) => {
    const n = e.target instanceof Element ? e.target.closest("select") : null;
    !n && t && document.activeElement === t && t.blur(), t = n;
  }, true), document.addEventListener("keydown", () => {
    t = null;
  }, true), document.addEventListener("change", (e) => {
    e.target === t && (e.target.blur(), t = null);
  });
})();
function loadingHtml(t) {
  return `<p class="kit-loading" role="status">${t}</p>`;
}
// Computations read measured values strictly: a malformed one (e.g. "1..2") counts as empty, as it
// did when these were type="number" inputs whose .value was "" on bad input. The optional minus
// stays because "-1" in a min="0" number input still had a value. Stored and printed values stay
// the raw text.
function measuredNumber(t) {
  const e = String(t ?? "");
  return /^-?(\d+\.?\d*|\.\d+)$/.test(e) ? Number.parseFloat(e) : null;
}
// Measured values are type="text" inputmode="decimal" with a pattern (Studio Kit layout.md), so a
// mouse wheel cannot change them. A pattern mismatch shows a .kit-field-error under the field; the
// value is still stored as typed and the draft autosave is never blocked.
const MEASURED_INPUT = 'input[inputmode="decimal"][pattern]';
function syncMeasuredError(t) {
  const id = `${t.id}-error`, bad = t.validity.patternMismatch;
  document.getElementById(id)?.remove();
  if (!bad) return t.removeAttribute("aria-invalid"), t.removeAttribute("aria-describedby");
  t.setAttribute("aria-invalid", "true"), t.setAttribute("aria-describedby", id);
  t.closest(".kit-field").insertAdjacentHTML("beforeend", `<span class="kit-field-error" id="${id}">${t.pattern.startsWith("-") ? "請輸入數字" : "請輸入 0 以上的數字"}</span>`);
}
// Publish gate: a non-empty value that does not match its field's pattern, tested like the HTML
// pattern attribute (whole value). Stored rows are checked with this, since their dialogs are closed.
function measuredMalformed(t, e) {
  const a = String(t ?? "");
  return a !== "" && !new RegExp(`^(?:${e})$`, "v").test(a);
}
// Values set from code fire no input event, so callers refresh after filling a form.
function syncMeasuredErrors(t) {
  t.querySelectorAll(MEASURED_INPUT).forEach(syncMeasuredError);
}
document.addEventListener("input", (e) => {
  e.target.matches?.(MEASURED_INPUT) && syncMeasuredError(e.target);
});
