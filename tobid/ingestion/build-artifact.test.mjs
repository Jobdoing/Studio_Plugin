// Test: build-artifact.mjs — 3-row JSONL fixture -> buildArtifact -> verifySource ok + rows match
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildArtifact } from "./build-artifact.mjs";
import { unescapeXml, dedupRows } from "./fetch-opendata.mjs";
import { query, verifySource } from "./verify-source.mjs";

// Fixture: 3 normalized rows with all required contract fields.
// NOTE: outPath must NOT be named "tender.duckdb" — DuckDB CLI treats the stem as a catalog name.
const FIXTURE_ROWS = [
  {
    tender_case_no: "TEST-001",
    org_name: "Test Agency A",
    title: "Road Repair Works Phase 1",
    category: "工程",
    publish_date: "2026-07-01",
    deadline: "2026-08-01",
    budget_amount: 5000000,
    detail_url: "https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic?tenderCaseNo=TEST-001",
  },
  {
    tender_case_no: "TEST-002",
    org_name: "Test Agency B",
    title: "Office Supplies Procurement",
    category: "財物",
    publish_date: "2026-07-02",
    deadline: "2026-08-15",
    budget_amount: null,
    detail_url: "https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic?tenderCaseNo=TEST-002",
  },
  {
    tender_case_no: "TEST-003",
    org_name: "Test Agency C",
    title: "Consulting Services",
    category: "勞務",
    publish_date: "2026-07-03",
    deadline: "2026-08-20",
    budget_amount: 1200000,
    detail_url: "https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic?tenderCaseNo=TEST-003",
  },
];

const EXPECTED_ENTRY = {
  name: "tender",
  scopePolicy: "public",
  sourceSchemaVersion: "1",
  tables: {
    "tender.tenders": [
      "tender_case_no", "org_name", "title", "category",
      "publish_date", "deadline", "budget_amount", "detail_url",
    ],
  },
};

const tmpDir = mkdtempSync(join(tmpdir(), "tender-build-test-"));
process.on("exit", () => { try { rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

const rowsPath = join(tmpDir, "rows.jsonl");
const outPath = join(tmpDir, "artifact.duckdb"); // NOT "tender.duckdb"

writeFileSync(rowsPath, FIXTURE_ROWS.map((r) => JSON.stringify(r)).join("\n") + "\n");

test("buildArtifact creates a valid DuckDB artifact from 3-row JSONL", () => {
  const result = buildArtifact({ rowsPath, outPath });
  assert.equal(result, outPath);
});

test("verifySource returns ok:true on the built artifact", () => {
  const entry = { ...EXPECTED_ENTRY, file: outPath };
  const verdict = verifySource(entry);
  assert.deepEqual(verdict, { ok: true });
});

test("the built artifact returns all 3 rows from tender.tenders", () => {
  const rows = query(outPath, "SELECT tender_case_no, category FROM tender.tenders ORDER BY tender_case_no");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].tender_case_no, "TEST-001");
  assert.equal(rows[0].category, "工程");
  assert.equal(rows[1].tender_case_no, "TEST-002");
  assert.equal(rows[2].tender_case_no, "TEST-003");
});

test("unescapeXml decodes all 5 standard XML entities", () => {
  assert.equal(
    unescapeXml("A&amp;B &lt;x&gt; &quot;q&quot; &apos;a&apos;"),
    "A&B <x> \"q\" 'a'"
  );
});

test("unescapeXml does not double-decode: &amp;lt; becomes &lt; not <", () => {
  assert.equal(unescapeXml("&amp;lt;"), "&lt;");
});

test("dedupRows: 3 rows with one duplicate key keeps 2 rows, last occurrence wins", () => {
  const rows = [
    { tender_case_no: "A-001", org_name: "Org X", deadline: "2026-08-01" },
    { tender_case_no: "A-001", org_name: "Org X", deadline: "2026-09-01" }, // later duplicate, should win
    { tender_case_no: "B-002", org_name: "Org Y", deadline: "2026-10-01" },
  ];
  const result = dedupRows(rows);
  assert.equal(result.length, 2);
  const dup = result.find((r) => r.tender_case_no === "A-001");
  assert.equal(dup.deadline, "2026-09-01", "later duplicate must overwrite earlier one");
});
