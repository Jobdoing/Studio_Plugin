import test from "node:test";
import assert from "node:assert/strict";
import { createDocuments } from "../src/documents.mjs";

function fixture() {
  const calls = [];
  let projectChanged;
  const studio = {
    project: async () => ({ project_handle: "project-a" }),
    onProjectChange: (fn) => { projectChanged = fn; return () => {}; },
    dirty: (value) => calls.push(["dirty", value]),
    docs: {
      get: async () => ({ file_id: "document", version: 7, filename: "daily.docx" }),
      fetch: async (...args) => { calls.push(["fetch", ...args]); return new Blob(["original"]); },
      upload: async (...args) => { calls.push(["upload", ...args]); return { version: 8 }; },
    },
  };
  return { studio, calls, switchProject: () => projectChanged({ project_handle: "project-b" }) };
}

test("frame polling sends dirty notifications only when the saved state changes", async () => {
  const f = fixture();
  const io = await createDocuments(f.studio);
  for (let frame = 0; frame < 60; frame += 1) io.changed();
  for (let frame = 0; frame < 60; frame += 1) io.markClean();
  assert.deepEqual(f.calls, [["dirty", true], ["dirty", false]]);
  assert.equal(io.canClose(), true);
});

test("batch name collisions fail before any upload, including a renamed first output", async () => {
  const f = fixture();
  const io = await createDocuments(f.studio);
  const bytes = new Uint8Array([1, 2, 3]);
  await assert.rejects(io.saveMany({ folderId: "folder", files: [
    { name: "Page2.pdf", bytes }, { name: "page2.pdf", bytes },
  ] }), /DUPLICATE_BATCH_FILENAME/);
  assert.deepEqual(f.calls, []);
});

test("batch failure reports actual completed writes and cannot acknowledge all outputs", async () => {
  const f = fixture();
  const io = await createDocuments(f.studio);
  let uploaded = 0;
  f.studio.docs.upload = async () => { if (++uploaded === 2) throw new Error("REJECTED"); return { filename: "page1.pdf" }; };
  await assert.rejects(io.saveMany({ folderId: "folder", files: [
    { name: "page1.pdf", bytes: new Uint8Array([1]) },
    { name: "page2.pdf", bytes: new Uint8Array([2]) },
  ] }), /Saved 1 of 2 files: REJECTED/);
  assert.equal(uploaded, 2);
  assert.equal(io.canClose(), false);
});

test("opens the selected metadata version within the pinned project", async () => {
  const f = fixture();
  const io = await createDocuments(f.studio);
  const result = await io.open("document");
  assert.equal(result.name, "daily.docx");
  assert.equal(new TextDecoder().decode(result.bytes), "original");
  assert.deepEqual(f.calls[0], ["fetch", "document", { version: 7 }, { project_handle: "project-a" }]);
});

test("a rejected upload never reports clean or loses its filename and bytes", async () => {
  const f = fixture();
  f.studio.docs.upload = async ({ file }, opts) => {
    assert.equal(file.name, "daily.docx");
    assert.equal(await file.text(), "edited");
    assert.equal(opts.project_handle, "project-a");
    throw new Error("NOT_FOUND");
  };
  const io = await createDocuments(f.studio);
  await assert.rejects(io.save({ folderId: "folder", name: "daily.docx", bytes: new TextEncoder().encode("edited") }), /NOT_FOUND/);
  assert.equal(io.canClose(), false);
  assert.ok(!f.calls.some(([op, value]) => op === "dirty" && value === false));
});

test("an upload never clears source edits; only the editor's saved acknowledgement does", async () => {
  const f = fixture();
  let finish;
  f.studio.docs.upload = () => new Promise((resolve) => { finish = resolve; });
  const io = await createDocuments(f.studio);
  const input = { folderId: "folder", name: "daily.docx", bytes: new Uint8Array([1]) };
  const pending = io.save(input);
  assert.equal(io.canClose(), false);
  io.markClean();
  assert.equal(io.canClose(), false);
  await assert.rejects(io.save(input), /SAVE_IN_PROGRESS/);
  io.changed();
  finish({ version: 8 });
  await pending;
  assert.equal(io.canClose(), false);
  const second = io.save(input);
  finish({ version: 9 });
  await second;
  assert.equal(io.canClose(), false);
  io.markClean();
  assert.equal(io.canClose(), true);
});

test("project switch invalidates an in-flight read and prevents further writes", async () => {
  const f = fixture();
  f.studio.docs.fetch = async () => { f.switchProject(); return new Blob(["private"]); };
  const io = await createDocuments(f.studio);
  await assert.rejects(io.open("document"), /PROJECT_CHANGED/);
  await assert.rejects(io.save({ folderId: "folder", name: "daily.docx", bytes: new Uint8Array([1]) }), /PROJECT_CHANGED/);
  assert.ok(!f.calls.some(([op]) => op === "upload"));
});

test("save destination uses the existing platform plugin folder in the pinned project", async () => {
  const f = fixture();
  f.studio.docs.pluginFolder = async (opts) => {
    assert.deepEqual(opts, { project_handle: "project-a" });
    return { folder_id: "editor-folder" };
  };
  const io = await createDocuments(f.studio);
  assert.equal((await io.saveFolder()).folder_id, "editor-folder");
  f.switchProject();
  await assert.rejects(io.saveFolder(), /PROJECT_CHANGED/);
});

test("invalid filenames are refused before any upload or dirty-state change", async () => {
  const f = fixture();
  const io = await createDocuments(f.studio);
  for (const name of ["", "  ", "../other.docx", "folder\\other.docx", "bad\0.docx"]) {
    await assert.rejects(io.save({ folderId: "folder", name, bytes: new Uint8Array([1]) }), /INVALID_NAME/);
  }
  assert.equal(f.calls.length, 0);
});
