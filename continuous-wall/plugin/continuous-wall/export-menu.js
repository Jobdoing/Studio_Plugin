(() => {
  const e = document.querySelector("#export-fab");
  if (!e) return;
  const r = e.querySelector("#export-button"), c = (t) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`, u = '<path d="M8 4H7a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1"/>', h = { "pdf-current": { label: "單頁", aria: "輸出目前表單 PDF", icon: c('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>') }, "pdf-all": { label: "整份", aria: "輸出完整紀錄 PDF", icon: c('<path d="M9 6V5a2 2 0 0 1 2-2h5l4 4v10a2 2 0 0 1-2 2h-1"/><path d="M4 9a2 2 0 0 1 2-2h5l4 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>') }, json: { label: "匯出", aria: "匯出 JSON 資料檔", icon: c(`${u}<path d="M12 8v8"/><path d="M9 13l3 3 3-3"/>`) }, import: { label: "匯入", aria: "匯入 JSON 資料檔", id: "import-json-button", icon: c(`${u}<path d="M12 16V8"/><path d="M9 11l3-3 3 3"/>`) } }, l = (e.dataset.exportItems || "").split(/\s+/).filter((t) => h[t]), b = l.length > 3 ? 128 : 96, s = document.createElement("div");
  s.className = "export-fab-items", s.id = "export-fab-items";
  const n = document.createElement("div");
  n.className = "export-fab-goo", n.setAttribute("aria-hidden", "true"), n.append(Object.assign(document.createElement("span"), { className: "export-fab-blob is-main" }));
  const f = l.map((t, p) => {
    const i = h[t], m = Math.PI - Math.PI / 2 * (l.length === 1 ? 0 : p / (l.length - 1)), x = { "--x": `${Math.round(Math.cos(m) * b)}px`, "--y": `${Math.round(-Math.sin(m) * b)}px`, "--i": String(p) }, a = document.createElement("button");
    a.type = "button", a.className = "export-fab-item", a.setAttribute("aria-label", i.aria), i.id ? a.id = i.id : a.dataset.exportFormat = t, a.innerHTML = `${i.icon}<span>${i.label}</span>`;
    const g = Object.assign(document.createElement("span"), { className: "export-fab-blob" });
    return Object.entries(x).forEach(([v, M]) => {
      a.style.setProperty(v, M), g.style.setProperty(v, M);
    }), n.append(g), s.append(a), a;
  }), d = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  d.setAttribute("class", "export-fab-defs"), d.setAttribute("aria-hidden", "true"), d.innerHTML = `<defs><filter id="export-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
    <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
    <feComposite in="SourceGraphic" in2="goo" operator="atop" /></filter></defs>`, e.prepend(d, n, s), r.setAttribute("aria-controls", s.id);
  const o = (t, p = false) => {
    e.classList.toggle("is-open", t), r.setAttribute("aria-expanded", String(t)), s.inert = !t, t && p && f[0]?.focus({ preventScroll: true });
  };
  o(false), r.addEventListener("click", (t) => o(!e.classList.contains("is-open"), t.detail === 0)), f.forEach((t) => t.addEventListener("click", () => o(false))), document.addEventListener("pointerdown", (t) => {
    e.classList.contains("is-open") && !e.contains(t.target) && o(false);
  }), document.addEventListener("keydown", (t) => {
    t.key !== "Escape" || !e.classList.contains("is-open") || (o(false), r.focus());
  });
})();
