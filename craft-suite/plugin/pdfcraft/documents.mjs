// Document-center access is created only when that destination is selected.
export async function createDocuments(studio, manageDirty = true) {
  const project = await studio.project();
  if (!project?.project_handle) throw new Error("PROJECT_REQUIRED");
  const opts = { project_handle: project.project_handle };
  let invalidated = false;
  let saving = false;
  let dirty = false;
  const stop = studio.onProjectChange((next) => {
    if (next?.project_handle !== opts.project_handle) { invalidated = true; stop(); }
  });
  function check() {
    if (invalidated) throw new Error("PROJECT_CHANGED");
  }
  function changed() {
    if (dirty) return;
    dirty = true;
    studio.dirty(true);
  }
  return {
    dispose: stop,
    changed,
    markClean() {
      if (saving || !dirty) return;
      dirty = false;
      studio.dirty(false);
    },
    canClose: () => !dirty && !saving,
    async saveFolder() {
      check();
      const result = await studio.docs.pluginFolder(opts);
      check();
      return result;
    },
    async tree() {
      check();
      const result = await studio.docs.tree(opts);
      check();
      return result;
    },
    async list(folderId) {
      check();
      const result = await studio.docs.list(folderId, opts);
      check();
      return result;
    },
    async open(fileId) {
      check();
      const file = await studio.docs.get(fileId, opts);
      check();
      if (!file) throw new Error("NOT_FOUND");
      // Pin the bytes to the metadata version, not a potentially newer current version.
      const blob = await studio.docs.fetch(fileId, { version: file.version }, opts);
      check();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      check();
      return { file, name: file.filename, bytes };
    },
    async saveMany({ folderId, files }) {
      const names = files.map(({ name }) => name.trim().normalize("NFC").toLowerCase());
      if (new Set(names).size !== files.length) throw new Error("DUPLICATE_BATCH_FILENAME");
      let completed = 0;
      for (const file of files) {
        try {
          await this.save({ ...file, folderId });
          completed += 1;
        } catch (error) {
          throw new Error(`Saved ${completed} of ${files.length} files: ${error.message}`);
        }
      }
      return completed;
    },
    async save({ folderId, name, bytes, type = "application/octet-stream", serialNumber, expectedFile }) {
      check();
      if (saving) throw new Error("SAVE_IN_PROGRESS");
      if (typeof name !== "string" || !name.trim() || /[\\/\u0000]/.test(name)) throw new Error("INVALID_NAME");
      if (!(bytes instanceof Uint8Array)) throw new Error("INVALID_BYTES");
      saving = true;
      if (manageDirty) changed();
      const file = new File([bytes.slice()], name, { type });
      try {
        if (expectedFile) {
          const current = await studio.docs.get(expectedFile.file_id, opts);
          check();
          if (!current || !folderId || !Number.isInteger(expectedFile.version) || current.file_id !== expectedFile.file_id || current.folder_id !== folderId || current.filename !== name || current.version !== expectedFile.version) throw new Error("DOCUMENT_SOURCE_CHANGED");
        }
        // NOTE(ceiling): Upload targets a folder/name after this preflight; atomic identity/version protection needs a platform CAS API.
        const input = { folder_id: folderId, file };
        if (serialNumber !== undefined) input.serial_number = serialNumber;
        const result = await studio.docs.upload(input, opts);
        check();
        return result;
      } finally {
        saving = false;
      }
    },
  };
}

