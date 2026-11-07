import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("GridCraft Studio picker retains upstream SYLK import and document identity", async () => {
  const requests = [];
  const window = { studio: { onCanClose() {} } };
  const source = readFileSync(new URL("../src/runtime.mjs", import.meta.url), "utf8");
  vm.runInNewContext(source.replace(/^import .*;$/gm, ""), {
    window,
    document: { querySelector: () => null },
    createFiles: () => ({ open: async (options) => requests.push(options) }),
    chooseLocation: undefined,
    chooseDocument: undefined,
  });
  await window.studioCraftOpen("spreadsheet:single:document");
  assert.ok(requests[0].extensions.includes("slk"));
  assert.equal(requests[0].document, true);
  assert.equal(requests[0].multiple, false);
});
