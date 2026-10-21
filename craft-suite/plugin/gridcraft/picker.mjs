export async function chooseLocation(saving) {
  const dialog = document.createElement("dialog");
  dialog.className = "kit-dialog";
  const title = document.createElement("h2");
  title.textContent = saving ? "Save file" : "Open file";
  const local = document.createElement("button");
  local.textContent = "This computer";
  const documents = document.createElement("button");
  documents.textContent = "Studio documents";
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
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
  title.textContent = saveName ? "Save to Studio documents" : "Open Studio document";
  const folder = document.createElement("select");
  folder.setAttribute("aria-label", "Document folder");
  const folders = saveName ? tree.folders : [{ folder_id: tree.root_id, name: "Project documents" }, ...tree.folders];
  for (const entry of folders) {
    const option = new Option(entry.name, entry.folder_id);
    option.disabled = Boolean(saveName && !["Manager", "Editor"].includes(entry.effective));
    folder.add(option);
  }
  if (destination) folder.value = destination.folder_id;
  const files = document.createElement("select");
  files.size = 8;
  files.multiple = multiple;
  files.setAttribute("aria-label", "Document");
  const name = document.createElement("input");
  name.value = saveName || "";
  name.setAttribute("aria-label", "Filename");
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  const accept = document.createElement("button");
  accept.type = "submit";
  accept.textContent = saveName ? "Save" : "Open";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
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
        if (saveName && !name.value.trim()) { error.textContent = "Filename is required"; return; }
        if (saveName) {
          const extension = saveName.match(/\.[^.]+$/)?.[0];
          if (extension && !name.value.trim().toLowerCase().endsWith(extension.toLowerCase())) {
            error.textContent = `Keep the ${extension} extension to match the saved format`;
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
