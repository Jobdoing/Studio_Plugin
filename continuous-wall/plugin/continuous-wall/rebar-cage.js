const REBAR_CAGE_DEFAULT_NOTE = "依設計圖說配置", REBAR_CAGE_MEASURED_PATTERN = "(?:[0-9]+[.]?[0-9]*|[.][0-9]+)", REBAR_CAGE_PARTS = [{ key: "outerVertical", part: "外側 垂直 主筋", template: "interval", pair: "innerVertical" }, { key: "innerVertical", part: "內側 垂直 主筋", template: "interval", mirrorOf: "outerVertical" }, { key: "outerHorizontal", part: "外側 水平 溫度筋", template: "interval", pair: "innerHorizontal" }, { key: "innerHorizontal", part: "內側 水平 溫度筋", template: "interval", mirrorOf: "outerHorizontal" }, { key: "horizontalTie", part: "水平 正交繫筋", template: "interval" }, { key: "verticalDiagonalSmall", part: "垂直 小斜拉筋", template: "interval" }, { key: "horizontalDiagonalSmall", part: "水平 小斜拉筋", template: "interval" }, { key: "jointVertical", part: "單元接頭垂直補強筋", template: "single" }, { key: "endPlateStopper", part: "端板擋筋(母單元)", template: "single", note: "依設計圖說配置，銲喉4mm且銲長至少50mm" }, { key: "vBrace", part: "V型固定加強筋", template: "single" }, { key: "crossDiagonalLarge", part: "交叉大斜拉筋", template: "single" }, { key: "verticalLug", part: "垂直護耳", template: "single" }, { key: "horizontalLug", part: "水平護耳", template: "single" }], REBAR_CAGE_RESULTS = ["待確認", "符合", "不符合", "不適用"], rebarCageDef = (e) => REBAR_CAGE_PARTS.find((s) => s.key === e), rebarCageText = (e) => String(e ?? "").trim(), rebarCageNumber = (e) => measuredNumber(e), createRebarCageInterval = () => ({ top: "", bottom: "", size: "", spacing: "", extra: { enabled: false, size: "", spacing: "" } }), createRebarCagePart = (e) => e.template === "interval" ? { key: e.key, result: "待確認", symmetric: false, intervals: [createRebarCageInterval()] } : { key: e.key, result: "待確認", symmetric: false, count: "", size: "", spacing: "" }, createRebarCageParts = () => REBAR_CAGE_PARTS.map(createRebarCagePart);
function normalizeRebarCageParts(e) {
  const s = Array.isArray(e) ? e : [];
  return REBAR_CAGE_PARTS.map((a) => {
    const t = s.find((l) => l && l.key === a.key) || {}, r = createRebarCagePart(a);
    if (r.result = REBAR_CAGE_RESULTS.includes(t.result) ? t.result : "待確認", r.symmetric = a.mirrorOf ? false : !!t.symmetric, a.template === "single") return r.count = rebarCageText(t.count), r.size = rebarCageText(t.size), r.spacing = rebarCageText(t.spacing), r;
    const n = Array.isArray(t.intervals) && t.intervals.length ? t.intervals : [{}];
    return r.intervals = n.map((l) => ({ top: rebarCageText(l?.top), bottom: rebarCageText(l?.bottom), size: rebarCageText(l?.size), spacing: rebarCageText(l?.spacing), extra: { enabled: !!l?.extra?.enabled, size: rebarCageText(l?.extra?.size), spacing: rebarCageText(l?.extra?.spacing) } })), r;
  });
}
function rebarCageSymmetric(e, s) {
  const a = rebarCageDef(e.key);
  return a.mirrorOf ? !!s.find((t) => t.key === a.mirrorOf)?.symmetric : !!e.symmetric;
}
const rebarCageMirrored = (e, s) => !!rebarCageDef(e.key).mirrorOf && rebarCageSymmetric(e, s), rebarCageGl = (e) => rebarCageText(e) ? `GL-${rebarCageText(e)}` : "";
function rebarCageBarText(e, s) {
  const a = rebarCageText(e) ? barSizeMark(e) : "", t = rebarCageText(s) ? `@${rebarCageText(s)}` : "";
  return `${a}${t}`;
}
function rebarCageIntervalText(e) {
  const s = rebarCageBarText(e.size, e.spacing), a = e.extra?.enabled ? rebarCageBarText(e.extra.size, e.extra.spacing) : "";
  return [s, a].filter(Boolean).join("+");
}
function rebarCagePrintRows(e, s) {
  const a = rebarCageDef(e.key);
  return rebarCageMirrored(e, s) ? [{ top: "", bottom: "", count: "", bars: "" }] : a.template === "single" ? [{ top: "", bottom: "", count: rebarCageText(e.count), bars: rebarCageBarText(e.size, e.spacing) }] : e.intervals.map((t) => ({ top: rebarCageGl(t.top), bottom: rebarCageGl(t.bottom), count: "", bars: rebarCageIntervalText(t) }));
}
function rebarCageSummary(e, s) {
  if (rebarCageMirrored(e, s)) return ["同外側"];
  const a = rebarCagePrintRows(e, s).map((t) => {
    const r = t.top || t.bottom ? `${t.top || "GL-?"}～${t.bottom ? t.bottom.replace("GL", "") : "?"}` : "", n = t.count ? `${t.count} 支` : "";
    return [r, n, t.bars].filter(Boolean).join(" ");
  }).filter(Boolean);
  return a.length ? a : ["尚未填寫"];
}
function rebarCageIntervalIssues(e) {
  return e.map((s, a) => {
    const t = /* @__PURE__ */ new Set(), r = rebarCageNumber(s.top), n = rebarCageNumber(s.bottom);
    r !== null && n !== null && n <= r && t.add("bottom");
    const l = a ? rebarCageNumber(e[a - 1].bottom) : null;
    return r !== null && l !== null && r < l && t.add("top"), t;
  });
}
function exportRebarCageParts(e) {
  const s = (a) => rebarCageNumber(a);
  return e.parts.map((a, t) => {
    const r = rebarCageDef(a.key), n = { item_no: t + 1, key: a.key, part: r.part, symmetric: rebarCageSymmetric(a, e.parts), result: a.result };
    return r.template === "single" ? { ...n, count: s(a.count), bar_size: a.size || null, spacing_cm: s(a.spacing) } : { ...n, intervals: a.intervals.map((l) => ({ top_m: s(l.top), bottom_m: s(l.bottom), bar_size: l.size || null, spacing_cm: s(l.spacing), extra: l.extra.enabled ? { bar_size: l.extra.size || null, spacing_cm: s(l.extra.spacing) } : null })) };
  });
}
function importRebarCageParts(e) {
  const s = Array.isArray(e) ? e : [], a = (t) => t == null ? "" : String(t);
  return normalizeRebarCageParts(s.map((t) => {
    const r = REBAR_CAGE_PARTS.find((n) => n.key === t?.key) || REBAR_CAGE_PARTS.find((n) => n.part === t?.part);
    return r ? r.template === "single" ? { key: r.key, result: t.result, symmetric: t.symmetric, count: a(t.count), size: a(t.bar_size), spacing: a(t.spacing_cm) } : { key: r.key, result: t.result, symmetric: t.symmetric, intervals: (Array.isArray(t.intervals) ? t.intervals : []).map((n) => ({ top: a(n?.top_m), bottom: a(n?.bottom_m), size: a(n?.bar_size), spacing: a(n?.spacing_cm), extra: { enabled: !!n?.extra, size: a(n?.extra?.bar_size), spacing: a(n?.extra?.spacing_cm) } })) } : null;
  }).filter(Boolean));
}
function rebarCagePrintTableHtml(e) {
  const s = (t) => escapeHtml(rebarCageText(t) || "-");
  return e.mode === "detailed" ? `<table class="print-table rebar-cage-print-table is-detailed"><thead><tr><th>項次</th><th>部位</th><th>頂部(m)</th><th>底部(m)</th><th>支數</th><th>號數@間距(cm)</th><th>對稱</th><th>結果</th></tr></thead><tbody>${e.parts.map((r, n) => {
    const l = rebarCageDef(r.key), c = rebarCagePrintRows(r, e.parts), p = rebarCageSymmetric(r, e.parts) ? "✔" : "-";
    return c.map((i, d) => {
      const o = d === 0, m = d === c.length - 1;
      return `<tr class="${o ? "" : "part-continued"} ${m ? "" : "part-has-more"}"><td>${o ? n + 1 : ""}</td><td class="text-left">${o ? escapeHtml(l.part) : ""}</td><td>${s(i.top)}</td><td>${s(i.bottom)}</td><td>${s(i.count)}</td><td>${s(i.bars)}</td><td>${o ? p : ""}</td><td>${o ? escapeHtml(r.result) : ""}</td></tr>`;
    }).join("");
  }).join("")}</tbody></table>` : `<table class="print-table rebar-cage-print-table is-simple"><thead><tr><th>項次</th><th>部位</th><th>說明</th><th>結果</th></tr></thead><tbody>${e.parts.map((t, r) => {
    const n = rebarCageDef(t.key);
    return `<tr><td>${r + 1}</td><td class="text-left">${escapeHtml(n.part)}</td><td class="text-left">${escapeHtml(n.note || REBAR_CAGE_DEFAULT_NOTE)}</td><td>${escapeHtml(t.result)}</td></tr>`;
  }).join("")}</tbody></table>`;
}
function rebarCageCardsHtml(e, s) {
  const a = e.mode === "detailed";
  return e.parts.map((t, r) => {
    const n = rebarCageDef(t.key), l = rebarCageMirrored(t, e.parts), c = a ? rebarCageSummary(t, e.parts) : [n.note || REBAR_CAGE_DEFAULT_NOTE], p = a && !n.mirrorOf ? `<label class="rebar-symmetric"><input type="checkbox" data-part-symmetric="${r}" ${t.symmetric ? "checked" : ""} /><span>對稱</span></label>` : "", i = a && !l ? `<button type="button" class="kit-button kit-button--secondary" data-edit-part="${r}">填寫</button>` : "";
    return `
    <article class="kit-card check-card rebar-part-card"${t.result === "不符合" ? ' data-status="danger"' : ""}>
      <div class="check-card-head rebar-part-head"><span>${String(r + 1).padStart(2, "0")}</span><strong>${escapeHtml(n.part)}</strong>${p}${i}</div>
      <p class="rebar-part-summary ${l ? "is-mirrored" : ""}">${c.map((d) => `<span>${escapeHtml(d)}</span>`).join("")}</p>
      <div class="check-card-fields rebar-part-fields">
        <div class="result-field">${s(`rebar-part-${r}-result`, t.result, `data-part-result="${r}"`)}</div>
      </div>
    </article>`;
  }).join("");
}
function syncRebarCageModeTabs(e) {
  document.querySelectorAll("#rebar-cage-mode-tabs [data-cage-mode]").forEach((a) => {
    a.setAttribute("aria-selected", String(a.dataset.cageMode === e));
  });
}
const rebarCageDialog = { index: null, draft: null };
function openRebarCageDialog(e, s) {
  rebarCageDialog.index = s, rebarCageDialog.draft = JSON.parse(JSON.stringify(e.parts[s])), document.querySelector("#rebar-dialog-title").textContent = `第 ${s + 1} 項　${rebarCageDef(e.parts[s].key).part}`, renderRebarCageDialogFields(), document.querySelector("#rebar-dialog").showModal();
}
const rebarCageNumberInput = (e, s, a, n) => `<input id="rebar-${n}-${e}" type="text" inputmode="decimal" pattern="${REBAR_CAGE_MEASURED_PATTERN}" data-interval-field="${e}" value="${escapeHtml(s)}" placeholder="${a}" autocomplete="off" />`;
function renderRebarCageDialogFields() {
  const e = rebarCageDialog.draft, s = rebarCageDef(e.key), a = document.querySelector("#rebar-part-fields");
  if (s.template === "single") {
    a.innerHTML = `<div class="dialog-fields three-fields">
      <div class="kit-field"><label for="rebar-count">支數</label><input id="rebar-count" type="number" min="0" step="1" inputmode="numeric" data-part-field="count" value="${escapeHtml(e.count)}" placeholder="例如：3" autocomplete="off" /></div>
      <div class="kit-field"><label for="rebar-size">鋼筋號數</label><select id="rebar-size" data-part-field="size">${barSizeOptions(e.size)}</select></div>
      <div class="kit-field"><label for="rebar-spacing">間距</label><div class="kit-affix"><input id="rebar-spacing" type="text" inputmode="decimal" pattern="${REBAR_CAGE_MEASURED_PATTERN}" data-part-field="spacing" value="${escapeHtml(e.spacing)}" placeholder="例如：30" autocomplete="off" /><span class="kit-affix-unit">cm</span></div></div>
    </div>`, syncMeasuredErrors(a);
    return;
  }
  const t = rebarCageIntervalIssues(e.intervals);
  a.innerHTML = `${e.intervals.map((r, n) => `
    <fieldset class="rebar-interval" data-interval="${n}">
      <legend><span>深度區間 ${n + 1}</span>${e.intervals.length > 1 ? `<button type="button" class="kit-button kit-button--link" data-remove-interval="${n}">移除</button>` : ""}</legend>
      <div class="dialog-fields two-fields">
        <div class="kit-field gl-field ${t[n].has("top") ? "is-invalid" : ""}"><label for="rebar-${n}-top">頂部（GL 以下）</label><div class="kit-affix"><span class="kit-affix-unit">GL −</span>${rebarCageNumberInput("top", r.top, "例如：10", n)}<span class="kit-affix-unit">m</span></div></div>
        <div class="kit-field gl-field ${t[n].has("bottom") ? "is-invalid" : ""}"><label for="rebar-${n}-bottom">底部（GL 以下）</label><div class="kit-affix"><span class="kit-affix-unit">GL −</span>${rebarCageNumberInput("bottom", r.bottom, "例如：20", n)}<span class="kit-affix-unit">m</span></div></div>
        <div class="kit-field"><label for="rebar-${n}-size">鋼筋號數</label><select id="rebar-${n}-size" data-interval-field="size">${barSizeOptions(r.size)}</select></div>
        <div class="kit-field"><label for="rebar-${n}-spacing">間距</label><div class="kit-affix">${rebarCageNumberInput("spacing", r.spacing, "例如：60", n)}<span class="kit-affix-unit">cm</span></div></div>
        <label class="span-two rebar-extra-toggle"><input type="checkbox" data-interval-field="extraEnabled" ${r.extra.enabled ? "checked" : ""} /><span>補強插筋</span></label>
        ${r.extra.enabled ? `
        <div class="kit-field"><label for="rebar-${n}-extraSize">補強 鋼筋號數</label><select id="rebar-${n}-extraSize" data-interval-field="extraSize">${barSizeOptions(r.extra.size)}</select></div>
        <div class="kit-field"><label for="rebar-${n}-extraSpacing">補強 間距</label><div class="kit-affix">${rebarCageNumberInput("extraSpacing", r.extra.spacing, "例如：15", n)}<span class="kit-affix-unit">cm</span></div></div>` : ""}
      </div>
    </fieldset>`).join("")}
    <button type="button" class="kit-button kit-button--secondary" data-add-interval>＋ 加一個深度區間</button>`, syncMeasuredErrors(a);
}
function applyRebarCageIntervalIssues() {
  const e = rebarCageIntervalIssues(rebarCageDialog.draft.intervals);
  document.querySelectorAll("#rebar-part-fields .rebar-interval").forEach((s, a) => {
    s.querySelectorAll(".gl-field").forEach((t) => {
      const r = t.querySelector("[data-interval-field]").dataset.intervalField;
      t.classList.toggle("is-invalid", e[a]?.has(r) ?? false);
    });
  });
}
function updateRebarCageDraft(e) {
  const s = rebarCageDialog.draft;
  if (e.dataset.partField) return s[e.dataset.partField] = e.value.trim(), false;
  const a = e.dataset.intervalField;
  if (!a) return false;
  const t = s.intervals[Number(e.closest("[data-interval]").dataset.interval)];
  return a === "extraEnabled" ? (t.extra.enabled = e.checked, true) : a === "extraSize" || a === "extraSpacing" ? (t.extra[a === "extraSize" ? "size" : "spacing"] = e.value.trim(), false) : ((a === "top" || a === "bottom") && e.value.trim().startsWith("-") && (e.value = e.value.trim().slice(1)), t[a] = e.value.trim(), (a === "top" || a === "bottom") && applyRebarCageIntervalIssues(), false);
}
function bindRebarCageUi({ getCage: e, onChange: s }) {
  const a = document.querySelector("#rebar-dialog");
  a.addEventListener("input", (r) => {
    updateRebarCageDraft(r.target);
  }), a.addEventListener("change", (r) => {
    updateRebarCageDraft(r.target) && renderRebarCageDialogFields();
  }), a.addEventListener("click", (r) => {
    const n = r.target.closest("[data-add-interval]"), l = r.target.closest("[data-remove-interval]");
    if (n) rebarCageDialog.draft.intervals.push(createRebarCageInterval());
    else if (l) rebarCageDialog.draft.intervals.splice(Number(l.dataset.removeInterval), 1);
    else return;
    renderRebarCageDialogFields();
  }), document.querySelector("#rebar-form").addEventListener("submit", (r) => {
    r.preventDefault(), e().parts[rebarCageDialog.index] = rebarCageDialog.draft, a.close(), s();
  }), document.addEventListener("click", (r) => {
    const n = r.target.closest("[data-edit-part]"), l = r.target.closest("[data-cage-mode]");
    n ? openRebarCageDialog(e(), Number(n.dataset.editPart)) : l && e().mode !== l.dataset.cageMode && (e().mode = l.dataset.cageMode, s());
  }), document.addEventListener("change", (r) => {
    const n = r.target.closest("[data-part-symmetric]"), l = r.target.closest("[data-part-result]");
    n ? (e().parts[Number(n.dataset.partSymmetric)].symmetric = n.checked, s()) : l && (e().parts[Number(l.dataset.partResult)].result = l.value, s());
  });
}
