import test from "node:test";
import assert from "node:assert/strict";
import { createFiles } from "../src/documents.mjs";

function fixture() {
  const calls = [];
  const locations = [];
  const documents = [];
  let counter = 0;
  let changed;
  const studio = {
    project: async () => { calls.push(["project"]); return null; },
    onProjectChange: (fn) => { changed = fn; return () => {}; },
    dirty: (value) => calls.push(["dirty", value]),
    files: {
      open: async () => ({ id: `handle-${++counter}`, filename: "same.docx", content: new Uint8Array([counter]).buffer }),
      save: async (id, bytes) => { calls.push(["save", id, [...bytes]]); return { id, filename: "same.docx", status: "saved" }; },
      saveAs: async (filename, bytes) => { calls.push(["saveAs", filename, [...bytes]]); return { id: `handle-${++counter}`, filename, status: "saved" }; },
      release: async (id) => calls.push(["release", id]),
    },
  };
  const io = createFiles(studio, async () => locations.shift(), async () => documents.shift());
  return { io, studio, calls, locations, documents, switchProject: () => changed?.(null) };
}

test("local open/save works without a project and same filenames keep independent handles", async () => {
  const f = fixture();
  for (const id of ["doc-a", "doc-b"]) {
    f.locations.push("local");
    const file = await f.io.open({ extensions: ["docx"], document: true });
    f.io.bind(id, file.sourceToken);
  }
  await f.io.save({ documentId: "doc-a", name: "same.docx", bytes: new Uint8Array([9]) });
  await f.io.save({ documentId: "doc-b", name: "same.docx", bytes: new Uint8Array([8]) });
  assert.deepEqual(f.calls, [["save", "handle-1", [9]], ["save", "handle-2", [8]]]);
});

test("cancelled or failed Save As keeps the old binding and dirty state", async () => {
  for (const cancel of [true, false]) {
    const f = fixture();
    f.locations.push("local", "local");
    const file = await f.io.open({ extensions: ["docx"], document: true });
    f.io.bind("doc", file.sourceToken);
    f.io.changed(true);
    f.studio.files.saveAs = async () => { if (cancel) return null; throw new Error("DISK_FULL"); };
    await assert.rejects(f.io.save({ documentId: "doc", name: "new.docx", bytes: new Uint8Array([4]), saveAs: true }), cancel ? /CANCELLED/ : /DISK_FULL/);
    await f.io.save({ documentId: "doc", name: "same.docx", bytes: new Uint8Array([5]) });
    assert.ok(f.calls.some(([op, id]) => op === "save" && id === "handle-1"));
    assert.equal(f.io.canClose(), false);
    assert.ok(!f.calls.some(([op, value]) => op === "dirty" && value === false));
  }
});

test("Save As replaces its binding only after a confirmed receipt", async () => {
  const f = fixture();
  f.locations.push("local", "local");
  const file = await f.io.open({ extensions: ["docx"], document: true });
  f.io.bind("doc", file.sourceToken);
  await f.io.save({ documentId: "doc", name: "new.docx", bytes: new Uint8Array([3]), saveAs: true });
  await f.io.save({ documentId: "doc", name: "new.docx", bytes: new Uint8Array([4]) });
  assert.ok(f.calls.some(([op, id]) => op === "release" && id === "handle-1"));
  assert.ok(f.calls.some(([op, id]) => op === "save" && id === "handle-2"));
});

test("download initiation, unsupported browser and write failures cannot acknowledge a save", async () => {
  for (const outcome of [undefined, { filename: "new.docx" }, { id: "x", filename: "new.docx", status: "dispatched" }]) {
    const f = fixture();
    f.locations.push("local");
    f.studio.files.saveAs = async () => outcome;
    await assert.rejects(f.io.save({ documentId: "doc", name: "new.docx", bytes: new Uint8Array([3]) }));
  }
  const f = fixture();
  f.locations.push("local");
  f.studio.files.saveAs = async () => { throw new Error("UNSUPPORTED"); };
  await assert.rejects(f.io.save({ documentId: "doc", name: "new.docx", bytes: new Uint8Array([3]) }), /UNSUPPORTED/);
});

