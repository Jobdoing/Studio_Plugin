export async function chooseLocation(saving) {
  const dialog = document.createElement("dialog");
  dialog.className = "kit-dialog";
  const title = document.createElement("h2");
  title.textContent = saving ? "儲存檔案" : "開啟檔案";
  const local = document.createElement("button");
  local.textContent = "這部電腦";
  const documents = document.createElement("button");
  documents.textContent = "Studio 文件中心";
  const cancel = document.createElement("button");
  cancel.textContent = "取消";
  dialog.append(title, local, documents, cancel);
  document.body.append(dialog);
  try {
    return await new Promise((resolve) => {
      local.onclick = () => resolve("local");
      documents.onclick = () => resolve("docs");
      cancel.onclick = () => dialog.close();
      dialog.onclose = () => resolve(null);
      dialog.showModal();
    });
  } finally { dialog.remove(); }
}

// Document-center selection continues through the authorized SDK.
export async function chooseDocument(io, { saveName, extensions = [], multiple = false } = {}) {
  const destination = saveName ? await io.saveFolder() : null;
  const tree = await io.tree();
  const dialog = document.createElement("dialog");
  const form = document.createElement("form");
  form.method = "dialog";
  const title = document.createElement("h2");
  title.textContent = saveName ? "儲存至 Studio 文件中心" : "開啟 Studio 文件";
  const folder = document.createElement("select");
  folder.setAttribute("aria-label", "文件資料夾");
  const folders = saveName ? tree.folders : [{ folder_id: tree.root_id, name: "案場文件" }, ...tree.folders];
  for (const entry of folders) {
    const option = new Option(entry.name, entry.folder_id);
    option.disabled = Boolean(saveName && !["Manager", "Editor"].includes(entry.effective));
    folder.add(option);
  }
  if (destination) folder.value = destination.folder_id;
  const files = document.createElement("select");
  files.size = 8;
  files.multiple = multiple;
  files.setAttribute("aria-label", "文件");
  const name = document.createElement("input");
  name.value = saveName || "";
  name.setAttribute("aria-label", "檔案名稱");
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  const accept = document.createElement("button");
  accept.type = "submit";
  accept.textContent = saveName ? "儲存" : "開啟";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "取消";
  let generation = 0;
  let selected = [];
  async function list() {
    const current = ++generation;
    accept.disabled = true;
    files.replaceChildren();
    error.textContent = "";
    try {
      const rows = await io.list(folder.value);
      if (current !== generation) return;
      selected = rows.filter((file) => !extensions.length || extensions.includes(file.extension.toLowerCase().replace(/^\./, "")));
      for (const file of selected) files.add(new Option(file.filename, file.file_id));
      accept.disabled = !saveName && !selected.length;
    } catch (err) {
      if (current === generation) error.textContent = err.message;
    }
  }
  folder.onchange = list;
  form.append(title, folder, saveName ? name : files, error, accept, cancel);
  dialog.append(form);
  document.body.append(dialog);
  try {
    return await new Promise((resolve) => {
      cancel.onclick = () => dialog.close();
      dialog.onclose = () => resolve(null);
      form.onsubmit = (event) => {
        event.preventDefault();
        if (saveName && !name.value.trim()) { error.textContent = "請輸入檔案名稱"; return; }
        if (saveName) {
          const extension = saveName.match(/\.[^.]+$/)?.[0];
          if (extension && !name.value.trim().toLowerCase().endsWith(extension.toLowerCase())) {
            error.textContent = `請保留 ${extension} 副檔名，以符合儲存格式`;
            return;
          }
        }
        const ids = new Set(Array.from(files.selectedOptions, (option) => option.value));
        const result = saveName ? { folderId: folder.value, name: name.value.trim() } : multiple ? selected.filter((file) => ids.has(file.file_id)) : selected.find((file) => file.file_id === files.value);
        if (result) resolve(result);
      };
      dialog.showModal();
      void list();
    });
  } finally {
    generation += 1;
    dialog.remove();
  }
}
