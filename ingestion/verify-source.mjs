// Standalone artifact verification for the tender public-source contract.
// Behavior mirrors Studio5's platform-side source verification, but uses the
// duckdb CLI directly (read-only) so this repo carries no platform code.
import { spawnSync } from "node:child_process";

export function query(databasePath, sql) {
  const result = spawnSync("duckdb", ["-readonly", "-json", databasePath, "-c", sql], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `duckdb exited with ${result.status}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : [];
}

export function verifySource(entry) {
  let inventory;
  try {
    inventory = query(entry.file,
      "SELECT table_schema AS s, table_name AS t, list(column_name) AS cols FROM information_schema.columns GROUP BY 1, 2");
  } catch (err) { return { ok: false, reason: `artifact unreadable: ${err.message}` }; }
  const byName = new Map(inventory.map((row) => [`${row.s}.${row.t}`, new Set(row.cols)]));
  for (const [table, columns] of Object.entries(entry.tables)) {
    const actual = byName.get(table);
    if (!actual) return { ok: false, reason: `missing table: ${table}` };
    for (const column of columns) if (!actual.has(column)) return { ok: false, reason: `missing column: ${table}.${column}` };
  }
  const metaTable = `${entry.name}._meta`;
  if (!byName.has(metaTable)) return { ok: false, reason: `missing table: ${metaTable}` };
  let rows;
  try { rows = query(entry.file, `SELECT schema_version FROM ${metaTable}`); }
  catch (err) { return { ok: false, reason: `meta unreadable: ${err.message}` }; }
  const version = rows[0]?.schema_version;
  if (version !== entry.sourceSchemaVersion) return { ok: false, reason: `schema_version mismatch: artifact=${version} expected=${entry.sourceSchemaVersion}` };
  return { ok: true };
}