test("exports do not replace a source and format changes never overwrite the original", async () => {
  const f = fixture();
  f.locations.push("local", "local", "local");
  const file = await f.io.open({ extensions: ["docx"], document: true });
  f.io.bind("doc", file.sourceToken);
  await f.io.save({ documentId: "doc", name: "copy.pdf", bytes: new Uint8Array([3]), copy: true });
  await f.io.save({ documentId: "doc", name: "same.docx", bytes: new Uint8Array([4]) });
  await f.io.save({ documentId: "doc", name: "other.pdf", bytes: new Uint8Array([5]) });
  assert.deepEqual(f.calls.filter(([op]) => op === "saveAs").map(([, name]) => name), ["copy.pdf", "other.pdf"]);
  assert.ok(f.calls.some(([op, id]) => op === "save" && id === "handle-1"));
});

test("a mismatched saved extension cannot acknowledge or replace the document source", async () => {
  const f = fixture();
  f.locations.push("local", "local");
  const file = await f.io.open({ extensions: ["docx"], document: true });
  f.io.bind("doc", file.sourceToken);
  f.studio.files.saveAs = async () => ({ id: "wrong", filename: "wrong.txt", status: "saved" });
  await assert.rejects(f.io.save({ documentId: "doc", name: "new.docx", bytes: new Uint8Array([1]), saveAs: true }), /different extension/);
  await f.io.save({ documentId: "doc", name: "same.docx", bytes: new Uint8Array([2]) });
  assert.ok(f.calls.some(([op, id]) => op === "save" && id === "handle-1"));
  assert.ok(f.calls.some(([op, id]) => op === "release" && id === "wrong"));
});

test("asset imports and closed documents release their local handles", async () => {
  const f = fixture();
  f.locations.push("local", "local");
  await f.io.open({ extensions: ["png"] });
  const file = await f.io.open({ extensions: ["docx"], document: true });
  f.io.bind("closed", file.sourceToken);
  await f.io.forget([]);
  assert.deepEqual(f.calls, [["release", "handle-1"], ["release", "handle-2"]]);
});

test("a save finishing after its document closes cannot retain or resurrect a binding", async () => {
  const f = fixture();
  f.locations.push("local");
  await f.io.forget(["doc"]);
  let finish;
  f.studio.files.saveAs = () => new Promise((resolve) => { finish = resolve; });
  const pending = f.io.save({ documentId: "doc", name: "closed.docx", bytes: new Uint8Array([1]), saveAs: true });
  await Promise.resolve();
  await f.io.forget([]);
  finish({ id: "late", filename: "closed.docx", status: "saved" });
  await pending;
  assert.ok(f.calls.some(([op, id]) => op === "release" && id === "late"));
});

test("a rejected document admission releases its pending source token", async () => {
  const f = fixture();
  f.locations.push("local");
  const file = await f.io.open({ extensions: ["pdf"], document: true });
  await f.io.discard(file.sourceToken);
  assert.throws(() => f.io.bind("doc", file.sourceToken), /FILE_SOURCE_EXPIRED/);
  assert.deepEqual(f.calls, [["release", "handle-1"]]);
});

test("same-named documents in different folders retain independent document-center identities", async () => {
  const f = fixture();
  f.studio.project = async () => ({ project_handle: "project-a" });
  const stored = new Map(["a", "b"].map(id => [id, { file_id: id, folder_id: `folder-${id}`, filename: "same.docx", version: 1, text: `original-${id}` }]));
  f.studio.docs = {
    get: async id => ({ ...stored.get(id) }),
    fetch: async id => new Blob([stored.get(id).text]),
    upload: async ({ folder_id, file }) => {
      const entry = [...stored.values()].find(item => item.folder_id === folder_id && item.filename === file.name);
      assert.ok(entry, "upload must target an existing independent source");
      entry.text = await file.text();
      entry.version += 1;
      return { ...entry };
    },
  };
  for (const id of ["a", "b"]) {
    f.locations.push("docs");
    f.documents.push({ file_id: id });
    const opened = await f.io.open({ extensions: ["docx"], document: true });
    f.io.bind(`doc-${id}`, opened.sourceToken);
  }
  await f.io.save({ documentId: "doc-b", name: "same.docx", bytes: new TextEncoder().encode("edited-b") });
  assert.equal(stored.get("a").text, "original-a");
  assert.equal(stored.get("a").version, 1);
  assert.equal(stored.get("b").text, "edited-b");
  assert.equal(stored.get("b").version, 2);
  await f.io.save({ documentId: "doc-a", name: "same.docx", bytes: new TextEncoder().encode("edited-a") });
  assert.equal(stored.get("a").text, "edited-a");
  assert.equal(stored.get("b").text, "edited-b");
});

