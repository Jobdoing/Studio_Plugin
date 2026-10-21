import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const source = readFileSync(new URL("../src/documents.mjs", import.meta.url), "utf8");
const tests = readFileSync(new URL("./documents.test.mjs", import.meta.url), "utf8");
const fileTests = readFileSync(new URL("./files.test.mjs", import.meta.url), "utf8");
const mutations = [
  ["version pin", "{ version: file.version }", "{}"],
  ["project isolation", "if (invalidated)", "if (false)"],
  ["failed save stays dirty", "        saving = false;", "        dirty = false; studio.dirty(false); saving = false;"],
  ["filename survives upload", "new File([bytes.slice()], name, { type })", "new Blob([bytes.slice()], { type })"],
  ["exports keep source dirty", "        return result;", "        dirty = false; studio.dirty(false); return result;"],
  ["batch destinations stay distinct", "new Set(names).size !== files.length", "false"],
  ["stable document identity", "bindings.get(documentId)", "bindings.values().next().value"],
  ["Save As intent", "!saveAs && !copy && old", "!copy && old"],
  ["format conversion needs destination", "extension(old.filename) === extension(name)", "true"],
  ["receipt must confirm save", 'result?.status !== "saved"', "false"],
  ["exports do not rebind", "!copy && documentId !== undefined", "documentId !== undefined"],
  ["receipt format matches bytes", "extension(receipt.filename) !== extension(name)", "false"],
];
const root = mkdtempSync(join(tmpdir(), "craft-document-mutations-"));
try {
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "tests"));
  writeFileSync(join(root, "tests/documents.test.mjs"), tests);
  writeFileSync(join(root, "tests/files.test.mjs"), fileTests);
  for (const [label, from, to] of mutations) {
    assert.ok(source.includes(from), `Mutation anchor missing: ${label}`);
    writeFileSync(join(root, "src/documents.mjs"), source.replace(from, to));
    const result = spawnSync(process.execPath, ["--test", join(root, "tests/documents.test.mjs"), join(root, "tests/files.test.mjs")], { encoding: "utf8" });
    assert.equal(result.error, undefined, `${label}: runner failed`);
    assert.notEqual(result.status, 0, `Undetected mutation: ${label}`);
  }
  console.log(`Detected ${mutations.length}/${mutations.length} document-storage mutations`);
} finally { rmSync(root, { recursive: true, force: true }); }
