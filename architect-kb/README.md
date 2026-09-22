# architect-kb — 建築知識庫(Sample)

Studio5 第二個第一方範例外掛，以 HJPLUS 台灣 AEC 開源知識庫為素材，示範框架的進階能力。

## 示範重點

| 能力 | 說明 |
|---|---|
| 多個 data block | 一個資料源(`architect_kb`)驅動兩個 block：`kb-mep-materials` 和 `kb-skills` |
| 站內即時篩選 | 資料載入後純前端 filter，無需再查詢 — MEP 支援廠商 dropdown + 關鍵字；技能支援類別 + 狀態 + 關鍵字 |
| 有效的外部連結 | MEP 品項的`資料來源`是廠商網站，SKILL.md 連到 GitHub 檔案，連結均可正常開啟 (對照：tobid 標案連結官方不支援) |
| `?mep=<id>` 深連結 | 開啟時自動展開對應 MEP 品項 |
| `?skill=<name>` 深連結 | 切換至技能頁並以該名稱篩選 |
| 授權合規 | 資料 CC BY-SA 4.0，artifact 依同授權再散布並標示出處 |

## 資料管線

### 1. fetch-kb.mjs — 抓取/讀取並轉為 JSONL

```sh
# 從本地 clone 讀取（建議開發用）
node ingestion/fetch-kb.mjs /tmp/kb-out --from /Volumes/Vibe-Temp/architect-kb-probe

# 直接 clone 並讀取
node ingestion/fetch-kb.mjs /tmp/kb-out
```

輸出：
- `mep.jsonl` — 1,180 筆，欄位：`id, name, vendor, description, source_url, sourced_at, registered_at`
- `skills.jsonl` — ~90 筆，欄位：`name, category, class, status, data_currency, region, description, source_url`

### 2. build-artifact.mjs — 建立 DuckDB artifact

```sh
node ingestion/build-artifact.mjs /tmp/kb-out/mep.jsonl /tmp/kb-out/skills.jsonl /path/to/architect_kb-YYYYMMDD.duckdb
```

> ⚠ 輸出檔名不可使用 `architect_kb.duckdb`（DuckDB CLI 將 stem 視為 catalog 名稱，與 schema 名衝突）。

### 3. verify-source.mjs — 驗證 artifact 合約

由平台在啟動時自動呼叫，也可手動驗證：

```sh
# 透過 Node 手動呼叫
node -e "
import('./ingestion/verify-source.mjs').then(m => {
  const result = m.verifySource({
    name: 'architect_kb',
    file: '/path/to/artifact.duckdb',
    sourceSchemaVersion: '1',
    tables: {
      'architect_kb.mep_materials': ['id','name','vendor','description','source_url','sourced_at','registered_at'],
      'architect_kb.kb_skills': ['name','category','class','status','data_currency','region','description','source_url']
    }
  });
  console.log(result);
});
"
```

## Artifact 合約

data-sources.json 範例條目：

```json
{
  "name": "architect_kb",
  "sourceSchemaVersion": "1",
  "tables": {
    "architect_kb.mep_materials": ["id","name","vendor","description","source_url","sourced_at","registered_at"],
    "architect_kb.kb_skills": ["name","category","class","status","data_currency","region","description","source_url"]
  }
}
```

## 執行測試

```sh
node --test architect-kb/ingestion/*.test.mjs
```

## 資料現況說明

- **MEP 品項**：目前僅含高興昌管材規格（~1,180 筆，2026-08-06 更新）；CC BY-SA 4.0。
- **知識技能**：~90 個 SKILL.md，涵蓋建築法規、建築執照、公共工程等；部分欄位（狀態、資料更新日）僅部分檔案有填寫。
- **資料天花板**：品項百科由人工維護，無爬蟲機制；更新頻率視社群貢獻。

## 授權

原始資料：CC BY-SA 4.0 © HJPLUS_Taiwan_Architect_KB 貢獻者  
本外掛程式碼：MIT © 2026 jobdone.cc  
資料 artifact 依 CC BY-SA 4.0 再散布，標示出處如 index.html 底部 attribution 區塊。