test("document-center Save refuses a replaced or changed source before uploading", async () => {
  for (const change of ["moved", "renamed", "deleted", "updated", "missing-folder"]) {
    const f = fixture();
    f.studio.project = async () => ({ project_handle: "project-a" });
    let original = { file_id: "original", folder_id: "folder", filename: "same.docx", version: 2 };
    let replacement = "unrelated content";
    let uploads = 0;
    f.studio.docs = {
      get: async () => original && { ...original },
      fetch: async () => new Blob(["original content"]),
      upload: async ({ file }) => { uploads += 1; replacement = await file.text(); return { file_id: "replacement", filename: file.name, version: 1 }; },
    };
    f.locations.push("docs");
    f.documents.push({ file_id: "original" });
    const opened = await f.io.open({ extensions: ["docx"], document: true });
    f.io.bind("doc", opened.sourceToken);
    f.io.changed(true);
    if (change === "moved") original.folder_id = "elsewhere";
    if (change === "renamed") original.filename = "renamed.docx";
    if (change === "deleted") original = null;
    if (change === "updated") original.version += 1;
    if (change === "missing-folder") delete original.folder_id;
    await assert.rejects(f.io.save({ documentId: "doc", name: "same.docx", bytes: new TextEncoder().encode("edited source") }), /DOCUMENT_SOURCE_CHANGED/, change);
    assert.equal(uploads, 0, change);
    assert.equal(replacement, "unrelated content", change);
    assert.equal(f.io.canClose(), false, change);
  }
});

test("a different upload receipt cannot acknowledge or replace the original document binding", async () => {
  const f = fixture();
  f.studio.project = async () => ({ project_handle: "project-a" });
  const original = { file_id: "original", folder_id: "folder", filename: "same.docx", version: 2 };
  let receiptId = "replacement";
  const requested = [];
  f.studio.docs = {
    get: async (id) => { requested.push(id); return { ...original }; },
    fetch: async () => new Blob(["original"]),
    upload: async () => ({ file_id: receiptId, filename: "same.docx", version: 3 }),
  };
  f.locations.push("docs");
  f.documents.push({ file_id: "original" });
  const opened = await f.io.open({ extensions: ["docx"], document: true });
  f.io.bind("doc", opened.sourceToken);
  f.io.changed(true);
  const input = { documentId: "doc", name: "same.docx", bytes: new Uint8Array([1]) };
  await assert.rejects(f.io.save(input), /SAVE_NOT_CONFIRMED/);
  assert.equal(f.io.canClose(), false);
  receiptId = "original";
  await f.io.save(input);
  assert.deepEqual(requested, ["original", "original", "original"]);
});

test("document-center Save preserves original folder, name and serial while local survives project changes", async () => {
  const f = fixture();
  f.studio.project = async () => ({ project_handle: "project-a" });
  f.studio.docs = {
    get: async () => ({ file_id: "file", filename: "same.docx", folder_id: "folder", version: 2, serial_number: "A-1" }),
    fetch: async () => new Blob(["old"]),
    upload: async (input, opts) => {
      assert.equal(input.folder_id, "folder");
      assert.equal(input.serial_number, "A-1");
      assert.equal(input.file.name, "same.docx");
      assert.equal(opts.project_handle, "project-a");
      return { file_id: "file", filename: "same.docx", version: 3 };
    },
  };
  f.locations.push("docs", "local");
  f.documents.push({ file_id: "file" });
  const doc = await f.io.open({ extensions: ["docx"], document: true });
  f.io.bind("cloud", doc.sourceToken);
  await f.io.save({ documentId: "cloud", name: "same.docx", bytes: new Uint8Array([1]) });
  const local = await f.io.open({ extensions: ["docx"], document: true });
  f.io.bind("local", local.sourceToken);
  f.switchProject();
  await f.io.save({ documentId: "local", name: "same.docx", bytes: new Uint8Array([2]) });
});
