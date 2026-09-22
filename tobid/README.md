# studio5-plugin-tobid

## 這是什麼

Studio 的公開「外掛範例」(showcase)，以台灣政府標案資料為題，示範外掛框架的六項能力：**資料查詢(studio.query)**、**站內列表**、**站內明細**、**?tender= 深連結**、**對外連結(openExternal)**、以及**沙箱邊界**（iframe 無法自行連外）。

**官方資料現況（照實陳述）：**
- **資料來源**：政府電子採購網 OpenData 雙月批次 XML，發布延遲約 6–8 週，每筆僅 6 欄
- **預算金額**：官方 OpenData 不提供（政策選擇）；民間要求開放 API 的提案至今未被接受
- **個案連結**：無有效 permalink——官方網站忽略案號查詢參數，OpenData 亦無 pkPmsMain
- **民間替代**：[pcc.g0v.ronny.tw](https://pcc.g0v.ronny.tw)（openfunltd 維護）每日爬取、含預算金額——但僅允許瀏覽器存取，授權需另行評估

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

後續範例方向：將以民間開放資料嘗試不同性質的範例外掛（不以真實產品功能為目標）。
