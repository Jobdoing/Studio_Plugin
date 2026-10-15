const GUIDE_WALL_MEASURES = { 位置與淨寬: { kind: "range", unit: "cm", tolerance: 5, placeholder: ["例如：100", "例如：102"] }, 深度: { kind: "min", unit: "m", designMin: 1.8, placeholder: ["例如：2.0", "例如：2.1"] }, 牆厚: { kind: "min", unit: "cm", placeholder: ["例如：20", "例如：21"] }, 鋼筋: { kind: "rebar" }, 混凝土強度: { kind: "min", unit: "kgf/cm²", placeholder: ["例如：210", "例如：245"] }, 頂部基準高程: { kind: "elevation", unit: "m", placeholder: "例如：0.30" } }, GUIDE_WALL_EXAMPLE_VALUES = { 位置與淨寬: { design: "100", actual: "103" }, 深度: { design: "2.0", actual: "2.05" }, 牆厚: { design: "20", actual: "20.5" }, 鋼筋: { designBarNo: "D16", designBarSpacing: "20", barNo: "D16", barSpacing: "20", actual: "" }, 混凝土強度: { design: "210", actual: "245" }, 頂部基準高程: { actual: "0.30" } }, GUIDE_BAR_SPACINGS = ["10", "12.5", "15", "17.5", "20", "22.5", "25", "27.5", "30"], guideMeasure = (a) => GUIDE_WALL_MEASURES[a?.item] || null, guideAutoJudged = (a) => !!guideMeasure(a) && guideMeasure(a).kind !== "elevation", guideNumber = (a) => parseMeasure(a).value, guideFormat = (a) => String(Number(a.toFixed(2)));
function evaluateGuideMeasure(a) {
  const n = guideMeasure(a), e = { status: "empty", designBad: false, actualBad: false, note: "", message: "" };
  if (!n) return e;
  if (n.kind === "elevation") return parseMeasure(a.actual).invalid ? { ...e, status: "invalid", actualBad: true, message: INVALID_MEASURE_MESSAGE } : e;
  if (n.kind === "rebar") {
    const u = [a.designBarNo, a.designBarSpacing, a.barNo, a.barSpacing].map((p) => String(p ?? "").trim());
    if (u.some((p) => !p)) return e;
    const o = guideNumber(a.designBarSpacing), g = guideNumber(a.barSpacing), $ = u[0] === u[2], m = o !== null && g !== null && g <= o;
    if ($ && m) return { ...e, status: "pass" };
    const c = [];
    return $ || c.push(`實測號數 ${barSizeMark(u[2])} 與設計 ${barSizeMark(u[0])} 不同`), m || c.push(`實測間距 ${u[3]} cm 大於設計 ${u[1]} cm`), { ...e, status: "fail", actualBad: true, message: c.join("；") };
  }
  const t = parseMeasure(a.design), d = parseMeasure(a.actual);
  if (t.invalid || d.invalid) return { ...e, status: "invalid", designBad: t.invalid, actualBad: d.invalid, message: INVALID_MEASURE_MESSAGE };
  const l = t.value, i = d.value, s = n.unit;
  if (n.designMin !== void 0 && l !== null && l < n.designMin) return { ...e, status: "fail", designBad: true, message: `設計值 ${guideFormat(l)} ${s} 小於 ${n.designMin} ${s} 下限` };
  if (n.kind === "range") {
    if (l === null) return e;
    const u = l - n.tolerance, o = l + n.tolerance, g = `許可值 ${guideFormat(u)}～${guideFormat(o)} ${s}`;
    return i === null ? { ...e, note: g } : i < u || i > o ? { ...e, status: "fail", actualBad: true, note: g, message: `實測 ${guideFormat(i)} ${s} 超出許可值` } : { ...e, status: "pass", note: g };
  }
  if (l === null) return e;
  const r = `許可值 ≥ ${guideFormat(l)} ${s}`;
  return i === null ? { ...e, note: r } : i < l ? { ...e, status: "fail", actualBad: true, note: r, message: `實測 ${guideFormat(i)} ${s} 小於設計值` } : { ...e, status: "pass", note: r };
}
function applyGuideAutoResult(a) {
  return guideMeasure(a) ? rejudge(a, evaluateGuideMeasure(a).status, { valueChanged: true }) : null;
}
const guideLockedResults = (a) => autoLockedResults(a, evaluateGuideMeasure(a).status);
function guideSpacingOptions(a) {
  const n = String(a ?? "").trim(), e = [...GUIDE_BAR_SPACINGS];
  return n && !e.includes(n) && e.push(n), ['<option value="">間距</option>', ...e.map((t) => `<option value="${escapeHtml(t)}" ${t === n ? "selected" : ""}>${escapeHtml(t)}${GUIDE_BAR_SPACINGS.includes(t) ? "" : "（舊）"}</option>`)].join("");
}
function guideMeasureFieldsHtml(a, n, c) {
  const e = guideMeasure(a), t = evaluateGuideMeasure(a), d = (s) => s ? " is-invalid" : "", f = (s) => `guide-${c}-${s}`, l = `<small class="guide-measure-note${t.message ? " is-invalid" : ""}" data-guide-note>${escapeHtml([t.note, t.message].filter(Boolean).join("；"))}</small>`;
  if (e.kind === "elevation") return `<div class="kit-field guide-measure is-single"><div class="guide-measure-group${d(t.actualBad)}" data-guide-group="actual">
      <label class="kit-sr-only" for="${f("actual")}">頂部基準高程（GL-，${e.unit}）</label>
      <div class="kit-affix"><span class="kit-affix-unit">GL-</span><input id="${f("actual")}" type="text" inputmode="decimal" value="${escapeHtml(a.actual)}" placeholder="${escapeHtml(e.placeholder)}" ${n("actual")} autocomplete="off" /><span class="kit-affix-unit">${e.unit}</span></div>
    </div>${l}</div>`;
  if (e.kind === "rebar") {
    const s = (r, u, o, g) => `<fieldset class="kit-field kit-field--group guide-measure-group${d(g)}" data-guide-group="${r === "設計" ? "design" : "actual"}">
        <legend class="guide-measure-label">${r}</legend>
        <label class="kit-sr-only" for="${f(u)}">${r}號數</label><select id="${f(u)}" ${n(u)}>${barSizeOptions(a[u], "號數")}</select>
        <span class="guide-at">@</span>
        <label class="kit-sr-only" for="${f(o)}">${r}間距（cm）</label><div class="kit-affix"><select id="${f(o)}" ${n(o)}>${guideSpacingOptions(a[o])}</select><span class="kit-affix-unit">cm</span></div>
      </fieldset>`;
    return `<div class="kit-field guide-measure is-rebar">${s("設計", "designBarNo", "designBarSpacing", false)}${s("實測", "barNo", "barSpacing", t.actualBad)}${l}</div>`;
  }
  const i = (s, r, u, o) => `<div class="guide-measure-group${d(o)}" data-guide-group="${r === "design" ? "design" : "actual"}">
      <label class="guide-measure-label" for="${f(r)}">${s}</label>
      <div class="kit-affix"><input id="${f(r)}" type="text" inputmode="decimal" value="${escapeHtml(a[r])}" placeholder="${escapeHtml(u)}" ${n(r)} autocomplete="off" /><span class="kit-affix-unit">${e.unit}</span></div>
    </div>`;
  return `<div class="kit-field guide-measure">${i("設計", "design", e.placeholder[0], t.designBad)}${i("實測", "actual", e.placeholder[1], t.actualBad)}${l}</div>`;
}
function syncGuideMeasureCard(a, n) {
  if (!a) return;
  const e = evaluateGuideMeasure(n), t = guideLockedResults(n);
  a.querySelector('[data-guide-group="design"]')?.classList.toggle("is-invalid", e.designBad), a.querySelector('[data-guide-group="actual"]')?.classList.toggle("is-invalid", e.actualBad);
  const d = a.querySelector("[data-guide-note]");
  d && (d.textContent = [e.note, e.message].filter(Boolean).join("；"), d.classList.toggle("is-invalid", !!e.message)), syncAutoResultCard(a, n, t);
}
function guideMeasureText(a) {
  const n = guideMeasure(a), e = (i) => String(i ?? "").trim(), t = (i) => {
    const s = parseMeasure(i);
    return s.value === null || /^[+-]?\d+(\.\d+)?$/.test(e(i)) ? e(i) : guideFormat(s.value);
  };
  if (!n) return "";
  if (n.kind === "elevation") {
    const i = e(a.actual);
    return i ? guideNumber(i) === null ? i : `GL-${t(i.replace(/^(?:GL\s*)?-\s*/i, ""))} ${n.unit}` : "";
  }
  if (n.kind === "rebar") {
    const i = (r, u) => [e(r) ? barSizeMark(r) : "", e(u) ? `@${e(u)} cm` : ""].join("");
    return [i(a.designBarNo, a.designBarSpacing) && `設計 ${i(a.designBarNo, a.designBarSpacing)}`, i(a.barNo, a.barSpacing) && `實測 ${i(a.barNo, a.barSpacing)}`, e(a.actual)].filter(Boolean).join("；");
  }
  const d = (i) => guideNumber(i) === null ? e(i) : `${t(i)} ${n.unit}`, { note: l } = evaluateGuideMeasure(a);
  return [e(a.design) && `設計 ${d(a.design)}`, e(a.actual) && `實測 ${d(a.actual)}`, n.kind === "range" && l ? `（${l}）` : ""].filter(Boolean).join("；").replace("；（", "（");
}
