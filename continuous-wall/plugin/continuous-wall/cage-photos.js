const CAGE_PHOTO_LIMIT = 3, cagePhotoText = (e) => String(e ?? "").trim(), isCagePhotoData = (e) => typeof e == "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(e);
// Photo files live in studio.blob (design §3.2); the body keeps only { key, caption }. A key is
// rec-<record_id>-cage-<first 16 hex of the SHA-256 of the photo bytes>: inside the platform's blob key charset
// ^[A-Za-z0-9][A-Za-z0-9_-]*$ (no dot, so no file extension), and the rec-/-cage- frame never meets a reserved word
// or a .meta ending.
const CAGE_PHOTO_KEY = /^rec-[A-Za-z0-9_-]+-cage-[0-9a-f]{16}$/, isCagePhotoKey = (e) => typeof e == "string" && CAGE_PHOTO_KEY.test(e);
async function cagePhotoKey(recordId, blob) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  const key = `rec-${recordId}-cage-${[...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (!isCagePhotoKey(key)) throw new Error("INVALID_KEY");
  return key;
}
// Photos uploaded in this tab show from their own bytes: offline, the upload is still queued and the server has no
// file yet (design §3.2). Every other photo shows from the blob store.
// NOTE(ceiling): these object URLs are never revoked, so each photo uploaded in this tab keeps its compressed bytes
// (a few hundred KB) in memory until the tab closes. Upgrade path: revoke a key's URL once the page no longer shows
// it (record left, photo deleted and not undone) or once blob.url can serve it after the queued upload has synced.
const cagePhotoLocalUrls = new Map();
const cagePhotoSrc = (key) => cagePhotoLocalUrls.get(key) || window.studio.blob.url(key);
function normalizeCagePhotos(e) {
  return (Array.isArray(e) ? e : []).filter((t) => t && isCagePhotoKey(t.key)).slice(0, 3).map((t) => ({ key: t.key, caption: cagePhotoText(t.caption) }));
}
function cagePhotoDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result), reader.onerror = () => reject(reader.error), reader.readAsDataURL(blob);
  });
}
// The JSON file keeps 1.2.x's image_data_url: every photo is read back from the blob store.
async function exportCagePhotos(e) {
  return Promise.all((e || []).map(async (t, o) => {
    let blob;
    try {
      blob = await window.studio.blob.get(t.key);
    } catch (error) {
      throw error.message === "OFFLINE" ? new Error("離線時無法匯出含照片的檔案，請恢復連線後再試。") : error;
    }
    if (!blob) throw new Error(`第 ${o + 1} 張照片檔案讀取不到，無法匯出。`);
    return { no: o + 1, caption: t.caption || null, image_data_url: await cagePhotoDataUrl(blob) };
  }));
}
// Imported photos are checked whole (isCagePhotoData), then compressed and uploaded like a picked photo once the
// record exists (app.js importPhotos).
const importCagePhotos = (e) => (Array.isArray(e) ? e : []).map((t) => ({ data: t?.image_data_url ?? t?.data, caption: cagePhotoText(t?.caption) })).filter((t) => isCagePhotoData(t.data)).slice(0, 3);
function cagePhotoBlob(dataUrl) {
  const [head, base64] = dataUrl.split(","), bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: head.slice(5, head.indexOf(";")) });
}
const CAGE_PHOTO_SWITCHED = "已切換到其他紀錄，照片沒有加入。";
// Adds one photo (a studio.image.compress output) to the record on screen (design §4.5): a new form is stored first
// (the key names its record), the file is uploaded, and only then does its key enter the body; the caller renders
// and schedules the usual autosave. A photo that cannot be added rejects with the Chinese reason (no project, read
// only, another record opened meanwhile, already 3 photos).
async function addCagePhoto(getPhotos, blob, caption) {
  const bridge = window.continuousWallBridge, recordId = await bridge.photoRecordId();
  if (!recordId) throw new Error(CAGE_PHOTO_SWITCHED);
  const key = await cagePhotoKey(recordId, blob);
  await window.studio.blob.put(key, blob, { contentType: "image/jpeg" });
  // NOTE(ceiling): the file is already uploaded here, so both refusals below leave a blob no body refers to (an orphan
  // counted in the plugin's 2 GiB). Upgrade path: platform gap e (blob cleanup tied to records) or an orphan purge
  // that also reads published bodies and history (gap j); the plugin does not remove it itself.
  if (bridge.editingRecordId() !== recordId) throw new Error(CAGE_PHOTO_SWITCHED);
  if (getPhotos().length >= 3) throw new Error("照片最多 3 張，這張沒有加入。");
  cagePhotoLocalUrls.has(key) || cagePhotoLocalUrls.set(key, URL.createObjectURL(blob));
  getPhotos().push({ key, caption });
  return true;
}
const CAGE_PHOTO_TRASH_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>', CAGE_PHOTO_UPLOAD_SVG = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5-8 8"/><path d="M14 13l-4 4"/></svg>';
function cagePhotosHtml(e) {
  return `<div class="kit-photo-grid">${e.length ? e.map((t, o) => `
    <figure class="kit-photo photo-item">
      <div class="photo-item-wrap">
        <button class="photo-item-image" type="button" data-photo-caption="${o}" aria-label="第 ${o + 1} 張照片，點擊補備註"><img src="${escapeHtml(cagePhotoSrc(t.key))}" alt="鋼筋籠照片 ${o + 1}" /></button>
        <button class="kit-button kit-button--secondary two-step-delete photo-delete" type="button" data-photo-remove="${o}" aria-label="刪除照片"><span class="two-step-x" aria-hidden="true">×</span>${CAGE_PHOTO_TRASH_SVG}</button>
      </div>
      <figcaption><span class="photo-no">${o + 1}</span><span class="photo-caption ${t.caption ? "" : "is-empty"}">${escapeHtml(t.caption) || "點照片補備註"}</span></figcaption>
    </figure>`).join("") : `<button class="kit-upload" type="button" data-photo-pick>${CAGE_PHOTO_UPLOAD_SVG}<strong>匯入照片</strong><span>點擊從相簿匯入照片（最多 3 張）</span></button>`}</div>`;
}
function cagePhotosPrintHtml(e) {
  return `<section class="print-section print-photo-section"><h2>鋼筋籠照片</h2><div class="print-photo-grid">${Array.from({ length: 3 }, (o, a) => {
    const n = e[a], c = n ? `${n.caption ? `<strong class="print-photo-caption">${escapeHtml(n.caption)}</strong>` : ""}<div class="print-photo-image"><img src="${escapeHtml(window.studio.blob.url(n.key))}" alt="鋼筋籠照片 ${a + 1}" /></div>` : "";
    return `<div class="print-photo-no">${a + 1}</div><div class="print-photo-cell">${c}</div>`;
  }).join("")}</div></section>`;
}
function renderCagePhotos(e) {
  const t = document.querySelector("#cage-photo-list"), o = document.querySelector("#cage-photo-add");
  t && (t.innerHTML = cagePhotosHtml(e)), o && (o.disabled = e.length >= 3);
}
function bindCagePhotosUi({ getPhotos: e, onChange: t }) {
  const o = document.querySelector("#cage-photo-list"), a = document.querySelector("#cage-photo-input"), n = document.querySelector("#cage-photo-add"), c = document.querySelector("#cage-photo-dialog"), h = document.querySelector("#cage-photo-caption"), g = document.querySelector("#cage-photo-preview");
  if (!o || !a) return;
  let d = null, s = null;
  const u = () => {
    s && (clearTimeout(s.timer), s.button.classList.remove("is-armed", "kit-button--danger"), s.button.setAttribute("aria-label", "刪除照片"), s = null);
  }, m = () => {
    e().length >= 3 || o.getAttribute("aria-busy") === "true" || (a.value = "", a.click());
  };
  a.addEventListener("change", async () => {
    const r = [...a.files].slice(0, Math.max(0, 3 - e().length));
    if (!r.length) return;
    o.insertAdjacentHTML("beforebegin", loadingHtml("照片處理中…"));
    const i = o.previousElementSibling;
    o.setAttribute("aria-busy", "true"), n && (n.disabled = true);
    try {
      for (const p of r) try {
        await addCagePhoto(e, await window.studio.image.compress(p), "");
      } catch (error) {
        window.continuousWallBridge.fail(error);
      }
    } finally {
      // Compression is async; if it outlasts the autosave debounce (studio-bridge.js), the debounce
      // timer set by the file input's own "change" event can already have fired and saved a draft
      // without the new photo. Schedule again now that the state actually holds it (same explicit-save
      // pattern as the undo path in app.js, where no fresh DOM event follows the state change).
      i.remove(), o.removeAttribute("aria-busy"), a.value = "", t(), window.continuousWallBridge.scheduleDraft();
    }
  }), n?.addEventListener("click", m), o.addEventListener("click", (r) => {
    const i = r.target.closest("[data-photo-remove]"), p = r.target.closest("[data-photo-caption]");
    if (r.target.closest("[data-photo-pick]")) {
      m();
      return;
    }
    if (i) {
      if (s?.button === i) {
        const l = Number(i.dataset.photoRemove);
        u(), e().splice(l, 1), t();
        return;
      }
      u(), i.classList.add("is-armed", "kit-button--danger"), i.setAttribute("aria-label", "再點一次確認刪除"), s = { button: i, timer: setTimeout(u, 4e3) };
      return;
    }
    if (p && c) {
      d = Number(p.dataset.photoCaption);
      const l = e()[d];
      if (!l) return;
      g && (g.src = cagePhotoSrc(l.key)), h.value = l.caption, c.showModal(), h.focus();
    }
  }), document.addEventListener("click", (r) => {
    s && !r.target.closest("[data-photo-remove]") && u();
  }), c?.querySelector("form")?.addEventListener("submit", (r) => {
    r.preventDefault();
    const i = d === null ? null : e()[d];
    i && (i.caption = cagePhotoText(h.value)), d = null, c.close(), t();
  });
}
