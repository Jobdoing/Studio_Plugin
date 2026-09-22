# studio5-plugin-tobid

## 這是什麼

Studio5（vibe-coding 平台）的第一個第一方開源外掛範例——台灣政府標案快訊（資料來源：政府電子採購網 OpenData）。

## 外掛的構成

純靜態前端（`plugin.json` + `index.html`，sandboxed iframe + `window.studio` SDK：`studio.query(blockId)` / `studio.openExternal(url)`），一個 data block 定義（SQL + source 宣告），以及平台側的公共資料源 artifact（DuckDB）。外掛零伺服器端程式。

## 資料流

```
iframe → studio.query → host /api/block/{id} → 平台唯讀 SQL executor（allowlist + MAX_ROWS）→ {fields, rows}
```

## 怎麼掛進一台 Studio

目前為 ops 手動；ZIP 一鍵掛載格式開發中。

**(1) 產 artifact**

```bash
node ingestion/fetch-opendata.mjs rows.jsonl 8
node ingestion/build-artifact.mjs rows.jsonl tender-<YYYYMMDD>.duckdb
```

**(2) 放 artifact**

將產出的 `.duckdb` 放到盒子的 `runtime/tender/` 目錄。

**(3) 更新 `runtime/data-sources.json`**

加入 tender source 條目，範例如下：

```json
{
  "schema_version": "studio5-data-sources/v1",
  "sources": [
    {
      "name": "tender",
      "file": "tender/tender-20260922.duckdb",
      "scopePolicy": "public",
      "sourceSchemaVersion": "1",
      "tables": {
        "tender.tenders": [
          "tender_case_no", "org_name", "title", "category",
          "publish_date", "deadline", "budget_amount", "detail_url"
        ]
      }
    }
  ]
}
```

**(4) 掛載外掛**

- `blocks/tender-recent-construction.json` 放到 `runtime/blocks/`
- `plugin/tobid/` 目錄放到 `runtime/plugins/tobid/`（目錄掃描自動生效）

## 已知資料天花板

- 官方 bulk XML 僅 6 欄——`budget_amount` 全 NULL、`publish_date` 為雙月檔期起日近似、發布延遲約 6 週
- 公告已按 `tender_case_no + org_name` 去重（留最新）
- `fetch` 檔期參數需 ≥ 8（近月常為空檔）

## 授權

MIT — Copyright (c) 2026 jobdone.cc
