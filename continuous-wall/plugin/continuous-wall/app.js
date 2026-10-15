const APP_VERSION = "2.0.4", TAB_LABELS = { wall: "壁體資訊", quality: "品質自檢", excavation: "開挖紀錄", prework: "前置紀錄", pouring: "澆置紀錄" }, TOOL_LABELS = { diaphragmWall: "連續壁施工紀錄", guideWall: "導溝施工複核", rebarCage: "鋼筋籠吊放前複核" }, PRINT_TAB_GROUPS = { wall: "quality", quality: "quality", excavation: "excavation-prework", prework: "excavation-prework", pouring: "pouring", guideWall: "guideWall", rebarCage: "rebarCage" }, GUIDE_WALL_CHECKS = [["放樣", "點位、單元順序與核定圖說相符"], ["地下管線", "未與既有管線衝突"], ["位置與淨寬", "導溝內面淨寬在設計值 ±5 cm 以內"], ["深度", `・深度依結構設計圖且至少 1.8 m，實測不小於設計深度
・回填土層以下至少 30 cm（現場確認）
・溝底高程符合核定施工圖`], ["牆厚", "導溝牆厚不小於設計值；斷面及結構尺寸符合核定圖說"], ["鋼筋", "號數與設計相同、間距不大於設計間距；支數與核定配筋圖一致"], ["回撐木", "間距 @200 cm 或依核定支撐計畫（拆模後未達指定強度時嚴禁重車行駛）"], ["混凝土強度", "實測強度不小於設計強度"], ["頂部基準高程", "符合設計圖說"], ["壁面順直度", "導溝兩側壁面垂直度 1/300，並保持順直，無明顯扭曲或局部變形"], ["壁面與底部完整性", "無鬆動、剝落、裂縫；底部無堆積物"]], createGuideWallCheck = ([t, e]) => ({ item: t, standard: e, design: "", actual: "", designBarNo: "", designBarSpacing: "", barNo: "", barSpacing: "", result: "待確認", auto: "" }), REBAR_CAGE_CHECKS = [["籠號與單元對應", "籠號、單元號與核定配筋圖一致"], ["籠體幾何尺寸", "長度、寬度、厚度與圖說相符"], ["接頭、搭接與焊接", "位置、長度與施工規範相符"], ["保護層墊塊與固定", "位置、數量及固定方式可確保保護層"], ["吊點、吊具及臨時補強", "吊點、吊筋、桁架及補強可安全吊放"], ["接頭構件／預埋件", "止水、接頭鋼板及預埋件位置依圖說"], ["外觀與吊放前狀態", "無顯著變形、鬆脫、污染或妨礙吊放之雜物"]], STRENGTH_UNITS = ["kgf/cm²", "psi"], STRENGTH_PLACEHOLDER = { "kgf/cm²": "例如：350", psi: "例如：5000" }, createQualityCheck = ([t, e, a]) => ({ item: t, standard: e, placeholder: a, actual: "", result: "待確認" }), QUALITY_CHECKS = [["連續壁單元位置、刀法順序確認", "單元位置、順序與核定圖說相符", "例如：位置及順序符合"], ["底部沉渣及泥屑清除確認", "依檢查標準值（預設 15 cm 以內）", "例如：12"], ["端板接頭清洗（公及公母單元時）", "以大小鋼刷確實清洗", "填寫清洗狀況"], ["穩定液新鮮液之貯存量是否充裕", "依照施工計畫", "填寫液量或確認說明"], ["槽溝穩定液面高度控制", "液面在導溝頂下 80 cm 以內；高於地下水位 1.0 m 以上（現場確認）", "例如：60"], ["廢土清運是否正常", "不致影響挖掘進度", "填寫異常說明"], ["施工動線及運土車輛之安排", "不致延遲澆置時間", "填寫異常說明"], ["壁體坍塌處是否需作補強", "若需補強，說明方式", "填寫補強方式或無需補強"], ["帆布是否破損（母單元時）", "單元起吊前及下放時檢查", "填寫檢查狀況"], ["開挖深度與特密管長度之配合", "初灌管底離槽溝底 30～50 cm", "例如：40"], ["特密管之檢查（變形、破裂、堵塞、水密性）", "下放前及過程中目視檢查", "填寫檢查狀況"], ["特密管插入位置、深度、組合記錄", "位置符合圖面；長度配合挖掘深度", "填寫左／中／右位置與管長"], ["放置橡皮碗", "澆置前放置於漏斗內", "填寫是／否"], ["穩定液回收池容積是否足夠", "同時間無挖掘，容積大於回收量", "填寫是／否或容積"], ["混凝土坍度之確認", "依檢查標準值確認坍度及允許誤差", "例如：19"], ["混凝土是否合乎設計強度", "實測強度不小於設計強度（設計值取壁體資訊）", "例如：280"], ["特密管埋入混凝土內之確認", "依單元類型套用檢查標準值", "例如：2.0"], ["超音波記錄結果說明", "垂直精度依檢查標準值（填斜率分母 n，可寫 1/420）", "例如：420"]], QUALITY_STANDARD_CONFIG = INSPECTION_STANDARDS["diaphragm-wall"].config, QUALITY_STANDARD_DEFAULTS = Object.fromEntries(QUALITY_STANDARD_CONFIG.map((t) => [t.key, t.default]));
function verticalPrecisionFromDepth(t) {
  const e = measuredNumber(t);
  if (!Number.isFinite(e) || e === 0) return null;
  const a = Math.abs(e) * 100;
  return { depthCm: a, ratio: 10 / a, denominator: a / 10 };
}
function verticalPrecision() {
  return verticalPrecisionFromDepth(state.wall.designDepth);
}
function selectedVerticalPrecision() {
  return state.quality.standards.verticalDenominator === "10/D" ? verticalPrecision() : null;
}
function qualityStandardValue(t) {
  if (t === "verticalDenominator") {
    const e = state.quality.standards.verticalDenominator || "", a = selectedVerticalPrecision();
    return a ? a.denominator.toFixed(1) : e;
  }
  return state.quality.standards[t] ?? "";
}
function qualityStandardOptions(t, e) {
  return e.map((a) => `<option value="${esc(a)}" ${a === t ? "selected" : ""}>${esc(a)}</option>`).join("");
}
function qualityStandardText(t) {
  if (t === "verticalDenominator") {
    const n = state.quality.standards.verticalDenominator || "—";
    if (n !== "10/D") return `垂直壁體偏差 ≤ 1/${n}`;
    const s = selectedVerticalPrecision();
    return s ? `垂直精度 ≤ 10 / ${s.depthCm.toFixed(0)} = ${s.ratio.toFixed(5)}（約 1/${s.denominator.toFixed(1)}）` : "垂直精度 ≤ 10 / D（D 為連續壁深度，單位 cm）";
  }
  const e = state.quality.standards[t] || "—";
  return { slump: `坍度 ${e} cm`, slumpTolerance: `允許誤差 ${e} cm`, sediment: `沉泥厚度 ≤ ${e} cm`, sandContent: `含砂量 ≤ ${e}%`, settlingTime: `靜置時間 ≥ ${e} hr`, verticalDenominator: `垂直壁體偏差 ≤ 1/${e}`, tremieClearance: `特密管端距 ≤ ${e} cm`, pourInterruption: `澆置中斷 ≤ ${e} min`, pourCompletion: `澆置完成 ≤ ${e} min`, chloride: `氯離子含量 ≤ ${e} kg/m³`, centerlineTolerance: `中心線偏差 ≤ ${e} cm`, wallThicknessTolerance: `壁厚偏差 ≤ ${e} cm`, cageLongitudinalTolerance: `雙向（縱、橫向）偏差 ${e} cm`, cageTopTolerance: `頂高程偏差 ${e} cm`, cover: `保護層厚度 ≥ ${e} cm`, embedmentMale: `埋入深度 ≥ ${e} m`, embedmentFemale: `埋入深度 ≥ ${e} m`, embedmentBoth: `埋入深度 ≥ ${e} m`, volumeDifference: `混凝土實際與設計數量差異 ≤ ${e}%` }[t] || `${e}`;
}
function qualityCheckStandard(t, e) {
  return { 0: qualityStandardText("centerlineTolerance"), 1: qualityStandardText("sediment"), 9: `初灌管底離槽溝底 ${TREMIE_CLEARANCE_MIN}～${state.quality.standards.tremieClearance || "—"} cm`, 14: `${qualityStandardText("slump")}；${qualityStandardText("slumpTolerance")}`, 15: parseMeasure(state.wall.strength).value !== null ? `實測強度 ≥ 設計強度 ${String(state.wall.strength).trim()} ${strengthUnit()}` : "實測強度不小於設計強度（請先在「壁體資訊」填混凝土強度）", 16: state.wall.unitType ? `${state.wall.unitType}：${qualityStandardText(embedmentKeyFor(state.wall.unitType))}` : `依壁體資訊的單元類型套用：公單元 ≥ ${state.quality.standards.embedmentMale} m／母單元 ≥ ${state.quality.standards.embedmentFemale} m／公母單元 ≥ ${state.quality.standards.embedmentBoth} m`, 17: `${qualityStandardText("verticalDenominator")}（填斜率分母 n，可寫 1/420）` }[t] || e;
}
const embedmentKeyFor = (t) => ({ 公單元: "embedmentMale", 母單元: "embedmentFemale", 公母單元: "embedmentBoth" })[t] || null, strengthUnit = () => STRENGTH_UNITS.includes(state.wall.strengthUnit) ? state.wall.strengthUnit : STRENGTH_UNITS[0];
function qualityCheckPlaceholder(t, e) {
  return e;
}
const TREMIE_CLEARANCE_MIN = 30, LIQUID_LEVEL_MAX_BELOW_TOP = 80;
function qualityVerticalDenominator() {
  const t = selectedVerticalPrecision();
  return t ? t.denominator : state.quality.standards.verticalDenominator === "10/D" ? null : number(state.quality.standards.verticalDenominator);
}
const QUALITY_MEASURES = { 底部沉渣及泥屑清除確認: { unit: () => "cm", evaluate: (t) => {
  const e = number(state.quality.standards.sediment);
  return e !== null && t > e ? `沉泥 ${t} cm，超過 ${e} cm` : null;
} }, 槽溝穩定液面高度控制: { unit: () => "cm", prefix: "導溝頂下", evaluate: (t) => t > LIQUID_LEVEL_MAX_BELOW_TOP ? `液面在導溝頂下 ${t} cm，超過 ${LIQUID_LEVEL_MAX_BELOW_TOP} cm` : null }, 開挖深度與特密管長度之配合: { unit: () => "cm", evaluate: (t) => {
  const e = number(state.quality.standards.tremieClearance);
  return t < TREMIE_CLEARANCE_MIN ? `初灌管底離槽底 ${t} cm，小於 ${TREMIE_CLEARANCE_MIN} cm` : e !== null && t > e ? `初灌管底離槽底 ${t} cm，超過 ${e} cm` : null;
} }, 混凝土坍度之確認: { unit: () => "cm", evaluate: (t) => {
  const e = number(state.quality.standards.slump), a = number(state.quality.standards.slumpTolerance);
  return e === null || a === null ? null : Math.abs(t - e) > a ? `坍度 ${t} cm，超出 ${e} ± ${a} cm` : null;
} }, 混凝土是否合乎設計強度: { unit: () => strengthUnit(), evaluate: (t) => {
  const e = parseMeasure(state.wall.strength).value;
  return e !== null && t < e ? `實測強度 ${t} ${strengthUnit()}，小於設計強度 ${e} ${strengthUnit()}` : null;
} }, 特密管埋入混凝土內之確認: { unit: () => "m", evaluate: (t) => {
  const e = embedmentKeyFor(state.wall.unitType), a = e ? number(state.quality.standards[e]) : null;
  return a !== null && t < a ? `埋入深度 ${t} m，小於${state.wall.unitType}下限 ${a} m` : null;
} }, 超音波記錄結果說明: { unit: () => "1/n", ratio: true, evaluate: (t) => {
  const e = qualityVerticalDenominator();
  return e !== null && t < e ? `垂直精度 1/${t} 劣於標準約 1/${Number(e.toFixed(1))}` : null;
} } }, qualityMeasure = (t) => QUALITY_MEASURES[t?.item] || null, QUALITY_EXAMPLE_VALUES = { 底部沉渣及泥屑清除確認: "12", 槽溝穩定液面高度控制: "60", 開挖深度與特密管長度之配合: "40", 混凝土坍度之確認: "20", 混凝土是否合乎設計強度: "350", 特密管埋入混凝土內之確認: "2.0", 超音波記錄結果說明: "420" };
function qualityMeasureStatus(t) {
  const e = qualityMeasure(t);
  if (!e) return { status: "empty", message: "" };
  const a = parseMeasure(t.actual, { ratio: e.ratio });
  if (a.invalid) return { status: "invalid", message: INVALID_MEASURE_MESSAGE };
  if (a.value === null) return { status: "empty", message: "" };
  const n = e.evaluate(a.value);
  return { status: n ? "fail" : "pass", message: n || "" };
}
function qualityActualText(t) {
  const e = qualityMeasure(t), a = display(t.actual);
  if (!e || !a) return a;
  const n = parseMeasure(t.actual, { ratio: e.ratio });
  if (n.value === null) return a;
  const s = String(Number(n.value.toFixed(3))), l = e.unit(), i = l === "1/n" ? `1/${s}` : `${s} ${l}`;
  return e.prefix ? `${e.prefix} ${i}` : i;
}
function pouredVolume() {
  const t = state.trucks.reduce((e, a) => e + (measuredNumber(a.volume) ?? 0), 0);
  return t > 0 ? t : measuredNumber(state.wall.actualVolume);
}
function volumeDifferenceRate() {
  const t = number(state.wall.designVolume) ?? calculatedDesignVolume(), e = pouredVolume();
  return t && e !== null ? Math.abs(e - t) / t * 100 : null;
}
const pourLogHasVolume = () => state.trucks.some((t) => (measuredNumber(t.volume) ?? 0) > 0);
function pourLooksComplete() {
  if (!pourLogHasVolume()) return true;
  const t = designHeight(), e = calculatedTrucks().at(-1)?.measured ?? null;
  return t !== null && e !== null && e >= t - 0.3;
}
const volumeDifferenceExceeded = () => {
  const t = volumeDifferenceRate(), e = number(state.quality.standards.volumeDifference);
  if (t === null || e === null || t <= e) return false;
  const a = number(state.wall.designVolume) ?? calculatedDesignVolume();
  return pouredVolume() > a || pourLooksComplete();
};
function volumeDifferenceSummary() {
  const t = volumeDifferenceRate();
  if (t === null) return "";
  const e = number(state.wall.designVolume) ?? calculatedDesignVolume(), a = pourLogHasVolume() ? "澆置紀錄累積" : "壁體資訊實際數量", n = pourLogHasVolume() && pouredVolume() < e && !pourLooksComplete() ? "，澆置中" : "";
  return `目前 ${t.toFixed(2)}%（${a} ${fixed(pouredVolume())} ／ 設計 ${fixed(e)} m³${n}）`;
}
const PHASES = [{ id: "slurry", label: "清沉泥", start: "開始時間", end: "完成時間" }, { id: "lowerCage", label: "下方鋼筋籠吊放", start: "開始時間", end: "完成時間" }, { id: "upperCage", label: "上方鋼筋籠吊放", start: "開始時間" }, { id: "splice", label: "鋼筋籠續接", start: "開始時間", end: "完成時間" }, { id: "cageComplete", label: "鋼筋籠吊放完成", end: "完成時間" }, { id: "tremie", label: "特密管施工", start: "開始時間", end: "完成時間" }], localDate = /* @__PURE__ */ new Date(), today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`, state = { overview: { project: "", contractor: "", reviewer: "" }, dates: { excavationStart: today, excavationEnd: "", pouring: today }, wall: { unitType: "", unitNo: "", sequenceNo: "", designDepth: "", strength: "", strengthUnit: "kgf/cm²", thickness: "", length: "", topElevation: "", designVolume: "", actualVolume: "" }, soil: [], depth: [], prework: Object.fromEntries(PHASES.map((t) => [t.id, { date: today, start: "", end: "" }])), trucks: [], guideWall: { date: today, axisNo: "", reviewer: "", note: "", checks: GUIDE_WALL_CHECKS.map(createGuideWallCheck) }, rebarCage: { date: today, cageNo: "", reviewer: "", note: "", mode: "simple", parts: createRebarCageParts(), checks: REBAR_CAGE_CHECKS.map(([t, e]) => ({ item: t, standard: e, actual: "", result: "待確認" })), photos: [] }, quality: { note: "", standards: { ...QUALITY_STANDARD_DEFAULTS }, checks: QUALITY_CHECKS.map(([t, e, a]) => ({ item: t, standard: e, placeholder: a, actual: "", result: "待確認" })) } }, exampleMode = new URLSearchParams(location.search).get("example") === "1";
function normalizeTruckTrips(trucks) {
  const seen = /* @__PURE__ */ new Set();
  return trucks.map((trip) => {
    let id = typeof trip.tripId === "string" ? trip.tripId : "";
    if (!id || seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    return { arrival: "", dispatch: "", slump: "", ...trip, tripId: id };
  });
}
// Stored records are not checked for the shape of these rows. A non-array (or a non-object row) would make
// loadState throw right after a record is opened, and its lease would be held with no form to edit.
const objectRows = (t) => Array.isArray(t) ? t.filter((e) => e && typeof e == "object") : [];
function normalizeLoadedState(t) {
  // Same reason for these sections: a non-object one is replaced by {} and filled with defaults below.
  ["overview", "wall", "prework", "guideWall", "rebarCage", "quality", "dates"].forEach((e) => {
    state[e] && typeof state[e] == "object" && !Array.isArray(state[e]) || (state[e] = {});
  });
  state.soil = objectRows(state.soil), state.depth = objectRows(state.depth), state.trucks = normalizeTruckTrips(objectRows(state.trucks)), PHASES.forEach((a) => {
    state.prework[a.id] = { date: "", start: "", end: "", ...state.prework[a.id] };
  });
  const e = state.overview.date;
  e && (t.dates || (state.dates = { excavationStart: e, excavationEnd: "", pouring: e }), PHASES.forEach((a) => {
    state.prework[a.id].date ||= e;
  })), delete state.overview.date, state.wall.unitNo ||= state.rebarCage.unitNo || "", delete state.guideWall.unitNo, delete state.rebarCage.unitNo, state.rebarCage.mode = state.rebarCage.mode === "detailed" ? "detailed" : "simple", state.rebarCage.parts = normalizeRebarCageParts(state.rebarCage.parts), delete state.rebarCage.rebars, state.quality.standards = mergeStandardDefaults(state.quality.standards, QUALITY_STANDARD_CONFIG), state.quality.checks = refreshCheckItems(state.quality.checks, QUALITY_CHECKS.map(createQualityCheck)), state.guideWall.checks = refreshCheckItems(state.guideWall.checks, GUIDE_WALL_CHECKS.map(createGuideWallCheck)), state.rebarCage.checks = refreshCheckItems(state.rebarCage.checks, REBAR_CAGE_CHECKS.map(([a, n]) => ({ item: a, standard: n, actual: "", result: "待確認" }))), state.rebarCage.photos = normalizeCagePhotos(state.rebarCage.photos), STRENGTH_UNITS.includes(state.wall.strengthUnit) || (state.wall.strengthUnit = STRENGTH_UNITS[0]);
}
let activeTab = "wall", activeTool = "diaphragmWall";
const editIndex = { soil: null, depth: null, truck: null };
let undoGeneration = 0;
const $ = (t) => document.querySelector(t), $$ = (t, e = document) => [...e.querySelectorAll(t)], number = (t) => {
  const e = Number.parseFloat(t);
  return Number.isFinite(e) ? e : null;
}, fixed = (t) => Number.isFinite(t) ? t.toFixed(2) : "", display = printText, guideCheckActual = (t) => guideMeasure(t) ? guideMeasureText(t) : display(t.actual), esc = (t) => String(t ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"), standardHtml = (t) => String(t ?? "").split(`
`).map((e) => esc(e.trim())).filter(Boolean).join("<br>"), formatDateDisplay = (t) => {
  const [e, a, n] = String(t ?? "").split("-");
  return e && a && n ? `${e}/${a}/${n}` : "";
};
// Each date input gets its ROC hint once when it is created; values set from code only need a refresh.
const addRocDateHints = (t) => $$('input[type="date"]', t).forEach((e) => studio.kit.rocDateInput(e));
function refreshRocDateHints() {
  studio.kit.rocDateInput.refreshAll();
}
function designHeight() {
  const t = measuredNumber(state.wall.designDepth), e = measuredNumber(state.wall.topElevation);
  return t === null || e === null ? null : Math.max(0, t < 0 ? e - t : t + e);
}
function calculatedDesignVolume() {
  const t = designHeight(), e = measuredNumber(state.wall.thickness), a = measuredNumber(state.wall.length);
  return t === null || e === null || a === null ? null : t * e * a;
}
function timeToMinutes(t) {
  const [e, a] = String(t ?? "").split(":").map(Number);
  return Number.isFinite(e) && Number.isFinite(a) ? e * 60 + a : null;
}
const clock30 = (t) => t === null ? "" : `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
function minutesAfter(t, e) {
  const a = timeToMinutes(t);
  if (a === null) return null;
  if (e == null) return a;
  let n = a + Math.floor(e / 1440) * 1440;
  for (; n < e; ) n += 1440;
  return n;
}
function sequence30(t) {
  let e = null;
  return t.map((a) => {
    const n = minutesAfter(a, e);
    return n !== null && (e = n), clock30(n);
  });
}
function calculatedExcavation() {
  const t = measuredNumber(state.wall.designDepth), e = sequence30(state.soil.map((n) => n.time)), a = sequence30(state.depth.map((n) => n.time));
  return { soil: state.soil.map((n, s) => ({ ...n, index: s, time30: e[s] })), depth: state.depth.map((n, s) => {
    const l = measuredNumber(n.value);
    return { ...n, index: s, time30: a[s], value: l, difference: l !== null && t !== null ? l - t : null };
  }) };
}
const TRUCK_LIMITS = { dispatchGapMinutes: 12 * 60, unloadAfterDispatchMinutes: 4 * 60, finishAfterUnloadMinutes: 3 * 60, clock30Minutes: 30 * 60, maxVolume: 15 }, hoursText = (t) => `${(t / 60).toFixed(1)} 小時`;
function truckFlags({ truck: t, volume: e, dispatchAt: a, unloadAt: n, finishAt: s, previousDispatch: l }) {
  const i = [];
  return l !== null && a !== null && a - l > TRUCK_LIMITS.dispatchGapMinutes && i.push(`出廠時間比前一車晚 ${hoursText(a - l)}，請確認車次順序或是否打錯`), a !== null && n !== null && n - a > TRUCK_LIMITS.unloadAfterDispatchMinutes && i.push(`出廠到卸料相差 ${hoursText(n - a)}，請確認時間是否打錯`), n !== null && s !== null && s - n > TRUCK_LIMITS.finishAfterUnloadMinutes && i.push(`卸料到結束相差 ${hoursText(s - n)}，請確認時間是否打錯`), String(t.volume).trim() && e <= 0 && i.push("方量為 0 或負值，請確認"), e > TRUCK_LIMITS.maxVolume && i.push(`單車方量 ${fixed(e)} m³ 超過一般拌合車容量，請確認`), i;
}
function calculatedTrucks() {
  const t = number(state.wall.designVolume), e = designHeight(), p = sequence30(state.trucks.map((c) => c.arrival));
  let a = 0, n = 0, s = null, l = null, i = false;
  return state.trucks.map((c, g) => {
    const f = measuredNumber(c.volume) ?? 0, r = measuredNumber(c.measured);
    a += f;
    const m = t && e !== null ? e * a / t : null, v = r !== null && m !== null ? r - m : null, _ = String(c.slump ?? "").trim() ? ++n : null, b = _ === null ? "" : `（試${_}）${c.slump}`, u = minutesAfter(c.dispatch, s), d = minutesAfter(c.unload, u ?? l), y = minutesAfter(c.finish, d), o = truckFlags({ truck: c, volume: f, dispatchAt: u, unloadAt: d, finishAt: y, previousDispatch: s });
    !i && [u, d, y].some((w) => w !== null && w >= TRUCK_LIMITS.clock30Minutes) && (i = true, o.push("時間已推算到 30:00 以後（翌日 06:00 後），如非通宵澆置請檢查前面車次的時間")), u !== null && (s = u), d !== null && (l = d);
    const h = u !== null && y !== null ? y - u : null;
    return { ...c, index: g, arrival30: p[g], volume: f, cumulative: a, measured: r, expected: m, difference: v, minutes: h, slumpNo: _, slumpLabel: b, flags: o, dispatch30: clock30(u), unload30: clock30(d), finish30: clock30(y) };
  });
}
function setInitialInputs() {
  $$("[data-bind]").forEach((t) => {
    const [e, a] = t.dataset.bind.split(".");
    t.type === "radio" ? t.checked = state[e][a] === t.value : t.value = state[e][a] ?? "";
  }), syncMeasuredErrors(document);
}
const wallUnitLabel = () => [state.wall.unitType, state.wall.unitNo].filter(Boolean).join("｜");
function syncUnitInputs(t = null) {
  $$('[data-bind="wall.unitNo"], [data-bind="wall.sequenceNo"]').forEach((e) => {
    if (e === t) return;
    const a = e.dataset.bind.split(".")[1];
    e.value = state.wall[a] ?? "";
  });
}
function updateWallCalculation() {
  const t = designHeight(), e = calculatedDesignVolume();
  state.wall.designVolume = e === null ? "" : e.toFixed(2);
  const a = $('[data-bind="wall.designVolume"]');
  a && (a.value = state.wall.designVolume);
  const n = $("#design-height-value");
  n && (n.value = t === null ? "" : t.toFixed(2)), syncActualVolume(), syncStrengthUnit(), renderQuality(), renderExcavation(), renderPouring();
}
function syncActualVolume() {
  const t = state.trucks.reduce((s, l) => s + (measuredNumber(l.volume) ?? 0), 0);
  t > 0 && (state.wall.actualVolume = t.toFixed(2));
  const a = $('[data-bind="wall.actualVolume"]');
  a && (a.value = state.wall.actualVolume ?? "");
}
function syncStrengthUnit() {
  const t = $('[data-bind="wall.strength"]');
  t && (t.placeholder = STRENGTH_PLACEHOLDER[strengthUnit()]);
}
function currentExportLabel(t = activeTool, e = activeTab) {
  return t === "diaphragmWall" ? PRINT_TAB_GROUPS[e] === "quality" ? e === "wall" ? "品質自檢（含壁體資訊）" : "品質自檢" : PRINT_TAB_GROUPS[e] === "excavation-prework" ? "開挖紀錄＋前置紀錄" : TAB_LABELS[e] : TOOL_LABELS[t];
}
function showTab(t, e = false) {
  const a = $(`[role="tab"][data-tab="${t}"]`)?.closest("[data-tool-view]");
  a && ($$(".tab-panel", a).forEach((n) => {
    n.hidden = n.id !== `panel-${t}`;
  }), $$('[role="tab"][data-tab]', a).forEach((n) => {
    const s = n.dataset.tab === t;
    n.setAttribute("aria-selected", String(s)), n.tabIndex = s ? 0 : -1;
  }), a.dataset.toolView === "diaphragmWall" && (activeTab = t), e && $(`#panel-${t}`).focus({ preventScroll: true }));
}
function showTool(t) {
  TOOL_LABELS[t] && (activeTool = t, $$("[data-tool-view]").forEach((e) => {
    e.hidden = e.dataset.toolView !== t;
  }), $$("[data-select-tool]").forEach((e) => {
    e.dataset.selectTool === t ? e.setAttribute("aria-current", "page") : e.removeAttribute("aria-current");
  }));
}
function emptyState(t) {
  return `<p class="kit-empty">${esc(t)}</p>`;
}
const markWarning = (t, e) => e ? $(t).dataset.status = "warning" : $(t).removeAttribute("data-status");
function renderExcavation() {
  const t = state.depth.at(-1), e = t ? measuredNumber(t.value) : null, a = measuredNumber(state.wall.designDepth), n = e !== null && a !== null ? e - a : null;
  $("#soil-count").innerHTML = `${state.soil.length}<span class="kit-stat-unit">次</span>`, $("#depth-count").innerHTML = `${state.depth.length}<span class="kit-stat-unit">次</span>`, $("#latest-depth").innerHTML = `${fixed(e)}<span class="kit-stat-unit">m</span>`, $("#depth-difference").innerHTML = `${fixed(n)}<span class="kit-stat-unit">m</span>`, markWarning("#depth-difference-cell", n !== null && n < 0);
  const s = calculatedExcavation();
  $("#soil-list").innerHTML = s.soil.length ? `<ul class="kit-list">${s.soil.map((l, i) => `
    <li class="kit-list-item record-item">
      <div class="record-item-main">
        <div class="record-item-title"><strong>第 ${i + 1} 次出土</strong><span>${esc(l.time30)}</span></div>
      </div>
      <div class="record-item-actions">
        <button type="button" class="kit-button kit-button--link" data-edit-soil="${i}">修改</button>
        <button type="button" class="kit-button kit-button--link" data-delete-soil="${i}">刪除</button>
      </div>
    </li>`).join("")}</ul>` : emptyState("尚無出土紀錄，請按＋新增。"), $("#depth-list").innerHTML = s.depth.length ? `<ul class="kit-list">${s.depth.map((l, i) => {
    const { value: c, difference: g } = l;
    return `
      <li class="kit-list-item record-item">
        <div class="record-item-main">
          <div class="record-item-title"><strong>深度 ${fixed(c)} m</strong><span>${esc(l.time30)}</span></div>
          <div class="record-item-meta"><span>第 ${i + 1} 次確認</span><span class="${g !== null && g < 0 ? "warning-text" : ""}">與設計差異 ${fixed(g)} m</span></div>
        </div>
        <div class="record-item-actions">
          <button type="button" class="kit-button kit-button--link" data-edit-depth="${i}">修改</button>
          <button type="button" class="kit-button kit-button--link" data-delete-depth="${i}">刪除</button>
        </div>
      </li>`;
  }).join("")}</ul>` : emptyState("尚無深度確認，請按＋新增。");
}
function phaseTimes(t) {
  const e = state.prework[t.id], a = t.start ? timeToMinutes(e.start) : null, n = t.end ? minutesAfter(e.end, a) : null;
  return { start: clock30(a), end: clock30(n) };
}
function phaseTimeText(t) {
  const e = state.prework[t.id], a = phaseTimes(t), n = [];
  return t.start && n.push(`開始 ${a.start || "—"}`), t.end && n.push(`完成 ${a.end || "—"}`), `${e.date ? `${formatDateDisplay(e.date).slice(5)}　` : ""}${n.join(" ／ ")}`;
}
function renderPhaseEditor() {
  const t = PHASES.find((n) => n.id === $("#phase-select").value) || PHASES[0], e = state.prework[t.id], a = [`<div class="kit-field"><label for="phase-date">作業日期</label><input id="phase-date" type="date" data-phase-input="date" value="${esc(e.date)}" /></div>`];
  t.start && a.push(`<div class="kit-field"><label for="phase-start">${esc(t.start)}</label><input id="phase-start" type="time" data-phase-input="start" value="${esc(e.start)}" /></div>`), t.end && a.push(`<div class="kit-field"><label for="phase-end">${esc(t.end)}</label><input id="phase-end" type="time" data-phase-input="end" value="${esc(e.end)}" /></div>`), $("#phase-time-fields").innerHTML = a.join(""), addRocDateHints($("#phase-time-fields"));
}
function renderPrework() {
  $("#phase-summary").innerHTML = `<ul class="kit-list">${PHASES.map((t) => {
    const e = state.prework[t.id], a = e.date && (!t.start || e.start) && (!t.end || e.end);
    return `<li class="kit-list-item phase-row"><strong>${esc(t.label)}</strong><span class="${a ? "" : "pending"}">${esc(phaseTimeText(t))}</span></li>`;
  }).join("")}</ul>`;
}
function renderPouring() {
  syncActualVolume(), renderQualityStandards();
  const t = calculatedTrucks(), e = t.at(-1);
  $("#truck-count").innerHTML = `${t.length}<span class="kit-stat-unit">車</span>`, $("#pour-volume").innerHTML = `${fixed(e?.cumulative ?? 0)}<span class="kit-stat-unit">m³</span>`, $("#pour-expected").innerHTML = `${fixed(e?.expected ?? null)}<span class="kit-stat-unit">m</span>`, $("#pour-measured").innerHTML = `${fixed(e?.measured ?? null)}<span class="kit-stat-unit">m</span>`, $("#pour-difference").innerHTML = `${fixed(e?.difference ?? null)}<span class="kit-stat-unit">m</span>`, markWarning("#pour-difference-cell", !!(e && e.difference !== null && e.difference < -0.3));
  const a = volumeDifferenceRate();
  $("#pour-volume-difference").innerHTML = `${a === null ? "—" : a.toFixed(2)}<span class="kit-stat-unit">%</span>`, markWarning("#pour-volume-difference-cell", volumeDifferenceExceeded()), $("#truck-list").innerHTML = t.length ? `<ul class="kit-list">${t.map((l) => `
    <li class="kit-list-item record-item">
      <div class="record-item-main">
        <div class="record-item-title"><strong>第 ${l.index + 1} 車｜${esc(l.truckNo)}</strong><span class="${l.flags.length ? "warning-text" : ""}">${esc(l.arrival30 || "—")} 到場｜${esc(l.dispatch30 || "—")} 出廠｜${esc(l.unload30)}–${esc(l.finish30)}</span></div>
        <div class="record-item-meta">
          <span>本車 ${fixed(l.volume)} m³</span>
          <span>累積 ${fixed(l.cumulative)} m³</span>
          ${l.slumpLabel ? `<span>坍度 ${esc(l.slumpLabel)} cm</span>` : ""}
          <span>澆置 ${l.minutes === null ? "—" : l.minutes} 分</span>
          <span>預估 ${fixed(l.expected)} m</span>
          <span>實測 ${fixed(l.measured)} m</span>
          <span class="${l.difference !== null && l.difference < -0.3 ? "warning-text" : ""}">差異 ${fixed(l.difference)} m</span>
        </div>
      </div>
      <div class="record-item-actions">
        <button type="button" class="kit-button kit-button--link" data-edit-truck="${l.index}">修改</button>
        <button type="button" class="kit-button kit-button--link" data-delete-truck="${l.index}">刪除</button>
      </div>
    </li>`).join("")}</ul>` : emptyState("尚無澆置車次，請按＋新增車次。");
  const s = (volumeDifferenceExceeded() ? [`<li><strong>數量差異 ${volumeDifferenceRate().toFixed(2)}%：</strong>累積方量 ${fixed(pouredVolume())} m³ 與設計數量 ${fixed(number(state.wall.designVolume) ?? calculatedDesignVolume())} m³ 的差異超過檢查標準值 ${esc(state.quality.standards.volumeDifference)}%，請確認方量或超挖、坍孔可能性。</li>`] : []).concat(t.flatMap((l) => [...l.difference !== null && l.difference < -0.3 ? [`<li><strong>第 ${l.index + 1} 車差異 ${fixed(l.difference)} m：</strong>請確認量測基準、實際方量、超挖或坍孔可能性。</li>`] : [], ...l.flags.map((i) => `<li><strong>第 ${l.index + 1} 車：</strong>${esc(i)}</li>`)]));
  $("#pour-warnings").innerHTML = s.length ? `<div class="kit-callout" data-status="warning"><ul>${s.join("")}</ul></div>` : "";
}
const SEGMENT_ICONS = { 符合: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>', 不符合: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>', 不適用: "N/A" };
const SEGMENT_STATUS = { 符合: "success", 不符合: "danger", 不適用: "neutral" };
function resultSegmented(t, e, a, n = [], c = "複核結果") {
  return `<fieldset class="kit-segmented"><legend class="kit-sr-only">${c}</legend>${["符合", "不符合", "不適用"].map((s) => `<label data-status="${SEGMENT_STATUS[s]}"><input type="radio" name="${t}" value="${s}" aria-label="${s}" ${s === e ? "checked" : ""} ${n.includes(s) ? "disabled" : ""} ${a} />${SEGMENT_ICONS[s]}</label>`).join("")}</fieldset>`;
}
function renderCheckCards(t) {
  const e = { quality: "quality", guideWall: "guide-wall", rebarCage: "rebar-cage" }[t] || t, a = $(`#${e}-check-list`);
  a.innerHTML = state[t].checks.map((n, s) => {
    const l = (g) => `data-check-item="${t}" data-check-index="${s}" data-check-field="${g}"`, i = t === "guideWall" && guideMeasure(n), c = i ? guideLockedResults(n) : [];
    return `
    <article class="kit-card check-card"${n.result === "不符合" ? ' data-status="danger"' : ""} data-check-card="${t}-${s}">
      <div class="check-card-head"><span>${String(s + 1).padStart(2, "0")}</span><strong>${esc(n.item)}</strong>${t === "guideWall" && guideAutoJudged(n) ? AUTO_JUDGE_BADGE : ""}</div>
      <p>${t === "quality" ? esc(qualityCheckStandard(s, n.standard)) : standardHtml(n.standard)}</p>
      <div class="check-card-fields">
        ${i ? guideMeasureFieldsHtml(n, l, s) : `<div class="kit-field card-actual-field"><label class="kit-sr-only" for="check-${t}-${s}-actual">現場紀錄／實測</label><input id="check-${t}-${s}-actual" type="text" value="${esc(n.actual)}" ${l("actual")} autocomplete="off" /></div>`}
        <div class="result-field">${resultSegmented(`check-${t}-${s}-result`, n.result, l("result"), c)}</div>
      </div>
    </article>`;
  }).join(""), renderCheckProgress(t);
}
function renderCheckProgress(t) {
  const e = state[t].checks.filter((a) => a.result !== "待確認").length;
  t === "guideWall" ? ($("#guide-wall-progress").textContent = `${e} / ${state.guideWall.checks.length}`, $("#guide-wall-pending").textContent = String(state.guideWall.checks.length - e)) : $("#rebar-cage-check-progress").textContent = `${e} / ${state.rebarCage.checks.length}`;
}
function renderRebars() {
  const t = state.rebarCage;
  $("#rebar-cage-rebar-list").innerHTML = rebarCageCardsHtml(t, resultSegmented), $("#rebar-cage-rebar-progress").textContent = `${t.parts.filter((e) => e.result !== "待確認").length} / ${t.parts.length}`, syncRebarCageModeTabs(t.mode), renderCagePhotos(t.photos || []);
}
function setChecklistInputs() {
  $$("[data-check-bind]").forEach((t) => {
    const [e, a] = t.dataset.checkBind.split(".");
    t.value = state[e][a] ?? "";
  });
}
function setQualityInputs() {
  $$("[data-quality-bind]").forEach((t) => {
    t.value = state.quality[t.dataset.qualityBind] ?? "";
  });
}
function renderQualityStandards() {
  const t = state.wall.unitType, e = t === "公單元" ? "embedmentMale" : t === "母單元" ? "embedmentFemale" : t === "公母單元" ? "embedmentBoth" : null, a = QUALITY_STANDARD_CONFIG.map((n) => {
    const s = n.key.startsWith("embedment") && e && n.key !== e, l = n.key === "volumeDifference" ? volumeDifferenceSummary() : "", i = n.key === "volumeDifference" && volumeDifferenceExceeded();
    return `<div class="kit-field quality-standard-field ${s ? "is-disabled" : ""}">
      <label for="standard-${esc(n.key)}">${esc(n.label)}（${esc(n.unit)}）</label>
      <select id="standard-${esc(n.key)}" data-quality-standard="${esc(n.key)}" ${s ? "disabled" : ""}>${qualityStandardOptions(state.quality.standards[n.key], n.options)}</select>
      ${l ? `<small class="quality-standard-current ${i ? "is-exceeded" : ""}">${esc(l)}${i ? "，超過標準" : ""}</small>` : ""}
    </div>`;
  });
  $("#quality-standard-list").innerHTML = a.join(""), $("#quality-standard-note").textContent = e ? `目前單元類型：${t}；僅輸出此單元類型的特密管埋入深度。` : "請先在「壁體資訊」選擇單元類型；未選擇前三種埋入深度均可調整。";
}
function renderQuality() {
  setQualityInputs(), renderQualityStandards(), $("#quality-check-list").innerHTML = state.quality.checks.map((t, e) => {
    const a = qualityMeasure(t), { status: n, message: s } = qualityMeasureStatus(t);
    a && rejudge(t, n);
    const l = a ? autoLockedResults(t, n) : [], c = `<input id="quality-${e}-actual" type="text"${a ? ` inputmode="decimal"${n === "fail" || n === "invalid" ? ' class="is-invalid"' : ""}` : ""} value="${esc(t.actual)}" placeholder="${esc(qualityCheckPlaceholder(e, t.placeholder))}" data-quality-item="${e}" data-quality-field="actual" autocomplete="off" />`;
    return `
    <article class="kit-card quality-card"${t.result === "不符合" ? ' data-status="danger"' : ""} data-quality-card="${e}">
      <div class="quality-card-head"><span>${String(e + 1).padStart(2, "0")}</span><strong>${esc(t.item)}</strong>${a ? AUTO_JUDGE_BADGE : ""}</div>
      <p>${esc(qualityCheckStandard(e, t.standard))}${s ? `<br /><strong>警示：${esc(s)}</strong>` : ""}</p>
      <div class="quality-card-fields">
        <div class="kit-field card-actual-field"><label class="kit-sr-only" for="quality-${e}-actual">現場紀錄／實測</label>${a ? `<div class="kit-affix">${a.prefix ? `<span class="kit-affix-unit">${esc(a.prefix)}</span>` : ""}${c}<span class="kit-affix-unit">${esc(a.unit())}</span></div>` : c}</div>
        <div class="result-field">${resultSegmented(`quality-${e}-result`, t.result, `data-quality-item="${e}" data-quality-field="result"`, l, "檢查結果")}</div>
      </div>
    </article>`;
  }).join(""), renderQualityProgress();
}
function renderQualityProgress() {
  const t = state.quality.checks.filter((e) => e.result !== "待確認").length;
  $("#quality-progress").textContent = `${t} / ${state.quality.checks.length}`, $("#quality-pending").textContent = String(state.quality.checks.length - t);
}
function renderChecklists() {
  setChecklistInputs(), renderCheckCards("guideWall"), renderCheckCards("rebarCage"), renderRebars(), renderQuality();
}
function renderAll() {
  syncUnitInputs(), updateWallCalculation(), renderPrework(), renderChecklists();
}
function exampleRebarCageParts() {
  const t = createRebarCageParts(), e = (n, s) => Object.assign(t[n], s), a = (n, s, l, i, c = null) => ({ top: n, bottom: s, size: l, spacing: i, extra: c ? { enabled: true, size: c[0], spacing: c[1] } : { enabled: false, size: "", spacing: "" } });
  return e(0, { intervals: [a("0", "20", "D32", "60"), a("20", "35.8", "D32", "60", ["D32", "30"])] }), e(1, { intervals: [a("0", "20", "D32", "60", ["D32", "30"]), a("20", "35.8", "D32", "60", ["D32", "15"])] }), e(2, { symmetric: true, intervals: [a("0", "35.8", "D32", "60")] }), e(4, { intervals: [a("0", "35.8", "D32", "60")] }), e(5, { intervals: [a("0", "35.8", "D32", "60")] }), e(6, { intervals: [a("0", "35.8", "D32", "60")] }), e(7, { symmetric: true, count: "3", size: "D19" }), e(8, { size: "D16", spacing: "30" }), e(9, { size: "D16", spacing: "60" }), e(10, { symmetric: true, count: "2", size: "D32", spacing: "600" }), e(11, { spacing: "200" }), e(12, { spacing: "240" }), t.forEach((n) => {
    n.result = "符合";
  }), t;
}
function loadExample() {
  state.overview = { project: "Example Construction Project — North Lot", contractor: "○○營造股份有限公司", reviewer: "Site Engineer" }, state.dates = { excavationStart: "2026-08-10", excavationEnd: "2026-08-11", pouring: "2026-08-11" }, Object.assign(state.wall, { unitType: "公單元", unitNo: "21", sequenceNo: "03", designDepth: "-35.80", strength: "350", strengthUnit: "kgf/cm²", thickness: "1.00", length: "2.80", topElevation: "-0.50", designVolume: "98.84", actualVolume: "" }), state.soil = ["07:40", "08:20", "09:05"].map((t) => ({ time: t })), state.depth = [{ time: "12:10", value: "-35.80" }, { time: "12:35", value: "-35.82" }], state.prework = Object.fromEntries(PHASES.map((t, e) => [t.id, { date: "2026-08-11", start: `0${8 + e}:00`, end: `0${8 + e}:30` }])), state.trucks = normalizeTruckTrips(Array.from({ length: 8 }, (t, e) => ({ truckNo: `C${String(e + 1).padStart(2, "0")}`, dispatch: `${12 + Math.floor(e / 2)}:${e % 2 ? "50" : "28"}`, unload: `${13 + Math.floor(e / 2)}:${e % 2 ? "42" : "20"}`, finish: `${13 + Math.floor(e / 2)}:${e % 2 ? "55" : "33"}`, volume: e === 7 ? "11.26" : "13", measured: e === 7 ? "36.30" : (4.62 + e * 4.64).toFixed(2), slump: e === 0 ? "18" : "" }))), state.guideWall = { date: "2026-08-10", axisNo: "X3～X7 南側", reviewer: "Site Engineer", note: "中心線偏差 1.6 cm；順序符合；導溝條件完成複核。", checks: GUIDE_WALL_CHECKS.map((t, e) => ({ ...createGuideWallCheck(t), actual: e === 0 ? "中心線偏差 1.6 cm" : "已確認", ...GUIDE_WALL_EXAMPLE_VALUES[t[0]], result: "符合" })) }, state.rebarCage = { date: "2026-08-10", cageNo: "C21-U／C21-L", reviewer: "Site Engineer", note: "配筋圖逐項核對；吊放條件完成。", mode: "detailed", parts: exampleRebarCageParts(), checks: REBAR_CAGE_CHECKS.map(([t, e], a) => ({ item: t, standard: e, actual: a === 7 ? "3 組成對安裝；線路已保護至孔口" : "已確認", result: "符合" })), photos: [] }, state.quality = { note: "各項檢查完成，未發現影響施工之缺失。", standards: { ...QUALITY_STANDARD_DEFAULTS }, checks: QUALITY_CHECKS.map(([t, e, a]) => ({ item: t, standard: e, placeholder: a, actual: QUALITY_EXAMPLE_VALUES[t] || "已確認", result: "符合" })) };
}
function clearAllData() {
  window.dispatchEvent(new Event("continuous-wall-replacing"));
  state.overview = { project: "", contractor: "", reviewer: "" }, state.dates = { excavationStart: "", excavationEnd: "", pouring: "" }, state.wall = { unitType: "", unitNo: "", sequenceNo: "", designDepth: "", strength: "", strengthUnit: "kgf/cm²", thickness: "", length: "", topElevation: "", designVolume: "", actualVolume: "" }, state.soil = [], state.depth = [], state.prework = Object.fromEntries(PHASES.map((t) => [t.id, { date: "", start: "", end: "" }])), state.trucks = [], state.guideWall = { date: "", axisNo: "", reviewer: "", note: "", checks: GUIDE_WALL_CHECKS.map(createGuideWallCheck) }, state.rebarCage = { date: "", cageNo: "", reviewer: "", note: "", mode: "simple", parts: createRebarCageParts(), checks: REBAR_CAGE_CHECKS.map(([t, e]) => ({ item: t, standard: e, actual: "", result: "待確認" })), photos: [] }, state.quality = { note: "", standards: { ...QUALITY_STANDARD_DEFAULTS }, checks: QUALITY_CHECKS.map(([t, e, a]) => ({ item: t, standard: e, placeholder: a, actual: "", result: "待確認" })) }, Object.keys(editIndex).forEach((t) => {
    editIndex[t] = null;
  }), undoGeneration++, setInitialInputs(), setChecklistInputs(), setQualityInputs(), $("#phase-select").value = PHASES[0].id, renderPhaseEditor(), renderAll(), refreshRocDateHints(), window.dispatchEvent(new Event("continuous-wall-clear"));
}
function openSoilDialog(t = null) {
  editIndex.soil = t;
  const e = t === null ? { time: "" } : state.soil[t];
  $("#soil-time").value = e.time, $("#soil-dialog-title").textContent = t === null ? "新增出土紀錄" : `修改第 ${t + 1} 次出土`, $("#soil-form [type='submit']").textContent = t === null ? "確認加入" : "確認更新", $("#soil-dialog").showModal();
}
function openDepthDialog(t = null) {
  editIndex.depth = t;
  const e = t === null ? { time: "", value: "" } : state.depth[t];
  $("#depth-time").value = e.time, $("#depth-value").value = e.value, $("#depth-dialog-title").textContent = t === null ? "新增深度確認" : `修改第 ${t + 1} 次深度`, $("#depth-form [type='submit']").textContent = t === null ? "確認加入" : "確認更新", syncMeasuredErrors($("#depth-form")), $("#depth-dialog").showModal();
}
function openTruckDialog(t = null) {
  editIndex.truck = t;
  const e = t === null ? { truckNo: "", arrival: "", dispatch: "", unload: "", finish: "", volume: "", measured: "", slump: "" } : state.trucks[t];
  $("#truck-number").value = e.truckNo, $("#truck-arrival").value = e.arrival || "", $("#truck-arrival").required = t === null, $("#truck-dispatch").value = e.dispatch, $("#truck-unload").value = e.unload, $("#truck-finish").value = e.finish, $("#truck-volume").value = e.volume, $("#truck-measured").value = e.measured, $("#truck-slump").value = e.slump, $("#truck-dialog-title").textContent = t === null ? `新增第 ${state.trucks.length + 1} 車` : `修改第 ${t + 1} 車`;
  const a = state.trucks.slice(0, t ?? state.trucks.length).reduce((n, s) => n + (measuredNumber(s.volume) ?? 0), 0);
  $("#truck-cumulative").textContent = `目前累積：${fixed(a)} m³`, $("#truck-form [type='submit']").textContent = t === null ? "確認加入" : "確認更新", syncMeasuredErrors($("#truck-form")), $("#truck-dialog").showModal();
}
function noticeReplacedResult(t, e, a) {
  if (!e) return;
  const n = { 符合: "✓", 不符合: "✗" }[t.result] || t.result;
  showUndo(`已依新數值改判為 ${n}，取代手動判定`, () => {
    t.result = e, markManualResult(t), a();
  });
}
// The host renders the toast. A newer message or clearing the form cancels a pending undo, as the old toast did.
// The undo click happens in the host, so no iframe DOM event fires; save explicitly after undoing (sdk.md, host-rendered actions).
function showUndo(t, e = null) {
  const a = ++undoGeneration;
  if (!e) return void studio.notify(t);
  studio.notify(t, { action: "復原" }).then((n) => {
    n === "action" && a === undoGeneration && (e(), window.continuousWallBridge.scheduleDraft());
  });
}
function removeRecord(t, e) {
  const a = state[t], [n] = a.splice(e, 1), s = t === "trucks" ? renderPouring : renderExcavation;
  s(), showUndo(`已刪除${t === "soil" ? "出土紀錄" : t === "depth" ? "深度確認" : "澆置車次"}`, () => {
    a.splice(e, 0, n), s();
  });
}
function recordDates() {
  return [state.dates.excavationStart, state.dates.excavationEnd, ...PHASES.map((t) => state.prework[t.id].date), state.dates.pouring].filter(Boolean).sort();
}
function dateRangeText(t, e) {
  return !t && !e ? "" : !t || !e || t === e ? t || e : `${t} ～ ${e}`;
}
function constructionPeriodText() {
  const t = recordDates();
  return dateRangeText(t[0], t.at(-1));
}
function printHeader({ title: t, sequence: e, identity: a, date: n, dateLabel: s = "施工期間", reviewer: l = state.overview.reviewer, reviewerLabel: i = "填表人" }) {
  const c = a || [state.wall.unitType, state.wall.unitNo].filter(Boolean).join("｜") || "未指定單元";
  return `<header class="print-document-header"><div class="print-header-title"><p>DIAPHRAGM WALL FIELD RECORD / ${e}</p><h1>${esc(t)}</h1></div><div class="print-header-meta-body"><div class="print-header-project-lines">
    <div><span>工程名稱：</span><strong>${esc(display(state.overview.project))}</strong></div>
    <div><span>${esc(s)}：</span><strong>${esc(display(n))}</strong></div>
    <div><span>施工廠商：</span><strong>${esc(display(state.overview.contractor))}</strong></div>
    <div><span>${esc(i)}：</span><strong>${esc(display(l))}</strong></div>
  </div></div><div class="print-header-logo-wrap"><strong class="print-header-identity">${esc(c)}</strong></div></header>`;
}
function printWallInfo() {
  const t = designHeight(), e = number(state.wall.designVolume) ?? calculatedDesignVolume();
  return `<section class="print-section print-wall-info"><h2>壁體資訊</h2><div class="print-meta-grid three">
    <div><span>單元類型</span><strong>${esc(display(state.wall.unitType))}</strong></div>
    <div><span>單元編號</span><strong>${esc(display(state.wall.unitNo))}</strong></div>
    <div><span>順序編號</span><strong>${esc(display(state.wall.sequenceNo))}</strong></div>
    <div><span>混凝土強度(${esc(strengthUnit())})</span><strong>${esc(display(state.wall.strength))}</strong></div>
    <div><span>設計深度(GL,m)</span><strong>GL ${esc(display(state.wall.designDepth))} m</strong></div>
    <div><span>壁厚／單元長度(m)</span><strong>${esc(display(state.wall.thickness))} ／ ${esc(display(state.wall.length))}</strong></div>
    <div><span>澆置頂端高程(GL,m)</span><strong>GL ${measuredNumber(state.wall.topElevation) !== null && measuredNumber(state.wall.topElevation) >= 0 ? "+" : ""}${esc(display(state.wall.topElevation))}</strong></div>
    <div><span>設計澆置高度(m)</span><strong>${fixed(t)}</strong></div>
    <div><span>設計／實際數量(m³)／差異</span><strong>${e === null ? "" : fixed(e)} ／ ${esc(display(state.wall.actualVolume))}${volumeDifferenceRate() === null ? "" : ` ／ ${volumeDifferenceRate().toFixed(2)}%`}</strong></div>
  </div></section>`;
}
function pouringChartSvg(t) {
  const e = number(state.wall.designVolume) ?? calculatedDesignVolume(), a = designHeight(), n = t.filter((p) => p.cumulative > 0 && p.measured !== null), s = t.at(-1)?.cumulative ?? 0, l = Math.max(e ?? 0, s, 1), i = n.reduce((p, k) => Math.max(p, k.measured), 0), c = Math.max(a ?? 0, i, 1), g = (p) => [5, 10, 20, 50, 100].find((k) => p / k <= 16) ?? 200, f = (p, k) => Math.max(k, Math.ceil(p / k) * k), r = g(l), m = g(c), v = f(l, r), _ = f(c, m), b = 760, u = 470, d = { top: 22, right: 22, bottom: 52, left: 58 }, y = b - d.left - d.right, o = u - d.top - d.bottom, h = (p) => d.left + p / v * y, w = (p) => d.top + o - p / _ * o, x = (p, k) => {
    const C = [];
    for (let L = 0; L <= p + 1e-4; L += k) C.push(Number(L.toFixed(2)));
    return C;
  }, E = [...x(v, r).map((p) => `<line x1="${h(p)}" y1="${d.top}" x2="${h(p)}" y2="${d.top + o}" />`), ...x(_, m).map((p) => `<line x1="${d.left}" y1="${w(p)}" x2="${d.left + y}" y2="${w(p)}" />`)].join(""), D = x(v, r).map((p) => `<text x="${h(p)}" y="${u - 30}" text-anchor="middle">${p}</text>`).join(""), S = x(_, m).map((p) => `<text x="${d.left - 8}" y="${w(p) + 3}" text-anchor="end">${p}</text>`).join(""), T = e !== null && a !== null ? `M ${h(0)} ${w(0)} L ${h(Math.min(e, v))} ${w(Math.min(a, _))}` : "", N = [[0, 0], ...n.map((p) => [Math.min(p.cumulative, v), Math.min(p.measured, _)])], q = n.length > 0 ? N.map(([p, k], C) => `${C === 0 ? "M" : "L"} ${h(p)} ${w(k)}`).join(" ") : "", M = n.map((p) => `<circle cx="${h(Math.min(p.cumulative, v))}" cy="${w(Math.min(p.measured, _))}" r="3.2" />`).join(""), A = T || q;
  return `<div class="pouring-chart" role="img" aria-label="設計與實際混凝土澆置高度曲線"><svg viewBox="0 0 ${b} ${u}" preserveAspectRatio="none">
    <g class="chart-grid">${E}</g><g class="chart-axis"><line x1="${d.left}" y1="${d.top + o}" x2="${d.left + y}" y2="${d.top + o}" /><line x1="${d.left}" y1="${d.top}" x2="${d.left}" y2="${d.top + o}" /></g>
    <g class="chart-labels">${D}${S}<text class="chart-axis-title" x="${d.left + y / 2}" y="${u - 8}" text-anchor="middle">實際累積澆置體積（m³）</text><text class="chart-axis-title" transform="translate(14 ${d.top + o / 2}) rotate(-90)" text-anchor="middle">累積澆置高度（m）</text></g>
    ${T ? `<path class="chart-design-line" d="${T}" />` : ""}${q ? `<path class="chart-actual-line" d="${q}" />` : ""}<g class="chart-actual-points">${M}</g>
    <g class="chart-legend"><rect x="${b - 178}" y="${d.top + 10}" width="158" height="50" rx="2" /><line class="chart-design-line" x1="${b - 164}" y1="${d.top + 27}" x2="${b - 143}" y2="${d.top + 27}" /><text x="${b - 136}" y="${d.top + 30}">設計澆置曲線</text><line class="chart-actual-line" x1="${b - 164}" y1="${d.top + 47}" x2="${b - 143}" y2="${d.top + 47}" /><circle class="chart-actual-points" cx="${b - 153.5}" cy="${d.top + 47}" r="2.6" /><text x="${b - 136}" y="${d.top + 50}">實際澆置曲線</text></g>
    ${A ? "" : `<text class="chart-empty" x="${d.left + y / 2}" y="${d.top + o / 2}" text-anchor="middle">尚無足夠資料產生曲線</text>`}
  </svg><p class="pouring-chart-note">設計線依設計澆置高度與設計數量換算；實際線從原點開始，依每車累積方量與實測累積高度繪製。</p></div>`;
}
function renderPrint() {
  const t = designHeight(), e = state.depth.at(-1), a = e ? measuredNumber(e.value) : null, n = a !== null && measuredNumber(state.wall.designDepth) !== null ? a - measuredNumber(state.wall.designDepth) : null, s = calculatedTrucks(), l = s.at(-1), i = state.quality.checks.map((o, h) => `<tr><td>${h + 1}</td><td class="text-left">${esc(o.item)}</td><td class="text-left">${esc(qualityCheckStandard(h, o.standard))}</td><td class="text-left">${esc(qualityActualText(o))}</td><td>${esc(o.result)}</td></tr>`).join(""), c = QUALITY_STANDARD_CONFIG.map((o) => {
    const h = state.wall.unitType, w = h === "公單元" ? "embedmentMale" : h === "母單元" ? "embedmentFemale" : h === "公母單元" ? "embedmentBoth" : null;
    return o.key.startsWith("embedment") && w && o.key !== w ? "" : `<tr><td class="text-left">${esc(o.label)}</td><td class="text-left">${esc(qualityStandardText(o.key))}</td><td>${esc(qualityStandardValue(o.key))}</td><td>${esc(o.unit)}</td></tr>`;
  }).filter(Boolean).join("");
  $("#print-quality").innerHTML = `${printHeader({ title: "連續壁施工品質自檢總表", sequence: "03", date: constructionPeriodText() })}
    ${printWallInfo()}
    <section class="print-section compact-print-section"><h2>檢查項目</h2><table class="print-table quality-standard-print-table"><thead><tr><th>項目</th><th>判定標準</th><th>數值</th><th>單位</th></tr></thead><tbody>${c}</tbody></table></section>
    <section class="print-section compact-print-section"><h2>品質自檢項目</h2><table class="print-table quality-print-table"><thead><tr><th>項次</th><th>檢查項目</th><th>檢查標準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${i}</tbody></table></section>
    <section class="print-section quality-note-section"><h2>缺失及改善結果</h2><div class="print-note">${esc(display(state.quality.note))}</div></section>${printFooter()}`;
  const g = calculatedExcavation(), f = g.soil.length ? g.soil.map((o) => `<tr><td>${o.index + 1}</td><td class="time-cell">${esc(o.time30)}</td></tr>`).join("") : '<tr><td colspan="2" class="print-empty">尚無出土紀錄</td></tr>', r = g.depth.length ? g.depth.map((o) => `<tr><td>${o.index + 1}</td><td class="time-cell">${esc(o.time30)}</td><td>${fixed(o.value)}</td><td>${fixed(o.difference)}</td></tr>`).join("") : '<tr><td colspan="4" class="print-empty">尚無深度確認</td></tr>', m = PHASES.map((o, h) => {
    const w = state.prework[o.id], x = phaseTimes(o);
    return `<tr><td>${h + 1}</td><td class="text-left">${esc(o.label)}</td><td class="time-cell">${esc(display(w.date))}</td><td class="time-cell">${o.start ? esc(x.start) : ""}</td><td class="time-cell">${o.end ? esc(x.end) : ""}</td></tr>`;
  }).join(""), v = dateRangeText(state.dates.excavationStart, state.dates.excavationEnd);
  $("#print-excavation-prework").innerHTML = `${printHeader({ title: "開挖與前置紀錄", sequence: "04–05", date: v, dateLabel: "開挖日期" })}
    ${printWallInfo()}
    <section class="print-section"><h2>04｜開挖紀錄<span class="print-heading-meta">開挖日期：${esc(display(v))}</span></h2><div class="print-summary">
      <div><span>出土次數</span><strong>${state.soil.length} 次</strong></div>
      <div><span>深度確認</span><strong>${state.depth.length} 次</strong></div>
      <div><span>最新深度</span><strong>${fixed(a)} m</strong></div>
      <div><span>與設計差異</span><strong>${fixed(n)} m</strong></div>
    </div></section>
    <section class="print-section"><h2>出土紀錄</h2><table class="print-table"><thead><tr><th>次數</th><th>出土時間</th></tr></thead><tbody>${f}</tbody></table></section>
    <section class="print-section"><h2>深度確認</h2><table class="print-table"><thead><tr><th>次數</th><th>確認時間</th><th>深度（m）</th><th>與設計差異（m）</th></tr></thead><tbody>${r}</tbody></table></section>
    <section class="print-section"><h2>05｜前置紀錄時間紀錄</h2><table class="print-table prework-print-table"><thead><tr><th>項次</th><th>作業項目</th><th>作業日期</th><th>開始時間</th><th>完成時間</th></tr></thead><tbody>${m}</tbody></table></section>
    <p class="print-table-note">跨午夜的時間以 24 時以後接續表示（例：24:20＝翌日 00:20）。</p>${printFooter()}`;
  const _ = s.length ? s.map((o) => `<tr>
    <td>${o.index + 1}</td><td>${esc(o.truckNo)}</td><td class="time-cell">${esc(o.dispatch30)}</td><td class="time-cell">${esc(o.unload30)}</td><td class="time-cell">${esc(o.finish30)}</td><td>${esc(o.slumpLabel)}</td><td>${fixed(o.volume)}</td><td>${fixed(o.cumulative)}</td><td>${fixed(o.expected)}</td><td>${fixed(o.measured)}</td><td>${o.minutes === null ? "—" : o.minutes}</td>
  </tr>`).join("") : '<tr><td colspan="11" class="print-empty">尚無澆置紀錄</td></tr>';
  $("#print-pouring").innerHTML = `${printHeader({ title: "澆置紀錄", sequence: "06", date: state.dates.pouring, dateLabel: "澆置日期" })}
    <div class="pouring-layout">
      <div class="pouring-wall-full">${printWallInfo()}</div>
      <div class="pouring-main-layout"><div class="pouring-table-column"><section class="print-section"><h2>澆置主控摘要</h2><div class="print-summary">
        <div><span>車次(車)</span><strong>${s.length}</strong></div>
        <div><span>逐車累積量(m³)</span><strong>${fixed(l?.cumulative ?? 0)}</strong></div>
        <div><span>設計／實際數量(m³)／差異</span><strong>${esc(display(state.wall.designVolume))} ／ ${esc(display(state.wall.actualVolume))}${volumeDifferenceRate() === null ? "" : ` ／ ${volumeDifferenceRate().toFixed(2)}%`}</strong></div>
        <div><span>預估／實測／差異(m)</span><strong>${fixed(l?.expected ?? null)} ／ ${fixed(l?.measured ?? null)} ／ ${fixed(l?.difference ?? null)}</strong></div>
      </div></section><section class="print-section pouring-table-section"><h2>逐車混凝土澆置紀錄</h2><table class="print-table"><thead><tr><th>車次</th><th>車號</th><th>出廠</th><th>卸料</th><th>結束</th><th>坍度(cm)</th><th>方量(m³)</th><th>累積(m³)</th><th>預估高(m)</th><th>實際高(m)</th><th>澆置時間(分)</th></tr></thead><tbody>${_}</tbody></table><p class="print-table-note">跨午夜的時間以 24 時以後接續表示（例：25:30＝翌日 01:30）；澆置時間＝結束 − 出廠。</p></section></div><section class="print-section pouring-chart-section"><h2>澆置高度曲線</h2>${pouringChartSvg(s)}</section></div></div>${printFooter()}`;
  const b = state.guideWall.checks.map((o, h) => `<tr><td>${h + 1}</td><td class="text-left">${esc(o.item)}</td><td class="text-left">${standardHtml(o.standard)}</td><td class="text-left">${esc(guideCheckActual(o))}</td><td>${esc(o.result)}</td></tr>`).join("");
  $("#print-guide-wall").innerHTML = `${printHeader({ title: "導溝施工複核表", sequence: "07", identity: state.guideWall.axisNo || "未填軸線", date: state.guideWall.date, dateLabel: "複核日期", reviewer: state.guideWall.reviewer, reviewerLabel: "營造廠複核人" })}
    <section class="print-section"><h2>導溝資料</h2><div class="print-meta-grid">
      <div><span>軸線／方向編號</span><strong>${esc(display(state.guideWall.axisNo))}</strong></div>
      <div><span>複核意見</span><strong>${esc(display(state.guideWall.note))}</strong></div>
    </div></section>
    <section class="print-section"><h2>導溝複核項目</h2><table class="print-table checklist-print-table"><thead><tr><th>項次</th><th>複核項目</th><th>確認基準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${b}</tbody></table></section>${printFooter()}`;
  const u = state.rebarCage.checks.map((o, h) => `<tr><td>${h + 1}</td><td class="text-left">${esc(o.item)}</td><td class="text-left">${standardHtml(o.standard)}</td><td class="text-left">${esc(display(o.actual))}</td><td>${esc(o.result)}</td></tr>`).join("");
  $("#print-rebar-cage").innerHTML = `${printHeader({ title: "鋼筋籠吊放前複核表", sequence: "08", identity: [state.wall.unitNo, state.rebarCage.cageNo].filter(Boolean).join("｜") || "未指定鋼筋籠", date: state.rebarCage.date, dateLabel: "複核日期", reviewer: state.rebarCage.reviewer, reviewerLabel: "營造廠複核人" })}
    <section class="print-section"><h2>鋼筋籠資料</h2><div class="print-meta-grid compact-meta">
      <div><span>單元編號</span><strong>${esc(display(wallUnitLabel()))}</strong></div>
      <div><span>順序編號</span><strong>${esc(display(state.wall.sequenceNo))}</strong></div>
      <div><span>鋼筋籠編號</span><strong>${esc(display(state.rebarCage.cageNo))}</strong></div>
      <div><span>複核意見</span><strong>${esc(display(state.rebarCage.note))}</strong></div>
    </div></section>
    <section class="print-section compact-print-section"><h2>配筋抽查明細</h2>${rebarCagePrintTableHtml(state.rebarCage)}</section>
    <section class="print-section compact-print-section"><h2>組裝與吊放條件</h2><table class="print-table rebar-cage-check-print-table"><thead><tr><th>項次</th><th>複核項目</th><th>確認基準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${u}</tbody></table></section>${printFooter()}`;
  const d = state.rebarCage.photos || [], y = $("#print-rebar-cage-photos");
  y.style.display = d.length ? "" : "none", y.innerHTML = d.length ? `${printHeader({ title: "鋼筋籠複核照片", sequence: "08", identity: [state.wall.unitNo, state.rebarCage.cageNo].filter(Boolean).join("｜") || "未指定鋼筋籠", date: state.rebarCage.date, dateLabel: "複核日期", reviewer: state.rebarCage.reviewer, reviewerLabel: "營造廠複核人" })}${cagePhotosPrintHtml(d)}${printFooter()}` : "";
}
function setPdfDocumentTitle(t) {
  const e = TOOL_LABELS[activeTool] || "施工檢核紀錄", a = activeTool === "guideWall" ? state.guideWall.axisNo : state.wall.unitNo || (activeTool === "rebarCage" ? state.rebarCage.cageNo : ""), n = currentExportLabel(activeTool, activeTab), s = { pouring: state.dates.pouring, "excavation-prework": state.dates.excavationStart, guideWall: state.guideWall.date, rebarCage: state.rebarCage.date }, l = activeTool === "diaphragmWall" ? PRINT_TAB_GROUPS[activeTab] : activeTool, i = (t === "all" && activeTool === "diaphragmWall" ? null : s[l]) || recordDates().at(-1) || today, c = [e, a, t === "all" ? "完整檢核紀錄" : n, i];
  setPrintDocumentTitle(c);
}
function preparePrint(t) {
  renderPrint(), document.body.dataset.printScope = t;
  const e = activeTool === "diaphragmWall" ? PRINT_TAB_GROUPS[activeTab] : PRINT_TAB_GROUPS[activeTool];
  $$(".print-page").forEach((a) => a.classList.toggle("print-selected", a.dataset.printTab === e)), setPdfDocumentTitle(t), paginatePrintReport();
}
function exportPdf(t) {
  window.continuousWallBridge.preview(t);
}
// photos: the rebar-cage photos as exportCagePhotos read them (only exportJson writes a file).
function exportData(photos) {
  const t = (r) => {
    const m = measuredNumber(r);
    return m === null ? null : m;
  }, e = (r) => {
    const m = String(r ?? "").trim();
    if (!m) return null;
    const v = number(m);
    return v === null ? m : v;
  }, a = designHeight(), n = calculatedDesignVolume(), s = t(state.wall.designDepth), l = calculatedExcavation().depth.map((r) => ({ sequence: r.index + 1, confirmation_time: r.time || null, depth_m: r.value, design_difference_m: r.difference })), i = calculatedTrucks().map((r) => ({ sequence: r.index + 1, trip_id: r.tripId, truck_no: r.truckNo || null, arrival_time: r.arrival || null, dispatch_time: r.dispatch || null, unload_time: r.unload || null, finish_time: r.finish || null, pour_minutes: r.minutes, slump_test_no: r.slumpNo, slump_cm: t(r.slump), volume_m3: t(r.volume), cumulative_volume_m3: r.cumulative, design_height_m: r.expected, measured_height_m: r.measured, height_difference_m: r.difference })), g = { 公單元: "embedmentMale", 母單元: "embedmentFemale", 公母單元: "embedmentBoth" }[state.wall.unitType] || null, f = Object.fromEntries(Object.entries(state.quality.standards).filter(([r]) => !r.startsWith("embedment") || r === g).map(([r, m]) => [r, { value: m, calculated_value: r === "volumeDifference" && volumeDifferenceRate() !== null ? volumeDifferenceRate().toFixed(2) : qualityStandardValue(r), display: qualityStandardText(r) }]));
  return { app_version: APP_VERSION, schema_version: "1.8", record_type: "diaphragm_wall_field_record", exported_at: (/* @__PURE__ */ new Date()).toISOString(), export_context: { active_tool: activeTool, active_tab: activeTool === "diaphragmWall" ? activeTab : activeTool, current_form_label: currentExportLabel(activeTool, activeTab) }, construction_plan: null, project: { name: state.overview.project || null, contractor: state.overview.contractor || null, construction_date: state.dates.pouring || recordDates().at(-1) || null, construction_period: { start: recordDates()[0] || null, end: recordDates().at(-1) || null }, form_filler: state.overview.reviewer || null }, wall_unit: { unit_type: state.wall.unitType || null, unit_no: state.wall.unitNo || null, sequence_no: state.wall.sequenceNo || null, design_depth_m: s, top_elevation_m: t(state.wall.topElevation), thickness_m: t(state.wall.thickness), length_m: t(state.wall.length), concrete_strength: e(state.wall.strength), concrete_strength_unit: strengthUnit(), design_pour_height_m: a, design_volume_m3: n, actual_volume_m3: t(state.wall.actualVolume), volume_difference_pct: volumeDifferenceRate() === null ? null : Number(volumeDifferenceRate().toFixed(2)) }, excavation: { start_date: state.dates.excavationStart || null, end_date: state.dates.excavationEnd || null, soil_records: state.soil.map((r, m) => ({ sequence: m + 1, time: r.time || null })), depth_confirmations: l }, prework: PHASES.map((r) => ({ phase_id: r.id, phase_name: r.label, date: state.prework[r.id].date || null, start_time: state.prework[r.id].start || null, finish_time: state.prework[r.id].end || null })), pouring: { date: state.dates.pouring || null, trucks: i, total_trucks: i.length, cumulative_volume_m3: i.at(-1)?.cumulative_volume_m3 ?? 0, last_design_height_m: i.at(-1)?.design_height_m ?? null, last_measured_height_m: i.at(-1)?.measured_height_m ?? null, last_height_difference_m: i.at(-1)?.height_difference_m ?? null }, quality_self_check: { note: state.quality.note || null, standards: f, items: state.quality.checks.map((r, m) => ({ item_no: m + 1, item: r.item, standard: qualityCheckStandard(m, r.standard), actual: r.actual || null, unit: qualityMeasure(r)?.unit() || null, result: r.result })) }, guide_wall_review: { project: state.overview.project || null, contractor: state.overview.contractor || null, review_date: state.guideWall.date || null, axis_no: state.guideWall.axisNo || null, reviewer: state.guideWall.reviewer || null, note: state.guideWall.note || null, items: state.guideWall.checks.map((r, m) => ({ item_no: m + 1, item: r.item, standard: r.standard, design_value: e(r.design), actual: r.actual || null, unit: guideMeasure(r)?.unit || null, design_bar_size: r.designBarNo || null, design_bar_spacing_cm: e(r.designBarSpacing), bar_size: r.barNo || null, bar_spacing_cm: e(r.barSpacing), result: r.result })) }, rebar_cage_review: { project: state.overview.project || null, review_date: state.rebarCage.date || null, cage_no: state.rebarCage.cageNo || null, reviewer: state.rebarCage.reviewer || null, note: state.rebarCage.note || null, mode: state.rebarCage.mode, parts: exportRebarCageParts(state.rebarCage), photos, inspection_items: state.rebarCage.checks.map((r, m) => ({ item_no: m + 1, item: r.item, standard: r.standard, actual: r.actual || null, result: r.result })) } };
}
function exportFileName(t) {
  const e = safeFilePart(state.wall.unitNo, ""), a = safeFilePart(recordDates().at(-1) || today, today);
  return `${["diaphragm-wall", e, a].filter(Boolean).join("-")}.${t}`;
}
function downloadText(t, e, a) {
  const n = new Blob([t], { type: e }), s = URL.createObjectURL(n), l = document.createElement("a");
  l.href = s, l.download = a, document.body.appendChild(l), l.click(), l.remove(), setTimeout(() => URL.revokeObjectURL(s), 1e3);
}
async function exportJson() {
  try {
    const t = await exportCagePhotos(state.rebarCage.photos);
    downloadText(`${JSON.stringify(exportData(t), null, 2)}
`, "application/json;charset=utf-8", exportFileName("json"));
  } catch (t) {
    window.continuousWallBridge.fail(t);
  }
}
function importText(t) {
  return t == null ? "" : String(t);
}
function importResult(t) {
  return ["待確認", "符合", "不符合", "不適用"].includes(t) ? t : "待確認";
}
function importChecklistItems(t, e) {
  const a = Array.isArray(e) ? e : [];
  return t.map(([n, s, l], i) => {
    const c = a[i] || {};
    return { item: importText(c.item) || n, standard: importText(c.standard) || s, placeholder: l || "", actual: importText(c.actual), barNo: importText(c.bar_size || c.bar_no), barSpacing: importText(c.bar_spacing_cm || c.bar_spacing), result: importResult(c.result) };
  });
}
const GUIDE_WALL_LEGACY_ALIASES = { 放樣: ["放樣與單元中心線", "單元位置與中心線"], 地下管線: ["地下管線位置確認"], 位置與淨寬: ["導溝寬度／淨寬", "導溝寬度與淨寬", "導溝內面淨寬實測"], 深度: ["導溝深度與底高程", "導溝頂高程／深度"], 牆厚: ["導溝牆壁厚度"], 鋼筋: ["導溝鋼筋號數與間距"], 回撐木: ["回撐木配置與間距"], 混凝土強度: ["導溝混凝土強度"], 頂部基準高程: ["導溝頂基準高程實測"], 壁面順直度: ["導溝壁面垂直與順直度", "導溝垂直與壁面完整性"] };
function importGuideWallItems(t) {
  const e = Array.isArray(t) ? t : [];
  return GUIDE_WALL_CHECKS.map(([a, n]) => {
    const s = [a, ...GUIDE_WALL_LEGACY_ALIASES[a] || []], l = e.find((i) => s.includes(i?.item)) || {};
    return { item: a, standard: !GUIDE_WALL_MEASURES[a] && importText(l.standard) || n, design: importText(l.design_value), actual: importText(l.actual), designBarNo: importText(l.design_bar_size), designBarSpacing: importText(l.design_bar_spacing_cm), barNo: importText(l.bar_size || l.bar_no), barSpacing: importText(l.bar_spacing_cm || l.bar_spacing), result: importResult(l.result), auto: "" };
  });
}
const NOT_EXPORT_FILE = "這不是連續壁施工紀錄的匯出檔。";
function importJsonPayload(t) {
  if (!t || !["diaphragm_wall_field_record", "continuous_wall_field_record"].includes(t.record_type)) throw new Error(NOT_EXPORT_FILE);
  const a = t.project || {}, n = t.wall_unit || {}, s = t.excavation || {}, l = Array.isArray(t.prework) ? t.prework : [], i = t.pouring || {}, c = t.quality_self_check || {}, g = t.guide_wall_review || t.trench_review || {}, f = t.rebar_cage_review || t.cage_review || {};
  state.overview = { project: importText(a.name) || importText(g.project) || importText(f.project), contractor: importText(a.contractor) || importText(g.contractor), reviewer: importText(a.form_filler) };
  const r = importText(a.construction_date);
  state.dates = { excavationStart: importText(s.start_date) || r, excavationEnd: importText(s.end_date), pouring: importText(i.date) || r }, state.wall = { unitType: importText(n.unit_type), unitNo: importText(n.unit_no) || importText(f.unit_no), sequenceNo: importText(n.sequence_no), designDepth: importText(n.design_depth_m), strength: importText(n.concrete_strength ?? n.concrete_strength_kgf_cm2), strengthUnit: STRENGTH_UNITS.includes(n.concrete_strength_unit) ? n.concrete_strength_unit : STRENGTH_UNITS[0], thickness: importText(n.thickness_m), length: importText(n.length_m), topElevation: importText(n.top_elevation_m), designVolume: importText(n.design_volume_m3), actualVolume: importText(n.actual_volume_m3) }, state.soil = (Array.isArray(s.soil_records) ? s.soil_records : []).map((u) => ({ time: importText(u.time) })).filter((u) => u.time), state.depth = (Array.isArray(s.depth_confirmations) ? s.depth_confirmations : []).map((u) => ({ time: importText(u.confirmation_time), value: importText(u.depth_m) })).filter((u) => u.time || u.value), state.prework = Object.fromEntries(PHASES.map((u) => {
    const d = l.find((y) => y.phase_id === u.id) || {};
    return [u.id, { date: importText(d.date) || r, start: importText(d.start_time), end: importText(d.finish_time) }];
  })), state.trucks = normalizeTruckTrips((Array.isArray(i.trucks) ? i.trucks : []).map((u) => ({ tripId: importText(u.trip_id), truckNo: importText(u.truck_no), arrival: importText(u.arrival_time), dispatch: importText(u.dispatch_time), unload: importText(u.unload_time), finish: importText(u.finish_time), volume: importText(u.volume_m3), measured: importText(u.measured_height_m), slump: importText(u.slump_cm) })));
  const m = { ...QUALITY_STANDARD_DEFAULTS };
  Object.entries(c.standards || {}).forEach(([u, d]) => {
    Object.prototype.hasOwnProperty.call(m, u) && (m[u] = importText(d && typeof d == "object" ? d.selection ?? d.value : d));
  }), state.quality = { note: importText(c.note), standards: m, checks: importChecklistItems(QUALITY_CHECKS, c.items) }, state.guideWall = { date: importText(g.review_date), axisNo: importText(g.axis_no), reviewer: importText(g.reviewer), note: importText(g.note), checks: importGuideWallItems(g.items) }, state.rebarCage = { date: importText(f.review_date), cageNo: importText(f.cage_no), reviewer: importText(f.reviewer), note: importText(f.note), mode: f.mode === "detailed" ? "detailed" : "simple", parts: importRebarCageParts(f.parts), checks: importChecklistItems(REBAR_CAGE_CHECKS, f.inspection_items), photos: [] };
  const v = t.export_context || {}, _ = ["diaphragmWall", "guideWall", "rebarCage"].includes(v.active_tool) ? v.active_tool : "diaphragmWall", b = TAB_LABELS[v.active_tab] ? v.active_tab : "wall";
  setInitialInputs(), setChecklistInputs(), setQualityInputs(), $("#phase-select").value = PHASES[0].id, renderPhaseEditor(), renderAll(), showTool(_), _ === "diaphragmWall" && showTab(b), refreshRocDateHints();
  return importCagePhotos(f.photos);
}
async function importJsonFile(t) {
  try {
    const e = JSON.parse(await t.text());
    window.dispatchEvent(new Event("continuous-wall-replacing"));
    const a = importJsonPayload(e);
    window.dispatchEvent(new Event("continuous-wall-clear")), showUndo("匯入完成：已回填連續壁、導溝與鋼筋籠全部分頁。"), a.length && importPhotos(a);
  } catch (e) {
    // Never the raw parser/JS message: our own "not an export file", a platform code this page has text for, or the generic text.
    showUndo(`匯入失敗：${e.message === NOT_EXPORT_FILE ? NOT_EXPORT_FILE : window.continuousWallBridge.knownText(e) || "檔案格式無法辨識。"}`);
  }
}
// The imported photos take the picked-photo path (studio.image.compress, then addCagePhoto) once the imported form is
// stored as a record (design §3.2). A photo that fails does not stop the others; the count and last reason are shown
// as a notice like 匯入完成 (the status line is overwritten by the next autosave).
async function importPhotos(t) {
  const e = window.continuousWallBridge;
  let a = 0, n = null;
  for (const { data: s, caption: l } of t) try {
    await addCagePhoto(() => state.rebarCage.photos, await studio.image.compress(cagePhotoBlob(s)), l);
  } catch (i) {
    a += 1, n = i;
  }
  renderRebars(), e.scheduleDraft(), a && showUndo(`有 ${a} 張照片沒有匯入：${e.describe(n)}`);
}
function handleExport(t) {
  if (t === "pdf-current") return exportPdf("current");
  if (t === "pdf-all") return exportPdf("all");
  t === "json" && exportJson();
}
function initialize() {
  addRocDateHints(document), setInitialInputs(), $("#phase-select").innerHTML = PHASES.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join(""), renderPhaseEditor(), renderAll(), refreshRocDateHints(), showTab("wall"), document.addEventListener("input", (t) => {
    const e = t.target.closest("[data-bind]");
    if (e) {
      const [i, c] = e.dataset.bind.split(".");
      state[i][c] = e.value, i === "wall" && (syncUnitInputs(e), updateWallCalculation());
      return;
    }
    const a = t.target.closest("[data-check-bind]");
    if (a) {
      const [i, c] = a.dataset.checkBind.split(".");
      state[i][c] = a.value;
      return;
    }
    const n = t.target.closest("[data-quality-bind]");
    if (n) {
      state.quality[n.dataset.qualityBind] = n.value;
      return;
    }
    const s = t.target.closest("[data-check-item]");
    if (s) {
      const i = s.dataset.checkItem, c = state[i].checks[Number(s.dataset.checkIndex)];
      if (c[s.dataset.checkField] = s.value, i === "guideWall" && s.dataset.checkField !== "result" && guideMeasure(c)) {
        const g = applyGuideAutoResult(c);
        syncGuideMeasureCard(s.closest("[data-check-card]"), c), renderCheckProgress(i), noticeReplacedResult(c, g, () => renderCheckCards(i));
      }
    }
    const l = t.target.closest("[data-quality-item]");
    if (l) {
      const i = state.quality.checks[Number(l.dataset.qualityItem)];
      if (i[l.dataset.qualityField] = l.value, l.dataset.qualityField === "actual" && qualityMeasure(i)) {
        const { status: c } = qualityMeasureStatus(i), g = rejudge(i, c, { valueChanged: true });
        l.classList.toggle("is-invalid", c === "fail" || c === "invalid"), syncAutoResultCard(l.closest("[data-quality-card]"), i, autoLockedResults(i, c)), renderQualityProgress(), noticeReplacedResult(i, g, renderQuality);
      }
    }
  }), document.addEventListener("change", (t) => {
    const e = t.target.closest("[data-bind]");
    if (e?.type === "radio") {
      const [l, i] = e.dataset.bind.split(".");
      state[l][i] = e.value, l === "wall" && i === "unitType" && renderQuality();
      return;
    }
    const a = t.target.closest("[data-check-item]");
    if (a) {
      const l = a.dataset.checkItem, i = state[l].checks[Number(a.dataset.checkIndex)];
      i[a.dataset.checkField] = a.value, a.dataset.checkField === "result" && ("auto" in i && markManualResult(i), renderCheckCards(l));
    }
    const n = t.target.closest("[data-quality-item]");
    if (n) {
      const l = state.quality.checks[Number(n.dataset.qualityItem)];
      l[n.dataset.qualityField] = n.value, n.dataset.qualityField === "result" && markManualResult(l), (n.dataset.qualityField === "result" || qualityMeasure(l)) && renderQuality();
    }
    const s = t.target.closest("[data-quality-standard]");
    s && (state.quality.standards[s.dataset.qualityStandard] = s.value, renderQuality(), renderPouring());
  }), bindRebarCageUi({ getCage: () => state.rebarCage, onChange: renderRebars }), bindCagePhotosUi({ getPhotos: () => state.rebarCage.photos, onChange: renderRebars }), $$('.tab-row [role="tab"]').forEach((t) => {
    t.addEventListener("click", () => showTab(t.dataset.tab)), t.addEventListener("keydown", (e) => {
      const a = $$('.tab-row [role="tab"]', t.closest("[data-tool-view]")), n = a.indexOf(t), s = ["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 0;
      if (!s) return;
      e.preventDefault();
      const l = a[(n + s + a.length) % a.length];
      showTab(l.dataset.tab), l.focus();
    });
  }), $("#help-button").addEventListener("click", () => $("#help-dialog").showModal()), $$("[data-close-dialog], .kit-dialog-close").forEach((t) => t.addEventListener("click", () => t.closest("dialog").close())), $$("[data-export-format]").forEach((t) => t.addEventListener("click", () => handleExport(t.dataset.exportFormat))), $("#import-json-button").addEventListener("click", () => $("#json-file-input").click()), $("#json-file-input").addEventListener("change", async (t) => {
    const e = t.target.files?.[0];
    e && await importJsonFile(e), t.target.value = "";
  }), $$("[data-select-tool]").forEach((t) => t.addEventListener("click", () => showTool(t.dataset.selectTool))), $("#add-soil").addEventListener("click", () => openSoilDialog()), $("#add-depth").addEventListener("click", () => openDepthDialog()), $("#add-truck").addEventListener("click", () => openTruckDialog()), $("#soil-form").addEventListener("submit", (t) => {
    if (t.preventDefault(), !validateDialogForm(t.currentTarget)) return;
    const e = { time: $("#soil-time").value };
    editIndex.soil === null ? state.soil.push(e) : state.soil[editIndex.soil] = e, $("#soil-dialog").close(), renderExcavation();
  }), $("#depth-form").addEventListener("submit", (t) => {
    if (t.preventDefault(), !validateDialogForm(t.currentTarget)) return;
    const e = { time: $("#depth-time").value, value: $("#depth-value").value };
    editIndex.depth === null ? state.depth.push(e) : state.depth[editIndex.depth] = e, $("#depth-dialog").close(), renderExcavation();
  }), $("#truck-form").addEventListener("submit", (t) => {
    if (t.preventDefault(), !validateDialogForm(t.currentTarget)) return;
    const e = { tripId: editIndex.truck === null ? crypto.randomUUID() : state.trucks[editIndex.truck].tripId, truckNo: $("#truck-number").value.trim(), arrival: $("#truck-arrival").value, dispatch: $("#truck-dispatch").value, unload: $("#truck-unload").value, finish: $("#truck-finish").value, volume: $("#truck-volume").value, measured: $("#truck-measured").value, slump: $("#truck-slump").value };
    editIndex.truck === null ? state.trucks.push(e) : state.trucks[editIndex.truck] = e, $("#truck-dialog").close(), renderPouring();
  }), $("#phase-select").addEventListener("change", renderPhaseEditor), $("#confirm-phase").addEventListener("click", () => {
    const t = PHASES.find((e) => e.id === $("#phase-select").value);
    $$("[data-phase-input]").forEach((e) => {
      state.prework[t.id][e.dataset.phaseInput] = e.value;
    }), renderPrework();
  }), document.addEventListener("click", (t) => {
    const e = t.target.closest("[data-edit-soil]"), a = t.target.closest("[data-delete-soil]"), n = t.target.closest("[data-edit-depth]"), s = t.target.closest("[data-delete-depth]"), l = t.target.closest("[data-edit-truck]"), i = t.target.closest("[data-delete-truck]");
    e ? openSoilDialog(Number(e.dataset.editSoil)) : a ? removeRecord("soil", Number(a.dataset.deleteSoil)) : n ? openDepthDialog(Number(n.dataset.editDepth)) : s ? removeRecord("depth", Number(s.dataset.deleteDepth)) : l ? openTruckDialog(Number(l.dataset.editTruck)) : i && removeRecord("trucks", Number(i.dataset.deleteTruck));
  }), showTool("diaphragmWall");
}
// Publish gate (Studio layout.md measured-value inputs): every measured value in state, including rows
// whose dialog is closed. Main-form and depth/truck patterns are read from their inputs in index.html,
// rebar-cage ones from REBAR_CAGE_MEASURED_PATTERN, so each pattern has one copy.
function measuredValueErrors() {
  const t = [], e = (i) => $(`label[for="${i}"]`).firstChild.textContent.trim(), a = (i, c, g) => measuredMalformed(i, c) && t.push(g);
  [["f-design-depth", "designDepth"], ["f-thickness", "thickness"], ["f-length", "length"], ["f-top-elevation", "topElevation"], ["f-actual-volume", "actualVolume"]].forEach(([i, c]) => a(state.wall[c], $(`#${i}`).pattern, `壁體資訊：${e(i)}`));
  state.depth.forEach((i, c) => a(i.value, $("#depth-value").pattern, `開挖紀錄 第 ${c + 1} 次深度確認：${e("depth-value")}`));
  state.trucks.forEach((i, c) => [["truck-volume", "volume"], ["truck-measured", "measured"], ["truck-slump", "slump"]].forEach(([g, n]) => a(i[n], $(`#${g}`).pattern, `澆置紀錄 第 ${c + 1} 車：${e(g)}`)));
  state.rebarCage.parts.forEach((i) => {
    const c = `鋼筋籠 ${rebarCageDef(i.key).part}`;
    if (!i.intervals) return a(i.spacing, REBAR_CAGE_MEASURED_PATTERN, `${c}：間距`);
    i.intervals.forEach((g, n) => {
      const l = `${c} 深度區間 ${n + 1}`;
      a(g.top, REBAR_CAGE_MEASURED_PATTERN, `${l}：頂部（GL 以下）`), a(g.bottom, REBAR_CAGE_MEASURED_PATTERN, `${l}：底部（GL 以下）`), a(g.spacing, REBAR_CAGE_MEASURED_PATTERN, `${l}：間距`), g.extra.enabled && a(g.extra.spacing, REBAR_CAGE_MEASURED_PATTERN, `${l}：補強 間距`);
    });
  });
  return t;
}
function renderMeasuredErrors(t) {
  const e = $("#measured-errors");
  e.hidden = !t.length, e.innerHTML = t.length ? `<p>有 ${t.length} 個欄位格式錯誤，修正後才能發布：</p><ul>${t.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "", t.length && syncMeasuredErrors($("#project-tool"));
}
normalizeLoadedState({}), exampleMode && loadExample(), initialize();
window.continuousWallApp = { getState: () => structuredClone(state), loadState(value) {
  Object.assign(state, structuredClone(value)), normalizeLoadedState(value), setInitialInputs(), setChecklistInputs(), setQualityInputs(), renderPhaseEditor(), renderAll(), refreshRocDateHints();
}, newRecord: clearAllData, preparePrint, measuredValueErrors, renderMeasuredErrors };