// Editor document IDs own bindings; filenames never identify a document or handle.
export function createFiles(studio, chooseLocation, chooseDocument) {
  let documents;
  let next = 0;
  let dirty = false;
  let liveDocuments;
  const sources = new Map();
  const bindings = new Map();
  studio.onProjectChange(() => {
    documents = undefined;
  });
  const docs = () => documents ||= createDocuments(studio, false);
  function remember(source) {
    const token = String(++next);
    sources.set(token, source);
    return token;
  }
  async function release(source) {
    if (source?.kind === "local") await studio.files.release(source.id);
  }
  function saved(result) {
    if (result?.status !== "saved" || typeof result.id !== "string" || !result.filename) throw new Error("SAVE_NOT_CONFIRMED");
    return result;
  }
  const extension = (name) => name.match(/\.[^.]+$/)?.[0].toLowerCase();
  return {
    changed(value) {
      if (dirty === value) return;
      dirty = value;
      studio.dirty(value);
    },
    canClose: () => !dirty,
    async open({ extensions, multiple = false, document = false }) {
      const location = await chooseLocation(false);
      if (!location) return null;
      let entries;
      if (location === "local") {
        const file = await studio.files.open({ extensions: extensions.map((value) => `.${value}`) });
        if (!file) return null;
        entries = [{ name: file.filename, bytes: new Uint8Array(file.content), source: { kind: "local", id: file.id, filename: file.filename } }];
      } else {
        const io = await docs();
        const picked = await chooseDocument(io, { extensions, multiple });
        if (!picked) return null;
        entries = [];
        for (const file of multiple ? picked : [picked]) {
          const opened = await io.open(file.file_id);
          entries.push({ ...opened, source: { kind: "docs", io, ...opened.file } });
        }
      }
      for (const entry of entries) {
        if (document) entry.sourceToken = remember(entry.source);
        else await release(entry.source);
        delete entry.source;
      }
      return multiple ? entries : entries[0];
    },
    bind(documentId, token) {
      const source = sources.get(token);
      if (!source) throw new Error("FILE_SOURCE_EXPIRED");
      sources.delete(token);
      const old = bindings.get(documentId);
      bindings.set(documentId, source);
      void release(old).catch(() => {});
    },
    async save({ documentId, name, bytes, saveAs = false, copy = false }) {
      const snapshot = new Uint8Array(bytes).slice();
      const old = bindings.get(documentId);
      const inPlace = !saveAs && !copy && old && extension(old.filename) === extension(name);
      let source;
      let receipt;
      if (inPlace && old.kind === "local") {
        receipt = saved(await studio.files.save(old.id, snapshot));
        source = { kind: "local", id: receipt.id, filename: receipt.filename };
      } else if (inPlace) {
        const result = await old.io.save({ folderId: old.folder_id, name: old.filename, bytes: snapshot, serialNumber: old.serial_number, expectedFile: old });
        if (!result?.filename || result.file_id !== old.file_id || !Number.isInteger(result.version)) throw new Error("SAVE_NOT_CONFIRMED");
        source = { ...old, ...result };
        receipt = { filename: result.filename, status: "saved" };
      } else {
        const location = await chooseLocation(true);
        if (!location) throw new Error("CANCELLED");
        if (location === "local") {
          const result = await studio.files.saveAs(name, snapshot);
          if (!result) throw new Error("CANCELLED");
          receipt = saved(result);
          source = { kind: "local", id: receipt.id, filename: receipt.filename };
        } else {
          const io = await docs();
          const destination = await chooseDocument(io, { saveName: name });
          if (!destination) throw new Error("CANCELLED");
          const result = await io.save({ ...destination, bytes: snapshot });
          if (!result?.filename || !result.file_id || !Number.isInteger(result.version)) throw new Error("SAVE_NOT_CONFIRMED");
          source = { kind: "docs", io, ...result, folder_id: destination.folderId };
          receipt = { filename: result.filename, status: "saved" };
        }
      }
      if (extension(receipt.filename) !== extension(name)) {
        void release(source).catch(() => {});
        throw new Error("Saved copy has a different extension; the source remains unsaved.");
      }
      if (!copy && documentId !== undefined && (!liveDocuments || liveDocuments.has(documentId))) {
        bindings.set(documentId, source);
        if (old !== source && old?.id !== source.id) void release(old).catch(() => {});
      } else void release(source).catch(() => {});
      return receipt;
    },
    async discard(token) {
      const source = sources.get(token);
      sources.delete(token);
      await release(source);
    },
    async forget(documentIds) {
      const retained = liveDocuments = new Set(documentIds);
      for (const [id, source] of bindings) {
        if (!retained.has(id)) {
          bindings.delete(id);
          await release(source);
        }
      }
    },
  };
}
