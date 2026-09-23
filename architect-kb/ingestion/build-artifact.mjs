#!/usr/bin/env node
// Build the architect-kb DuckDB artifact from normalized JSONL files.
// Ops-side tool: runs centrally, never on customer boxes.
//
// Usage: node build-artifact.mjs <skills.jsonl> <out.duckdb>
//
// NOTE: do NOT name the output file "architect_kb.duckdb" —
//   DuckDB CLI interprets the file stem as a catalog name, which conflicts
//   with the schema name "architect_kb" we create inside the file.

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

export const ARCHITECT_KB_SCHEMA_VERSION = "2";

export function buildArtifact({ skillsPath, outPath }) {
  rmSync(outPath, { force: true });
  const sql = `
CREATE SCHEMA architect_kb;
CREATE TABLE architect_kb.kb_skills(
  name VARCHAR, category VARCHAR, class VARCHAR, status VARCHAR,
  data_currency VARCHAR, region VARCHAR, description VARCHAR, source_url VARCHAR);
INSERT INTO architect_kb.kb_skills
  SELECT name, category, class, status, data_currency, region, description, source_url
  FROM read_json_auto('${skillsPath.replaceAll("'", "''")}', format='newline_delimited');
CREATE TABLE architect_kb._meta(schema_version VARCHAR);
INSERT INTO architect_kb._meta VALUES ('${ARCHITECT_KB_SCHEMA_VERSION}');
`;
  const result = spawnSync("duckdb", [outPath, "-c", sql], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`duckdb build failed: ${result.stderr}`);
  return outPath;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").at(-1))) {
  const [skillsPath, outPath] = process.argv.slice(2);
  if (!skillsPath || !outPath) {
    console.error("usage: build-artifact.mjs <skills.jsonl> <out.duckdb>");
    process.exit(1);
  }
  console.log(buildArtifact({ skillsPath, outPath }));
}
