(function() {
  const w = 3.7795275590551185, v = { portrait: /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 ? 263 : 277, landscape: 190 }, P = 2;
  document.documentElement.style.setProperty("--print-page-height", `${v.portrait}mm`);
  function N(t) {
    const e = window.scrollY, o = [];
    for (const r of document.styleSheets) {
      let s;
      try {
        s = r.cssRules;
      } catch {
        continue;
      }
      for (const i of s) i instanceof CSSMediaRule && i.media.mediaText.trim() === "print" && (i.media.mediaText = "all", o.push(i));
    }
    try {
      return t();
    } finally {
      o.forEach((r) => {
        r.media.mediaText = "print";
      }), window.scrollTo(0, e);
    }
  }
  function b() {
    return getComputedStyle(document.body).getPropertyValue("--print-active").trim() === "1";
  }
  function A(t) {
    const e = t.dataset.printOrientation === "landscape" ? "landscape" : "portrait";
    return v[e] * w - P;
  }
  const u = (t, e) => t.getBoundingClientRect().height > e;
  function y(t) {
    return t.matches(".print-document-header");
  }
  function g(t, e, o, r) {
    const s = t.querySelectorAll("table.print-table"), i = s[s.length - 1], a = i && i.tBodies[0];
    if (!a || a.rows.length < 2) return C(t, e, o, r);
    const l = [];
    for (; a.rows.length > 1 && u(e, o); ) l.unshift(a.removeChild(a.rows[a.rows.length - 1]));
    if (u(e, o)) return l.forEach((c) => a.appendChild(c)), C(t, e, o, r);
    if (!l.length) return e;
    const d = i.closest(".print-section") || t, n = d.cloneNode(false), f = d.querySelector("h2");
    if (f) {
      const c = f.cloneNode(true);
      c.dataset.continued || (c.append("（續）"), c.dataset.continued = "1"), n.appendChild(c);
    }
    const p = i.cloneNode(false);
    i.tHead && p.appendChild(i.tHead.cloneNode(true));
    const h = document.createElement("tbody");
    l.forEach((c) => h.appendChild(c)), p.appendChild(h), n.appendChild(p);
    const m = r();
    return m.appendChild(n), u(m, o) ? g(n, m, o, r) : m;
  }
  function C(t, e, o, r) {
    if (![...e.children].filter((a) => a !== t && !y(a)).length) return e;
    const i = r();
    return i.appendChild(t), u(i, o) ? g(t, i, o, r) : i;
  }
  function E(t) {
    if (t.dataset.printOrientation !== "landscape") return t;
    let e = t.querySelector(":scope > .print-rotated");
    return e || (e = document.createElement("div"), e.className = "print-rotated", e.append(...t.childNodes), t.appendChild(e)), e;
  }
  function O(t) {
    const e = A(t), o = E(t), r = [...o.children].filter(y), s = o.querySelector(":scope > .print-footer"), i = [...o.children].filter((n) => !r.includes(n) && n !== s);
    i.forEach((n) => n.remove()), s && s.remove();
    const a = [t];
    t.dataset.measuring = "1";
    const l = () => {
      const n = document.createElement("article");
      n.className = t.className;
      for (const [p, h] of Object.entries(t.dataset)) n.dataset[p] = h;
      n.dataset.printContinuation = t.id || "page", a[a.length - 1].after(n), a.push(n);
      const f = E(n);
      return r.forEach((p) => f.appendChild(p.cloneNode(true))), f;
    };
    let d = o;
    for (const n of i) d.appendChild(n), u(d, e) && (d = g(n, d, e, l));
    s && (d.appendChild(s), u(d, e) && (s.remove(), d = l(), d.appendChild(s))), a.forEach((n) => {
      delete n.dataset.measuring, n.dataset.paginated = "1";
    });
  }
  function q() {
    document.querySelectorAll(".print-page[data-print-continuation]").forEach((t) => t.remove()), document.querySelectorAll(".print-page[data-paginated]").forEach((t) => {
      delete t.dataset.paginated;
    }), N(() => {
      b() && [...document.querySelectorAll(".print-page")].filter((t) => getComputedStyle(t).display !== "none").forEach(O);
    });
  }
  const x = (t) => String(t ?? "").trim(), B = () => '<footer class="print-footer"><div class="print-signature-grid" aria-label="簽名欄"><div><span>所長</span><span aria-hidden="true"></span></div><div><span>副所長</span><span aria-hidden="true"></span></div><div><span>擔當者</span><span aria-hidden="true"></span></div></div></footer>', S = (t, e = "") => String(t ?? "").trim().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-") || e;
  function M(t) {
    const e = document.title;
    document.title = t.filter(Boolean).map((o) => S(o)).filter(Boolean).join("_"), window.addEventListener("afterprint", () => {
      document.title = e;
    }, { once: true });
  }
  Object.assign(window, { paginatePrintReport: q, printText: x, printFooter: B, safeFilePart: S, setPrintDocumentTitle: M });
})();
