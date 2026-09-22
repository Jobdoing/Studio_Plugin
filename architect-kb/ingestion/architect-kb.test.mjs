// Tests for architect-kb ingestion pipeline.
// Run with: node --test architect-kb/ingestion/*.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildArtifact, ARCHITECT_KB_SCHEMA_VERSION } from "./build-artifact.mjs";
import { query, verifySource } from "./verify-source.mjs";

// ---- Frontmatter parser tests ----
// Import inline so we can test the logic without running the full fetch script.
// We duplicate the parser here as a minimal inline copy — the real one lives in fetch-kb.mjs.
function parseFrontmatter(text) {
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const lines = fmMatch[1].split(/\r?\n/);
  const root = {};
  let currentBlock = null;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^[a-zA-Z_-]/.test(line)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) { currentBlock = null; continue; }
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();
      if (rawVal === "") {
        currentBlock = key;
      } else {
        currentBlock = null;
        root[key] = rawVal.replace(/^["']|["']$/g, "");
      }
    } else if (currentBlock && /^\s+/.test(line)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();
      if (rawVal !== "") root[key] = rawVal.replace(/^["']|["']$/g, "");
    } else {
      currentBlock = null;
    }
  }
  return root;
}

test("parseFrontmatter: top-level and metadata sub-block fields extracted", () => {
  const input = `---
type: Skill
name: test-skill
description: "A test skill description"
metadata:
  region: taiwan
  class: C
  status: draft
  data-currency: "2026-07-10"
---

# Body content here
`;
  const result = parseFrontmatter(input);
  assert.equal(result.name, "test-skill");
  assert.equal(result.description, "A test skill description");
  assert.equal(result.region, "taiwan");
  assert.equal(result.class, "C");
  assert.equal(result.status, "draft");
  assert.equal(result["data-currency"], "2026-07-10");
});

test("parseFrontmatter: status at top-level (not under metadata)", () => {
  const input = `---
type: Skill
name: top-status-skill
description: "skill with top-level status"
status: unverified
---
`;
  const result = parseFrontmatter(input);
  assert.equal(result.status, "unverified");
  assert.equal(result.name, "top-status-skill");
});

test("parseFrontmatter: returns null for file without --- delimiters", () => {
  const result = parseFrontmatter("# No frontmatter here\nJust body text.");
  assert.equal(result, null);
});

test("parseFrontmatter: malformed file (no closing ---) returns null", () => {
  const input = `---
name: incomplete
description: "no closing delimiter"
`;
  const result = parseFrontmatter(input);
  assert.equal(result, null);
});

// ---- Builder + verifySource tests ----

const FIXTURE_MEP = [
  { id: 1, name: "CNS 6445_blk_15A", vendor: "高興昌", description: "Test pipe A",
    source_url: "http://www.khc.com.tw", sourced_at: "2026-03-17", registered_at: "2026-07-23" },
  { id: 2, name: "CNS 6445_blk_20A", vendor: "高興昌", description: "Test pipe B",
    source_url: "http://www.khc.com.tw", sourced_at: "2026-03-17", registered_at: "2026-07-23" },
  // row with null dates — must be tolerated
  { id: 3, name: "Unnamed Item", vendor: null, description: null,
    source_url: null, sourced_at: null, registered_at: null },
];

const FIXTURE_SKILLS = [
  { name: "architect-foundations", category: "建築設計與規劃", class: "A", status: null,
    data_currency: null, region: null,
    description: "Foundational reference skill",
    source_url: "https://github.com/h30190/HJPLUS_Taiwan_Architect_KB/blob/main/raw/建築設計與規劃/建築基礎/architect-foundations/SKILL.md" },
  { name: "urban-road-pedestrian-accessibility", category: "公共工程", class: "C", status: "draft",
    data_currency: "2026-08-15", region: "taiwan",
    description: "Sidewalk clear width and accessibility",
    source_url: "https://github.com/h30190/HJPLUS_Taiwan_Architect_KB/blob/main/raw/公共工程/SKILL.md" },
];

const EXPECTED_ENTRY = {
  name: "architect_kb",
  sourceSchemaVersion: "1",
  tables: {
    "architect_kb.mep_materials": ["id", "name", "vendor", "description", "source_url", "sourced_at", "registered_at"],
    "architect_kb.kb_skills": ["name", "category", "class", "status", "data_currency", "region", "description", "source_url"],
  },
};

const tmpDir = mkdtempSync(join(tmpdir(), "architect-kb-test-"));
process.on("exit", () => { try { rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

const mepPath = join(tmpDir, "mep.jsonl");
const skillsPath = join(tmpDir, "skills.jsonl");
const outPath = join(tmpDir, "artifact.duckdb"); // NOT "architect_kb.duckdb"

writeFileSync(mepPath, FIXTURE_MEP.map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(skillsPath, FIXTURE_SKILLS.map((r) => JSON.stringify(r)).join("\n") + "\n");

test("buildArtifact creates a valid DuckDB artifact from fixture JSONL", () => {
  const result = buildArtifact({ mepPath, skillsPath, outPath });
  assert.equal(result, outPath);
});

test("verifySource returns ok:true on the built artifact", () => {
  const entry = { ...EXPECTED_ENTRY, file: outPath };
  const verdict = verifySource(entry);
  assert.deepEqual(verdict, { ok: true });
});

test("artifact has correct mep_materials row count and data", () => {
  const rows = query(outPath, "SELECT id, name, vendor FROM architect_kb.mep_materials ORDER BY id");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].id, 1);
  assert.equal(rows[0].name, "CNS 6445_blk_15A");
  assert.equal(rows[0].vendor, "高興昌");
  // last row has null vendor
  assert.equal(rows[2].vendor, null);
});

test("artifact has correct kb_skills row count and data", () => {
  const rows = query(outPath, "SELECT name, category, status FROM architect_kb.kb_skills ORDER BY name");
  assert.equal(rows.length, 2);
  const arch = rows.find((r) => r.name === "architect-foundations");
  assert.ok(arch, "architect-foundations row present");
  assert.equal(arch.category, "建築設計與規劃");
  const urban = rows.find((r) => r.name === "urban-road-pedestrian-accessibility");
  assert.equal(urban.status, "draft");
});

test("null date values in mep_materials are stored as NULL (not crash)", () => {
  const rows = query(outPath, "SELECT id, sourced_at, registered_at FROM architect_kb.mep_materials WHERE id = 3");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourced_at, null);
  assert.equal(rows[0].registered_at, null);
});

test("_meta schema_version matches expected constant", () => {
  const rows = query(outPath, "SELECT schema_version FROM architect_kb._meta");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].schema_version, ARCHITECT_KB_SCHEMA_VERSION);
  assert.equal(ARCHITECT_KB_SCHEMA_VERSION, "1");
});
