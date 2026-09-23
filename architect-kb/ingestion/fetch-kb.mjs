#!/usr/bin/env node
// Fetch HJPLUS Taiwan Architect KB and emit normalized JSONL files.
// Ops-side tool: run manually to refresh the artifact.
//
// Data sources:
//   skills.jsonl <- all raw/**/SKILL.md frontmatter    (expected ~90 files)
//
// Usage:
//   node fetch-kb.mjs <out-dir> [--from <local-clone-path>]
//
// Without --from: shallow-clones github.com/h30190/HJPLUS_Taiwan_Architect_KB
// into a temp directory then reads from there.

import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const REPO_URL = "https://github.com/h30190/HJPLUS_Taiwan_Architect_KB";
const DEFAULT_CLONE_DIR = join(tmpdir(), "architect-kb-fetch");
const REPO_BLOB_BASE = "https://github.com/h30190/HJPLUS_Taiwan_Architect_KB/blob/main/";

// --- CLI arg parsing ---

const args = process.argv.slice(2);
if (!args[0]) {
  console.error("usage: fetch-kb.mjs <out-dir> [--from <local-clone-path>]");
  process.exit(1);
}
const outDir = args[0];
const fromIdx = args.indexOf("--from");
let srcRoot;
if (fromIdx !== -1) {
  srcRoot = args[fromIdx + 1];
  if (!srcRoot) { console.error("--from requires a path"); process.exit(1); }
} else {
  srcRoot = DEFAULT_CLONE_DIR;
  process.stderr.write(`cloning ${REPO_URL} -> ${srcRoot} ...\n`);
  const result = spawnSync("git", ["clone", "--depth", "1", REPO_URL, srcRoot], { encoding: "utf8" });
  if (result.status !== 0) {
    // If dir already exists from a previous run, that's fine — just reuse it.
    if (!result.stderr.includes("already exists")) {
      throw new Error(`git clone failed: ${result.stderr}`);
    }
    process.stderr.write("clone dir already exists, reusing\n");
  }
}

mkdirSync(outDir, { recursive: true });

// --- Skills extraction ---
// Reads all SKILL.md files under raw/, extracts YAML frontmatter.
// Frontmatter fields live at top-level or under a `metadata:` sub-block.
// Uses a simple key:value line parser — no yaml lib.

function findFiles(dir, namePredicate) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const full = join(d, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { walk(full); }
      else if (namePredicate(e, full)) { results.push(full); }
    }
  }
  walk(dir);
  return results;
}

const rawDir = join(srcRoot, "raw");

// Simple flat YAML parser for --- delimited frontmatter.
// Handles top-level keys and one level of nested block (e.g. `metadata:` section).
// Returns a flat object merging metadata sub-keys into the root.
function parseFrontmatter(text) {
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const lines = fmMatch[1].split(/\r?\n/);
  const root = {};
  let currentBlock = null;
  for (const line of lines) {
    // Skip empty and comment lines.
    if (!line.trim() || line.trim().startsWith("#")) continue;
    // Top-level key: no leading spaces.
    if (/^[a-zA-Z_-]/.test(line)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) { currentBlock = null; continue; }
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();
      if (rawVal === "" || rawVal === null) {
        // Start of a nested block.
        currentBlock = key;
      } else {
        currentBlock = null;
        root[key] = rawVal.replace(/^["']|["']$/g, ""); // strip optional quotes
      }
    } else if (currentBlock && /^\s+/.test(line)) {
      // Sub-key inside the current block (e.g. under `metadata:`)
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();
      if (rawVal !== "") {
        root[key] = rawVal.replace(/^["']|["']$/g, "");
      }
    } else {
      currentBlock = null;
    }
  }
  return root;
}

// Determine category = top-level directory under raw/.
function getCategory(filePath) {
  const rel = relative(rawDir, filePath);
  return rel.split("/")[0] ?? null;
}

const skillFiles = findFiles(rawDir, (name) => name === "SKILL.md");
process.stderr.write(`found ${skillFiles.length} SKILL.md files\n`);

const skillRows = [];
for (const filePath of skillFiles) {
  let text;
  try { text = readFileSync(filePath, "utf8"); }
  catch (err) { process.stderr.write(`SKIP SKILL.md ${filePath}: ${err.message}\n`); continue; }
  const fm = parseFrontmatter(text);
  if (!fm) { process.stderr.write(`SKIP SKILL.md (no frontmatter): ${filePath}\n`); continue; }
  const relPath = relative(srcRoot, filePath);
  const source_url = REPO_BLOB_BASE + relPath;
  skillRows.push({
    name: fm["name"] ?? null,
    category: getCategory(filePath),
    class: fm["class"] ?? null,
    status: fm["status"] ?? null,
    data_currency: fm["data-currency"] ?? null,
    region: fm["region"] ?? null,
    description: fm["description"] ?? null,
    source_url,
  });
}
process.stderr.write(`skill rows: ${skillRows.length}\n`);
writeFileSync(join(outDir, "skills.jsonl"), skillRows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

process.stderr.write(`done: skills=${skillRows.length} -> ${outDir}\n`);
