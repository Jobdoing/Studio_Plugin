import { createFiles } from "./documents.mjs";
import { chooseDocument, chooseLocation } from "./picker.mjs";

const files = createFiles(window.studio, chooseLocation, chooseDocument);
const extensions = {
  document: ["docx", "docm", "dotx", "dotm", "doc", "dot", "odt", "rtf", "txt", "md", "html", "htm", "tex", "json", "xml"],
  picture: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "wmf", "emf", "svg", "tif", "tiff", "jp2", "j2k", "jpx"],
  font: ["ttf", "otf", "ttc", "otc"],
  recipients: ["csv", "tsv", "xlsx"],
  pdf: ["pdf", "png", "jpg", "jpeg", "txt", "md", "html", "htm", "svg"],
  spreadsheet: ["xlsx", "xlsm", "xltx", "xltm", "xls", "xlsb", "ods", "csv", "tsv", "txt", "json", "scjson"],
  "pdf-document": ["pdf", "png", "jpg", "jpeg", "tif", "tiff", "gif", "bmp", "jp2", "j2k", "jpx", "txt", "text"],
  "pdf-only": ["pdf"],
  "pdf-data": ["xfdf", "fdf", "xml", "xdp", "csv", "txt", "pdf"],
  text: ["txt", "text"],
  presentation: ["pptx", "deckcraft", "slidecraft", "potx", "ppsx", "txt", "md"],
  "deck-theme": ["thmx", "pptx", "potx", "ppsx"],
  audio: ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "aif", "aiff"],
  video: ["mp4", "webm", "mov", "m4v"],
};
let active = false;
async function exclusively(fn) {
  if (active) throw new Error("FILE_DIALOG_IN_PROGRESS");
  active = true;
  try { return await fn(files); }
  catch (error) { if (error.message !== "CANCELLED") window.studio.notify(error.message); throw error; }
  finally { active = false; }
}

async function uploading(fn) {
  const progress = document.createElement("dialog");
  progress.textContent = "正在儲存檔案…";
  progress.oncancel = (event) => event.preventDefault();
  document.body.append(progress);
  progress.showModal();
  try { return await fn(); }
  finally { progress.remove(); }
}

window.studioCraftOpen = (purpose) => exclusively(async (io) => {
  const [kind, mode, document] = purpose.split(":");
  return io.open({ extensions: extensions[kind] || extensions.document, multiple: mode === "multiple", document: document === "document" });
});
window.studioCraftBind = (documentId, token) => files.bind(documentId, token);
window.studioCraftDiscard = (token) => { void files.discard(token).catch(() => {}); };
window.studioCraftForget = (ids) => { void files.forget(Array.from(ids)).catch(() => {}); };

window.studioCraftSave = (name, bytes, documentId, saveAs = true, copy = true) => {
  // Copy before awaiting a human: the source may be a view into reusable WASM memory.
  const snapshot = new Uint8Array(bytes).slice();
  return exclusively((io) => uploading(() => io.save({ documentId, name, bytes: snapshot, saveAs, copy })));
};

window.studioCraftDirty = (value) => { if (value || !active) files.changed(value); };

window.studioCraftSaveMany = (outputs) => {
  const snapshots = Array.from(outputs, ({name, bytes}) => ({name, bytes: new Uint8Array(bytes).slice()}));
  return exclusively(async (io) => {
    const names = snapshots.map(({name}) => name.trim().normalize("NFC").toLowerCase());
    if (new Set(names).size !== names.length) throw new Error("DUPLICATE_BATCH_FILENAME");
    let completed = 0;
    for (const file of snapshots) {
      try {
        await uploading(() => io.save({ ...file, copy: true, saveAs: true }));
        completed += 1;
      } catch (error) {
        throw new Error(`已儲存 ${completed} 個檔案，共 ${snapshots.length} 個：${error.message}`);
      }
    }
    window.studio.notify(`已儲存 ${completed} 個檔案`);
  });
};
window.studio.onCanClose(() => !active && files.canClose());

const credits = document.querySelector(".craft-credits");
if (credits) credits.onclick = async () => {
  const dialog = document.createElement("dialog");
  dialog.className = "craft-license-dialog";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "授權文件");
  for (const name of ["CREDITS.txt", "NOTICE", "LICENSE-MIT", "LICENSE-APACHE", "ATTRIBUTION.md", "licenses/rust/SOURCES.txt", "licenses/rust/inventory.json"]) select.add(new Option(name, name));
  const content = document.createElement("pre");
  const close = document.createElement("button");
  close.textContent = "關閉";
  close.onclick = () => dialog.close();
  let generation = 0;
  async function load() {
    const current = ++generation;
    try {
      const response = await fetch(select.value);
      if (!response.ok) throw new Error("LICENSE_LOAD_FAILED");
      const text = await response.text();
      if (current === generation) content.textContent = text;
    } catch (error) { if (current === generation) content.textContent = error.message; }
  }
  select.onchange = load;
  dialog.onclose = () => { generation += 1; dialog.remove(); };
  dialog.append(select, content, close);
  document.querySelector(".craft-editor").append(dialog);
  dialog.showModal();
  await load();
};
