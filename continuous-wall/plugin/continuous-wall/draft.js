function mergeStandardDefaults(e, r) {
  const a = Object.fromEntries(r.map((t) => [t.key, t.default]));
  return Object.entries(e || {}).forEach(([t, l]) => {
    Object.prototype.hasOwnProperty.call(a, t) && (a[t] = l);
  }), r.forEach((t) => {
    (t.legacy || []).includes(a[t.key]) && (a[t.key] = t.default);
  }), a;
}
function refreshCheckItems(e, r) {
  const a = new Map((Array.isArray(e) ? e : []).filter(Boolean).map((t) => [t.item, t]));
  return r.map((t) => {
    const l = a.get(t.item);
    if (!l) return t;
    const { item: n, standard: i, placeholder: s, ...o } = l;
    return { ...t, ...o };
  });
}
// The pre-Studio site kept drafts in localStorage under these unnamespaced keys. The server draft is
// the only copy now, so the leftovers are removed on every load (a no-op once they are gone).
function removeLegacyDrafts() {
  try {
    Object.keys(localStorage).filter((e) => e === "project-portal.diaphragmWall.draft" || e === "project-portal.diaphragmWallGc.draft" || /^project-portal\.plan\..+\.draft$/.test(e)).forEach((e) => localStorage.removeItem(e));
  } catch {
  }
}
removeLegacyDrafts();
