#!/usr/bin/env node
// Fetch 政府電子採購網 (PCC) tender-notice OpenData XML files and emit normalized JSONL.
// NOTE(ceiling): Ops-side tool: manually run to refresh the artifact; no scheduler.
//
// Dataset: PCC OpenData 招標公告 bi-monthly XML
// Base URL: https://web.pcc.gov.tw/tps/tp/OpenData/downloadFile?fileName=tender_<YYYYMM[01|02]>.xml
// Browse list: https://web.pcc.gov.tw/tps/tp/OpenData/showList
// Verified: 2026-09-22
//
// XML schema (6 fields per <TENDER>):
//   TENDER_CASE_NO   -> tender_case_no
//   TENDER_ORG_NAME  -> org_name
//   TENDER_NAME      -> title
//   PROCUREMENT_ATTR -> category (mapped via CATEGORY_MAP below)
//   TENDER_SPDT      -> deadline  (format YYYY/MM/DD)
//   (not in dataset) -> publish_date  (derived from file period start date)
//   (not in dataset) -> budget_amount (NULL — dataset does not expose budget)
//   (derived)        -> detail_url    (constructed from TENDER_CASE_NO)
//
// NOTE(ceiling): budget_amount is always NULL; the PCC XML bulk dataset does not
//   include budget fields. To populate budgets, a per-tender detail-page fetch would
//   be needed — that is a future upgrade requiring rate-limited scraping.
//
// NOTE(ceiling): publish_date is approximated as the START date of the file's period
//   (e.g. tender_20260702.xml covers 2026-07-16 to 2026-07-31, so publish_date = 2026-07-16).
//   Exact publish timestamps are only available via the detail page.

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { get as httpsGet } from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));

// NORMALIZE: dataset column -> artifact column mapping with category translation.
// PROCUREMENT_ATTR values from PCC: 工程類, 財物類, 勞務類 (rarely: other)
const NORMALIZE = {
  TENDER_CASE_NO: "tender_case_no",
  TENDER_ORG_NAME: "org_name",
  TENDER_NAME: "title",
  PROCUREMENT_ATTR: "category",   // see CATEGORY_MAP below
  TENDER_SPDT: "deadline",        // YYYY/MM/DD -> YYYY-MM-DD
  // publish_date: derived from file period (see buildFileList)
  // budget_amount: NULL (not in dataset)
  // detail_url: constructed (see normalizeRow)
};

const CATEGORY_MAP = {
  "工程類": "工程",
  "財物類": "財物",
  "勞務類": "勞務",
};

const PCC_BASE_URL = "https://web.pcc.gov.tw/tps/tp/OpenData/downloadFile?fileName=";
const PCC_DETAIL_BASE = "https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic?tenderCaseNo=";

// Build the list of (fileName, periodStart) pairs for the last N bi-monthly periods.
// Each year-month has two periods: 01 (1st-15th) and 02 (16th-end).
function buildFileList(count) {
  const results = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-based
  let half = now.getDate() <= 15 ? 1 : 2;

  for (let i = 0; i < count; i++) {
    half -= 1;
    if (half === 0) {
      half = 2;
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }
    const mm = String(month).padStart(2, "0");
    const fileName = `tender_${year}${mm}0${half}.xml`;
    const periodStart = half === 1
      ? `${year}-${mm}-01`
      : `${year}-${mm}-16`;
    results.push({ fileName, periodStart });
  }
  return results;
}

function httpsGetText(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      // PCC server blocks requests without a User-Agent header (returns 0 bytes).
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Studio5-TenderFetch/1.0)" },
    };
    httpsGet(opts, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

export function unescapeXml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseXmlTenders(xml) {
  const tenders = [];
  const tenderRe = /<TENDER>([\s\S]*?)<\/TENDER>/g;
  const fieldRe = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = tenderRe.exec(xml)) !== null) {
    const block = match[1];
    const fields = {};
    let fm;
    fieldRe.lastIndex = 0;
    while ((fm = fieldRe.exec(block)) !== null) {
      fields[fm[1]] = unescapeXml(fm[2].trim());
    }
    tenders.push(fields);
  }
  return tenders;
}

function normalizeRow(fields, periodStart) {
  const deadlineRaw = fields.TENDER_SPDT ?? "";
  const deadline = deadlineRaw.replace(/\//g, "-") || null;
  const categoryRaw = fields.PROCUREMENT_ATTR ?? "";
  // NOTE(ceiling): unmapped PROCUREMENT_ATTR values silently become NULL category;
  //   upgrade path = extend CATEGORY_MAP with new procurement types.
  const category = CATEGORY_MAP[categoryRaw] ?? null;
  const caseNo = fields.TENDER_CASE_NO ?? "";
  return {
    tender_case_no: caseNo || null,
    org_name: fields.TENDER_ORG_NAME ?? null,
    title: fields.TENDER_NAME ?? null,
    category,
    publish_date: periodStart,
    deadline,
    budget_amount: null,
    detail_url: caseNo ? `${PCC_DETAIL_BASE}${encodeURIComponent(caseNo)}` : null,
  };
}

// Dedup rows by tender_case_no+org_name; later entries overwrite earlier ones (last wins).
// PCC publishes multiple notices per tender (corrections/re-publications); the last one is most current.
export function dedupRows(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.tender_case_no ?? ""}\x00${row.org_name ?? ""}`;
    seen.set(key, row);
  }
  return Array.from(seen.values());
}

export async function fetchAndNormalize({ fileCount = 4, outPath }) {
  const files = buildFileList(fileCount);
  const allRows = [];

  for (const { fileName, periodStart } of files) {
    const url = `${PCC_BASE_URL}${fileName}`;
    process.stderr.write(`fetching ${url} ... `);
    let xml;
    try {
      xml = await httpsGetText(url);
    } catch (err) {
      process.stderr.write(`SKIP (${err.message})\n`);
      continue;
    }
    const tenders = parseXmlTenders(xml);
    process.stderr.write(`${tenders.length} tenders\n`);
    for (const fields of tenders) {
      allRows.push(normalizeRow(fields, periodStart));
    }
  }

  const deduped = dedupRows(allRows);
  process.stderr.write(`deduped ${allRows.length} notices -> ${deduped.length} distinct tenders\n`);

  const jsonl = deduped.map((r) => JSON.stringify(r)).join("\n") + "\n";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, jsonl, "utf8");
  process.stderr.write(`wrote ${deduped.length} rows -> ${outPath}\n`);
  return { rowCount: deduped.length, rawCount: allRows.length, outPath };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").at(-1))) {
  const outPath = process.argv[2] || join(__dirname, "rows.jsonl");
  // NOTE(ceiling): default 8 periods; PCC publishes with a ~6-week lag, so the most
  // recent 2-3 bi-monthly files are often empty — fewer periods can yield a gutted dataset.
  const fileCount = Number(process.argv[3] ?? 8);
  fetchAndNormalize({ fileCount, outPath })
    .then(({ rowCount }) => {
      console.log(`done: ${rowCount} rows -> ${outPath}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
