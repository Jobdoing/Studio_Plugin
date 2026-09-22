#!/usr/bin/env node
// Build the tender public-source DuckDB artifact from normalized JSONL rows.
// Ops-side tool: runs centrally, never on customer boxes.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

export const TENDER_SCHEMA_VERSION = "1";

export function buildArtifact({ rowsPath, outPath }) {
  rmSync(outPath, { force: true });
  const sql = `
CREATE SCHEMA tender;
CREATE TABLE tender.tenders(
  tender_case_no VARCHAR, org_name VARCHAR, title VARCHAR, category VARCHAR,
  publish_date DATE, deadline DATE, budget_amount BIGINT, detail_url VARCHAR);
INSERT INTO tender.tenders
  SELECT tender_case_no, org_name, title, category,
         CAST(publish_date AS DATE), CAST(deadline AS DATE),
         CAST(budget_amount AS BIGINT), detail_url
  FROM read_json_auto('${rowsPath.replaceAll("'", "''")}', format='newline_delimited');
CREATE TABLE tender._meta(schema_version VARCHAR);
INSERT INTO tender._meta VALUES ('${TENDER_SCHEMA_VERSION}');
`;
  const result = spawnSync("duckdb", [outPath, "-c", sql], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`duckdb build failed: ${result.stderr}`);
  return outPath;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").at(-1))) {
  const [rowsPath, outPath] = process.argv.slice(2);
  if (!rowsPath || !outPath) { console.error("usage: build-artifact.mjs <rows.jsonl> <out.duckdb>"); process.exit(1); }
  console.log(buildArtifact({ rowsPath, outPath }));
}
