# architect-kb — 建築知識庫(Sample)

Studio5 第一方範例外掛，以 HJPLUS 台灣 AEC 開源知識庫為素材，示範框架的核心能力。

## 示範重點

| 能力 | 說明 |
|---|---|
| 公共資料源查詢 | 一個資料源(`architect_kb`)驅動一個 block：`kb-skills` |
| 站內即時篩選 | 資料載入後純前端 filter，無需再查詢 — 技能支援類別 + 狀態 + 關鍵字 |
| 站內分頁 | 純前端分頁，頁數選擇器 20/50/100(預設 50)，「上一頁/下一頁」+ 跳首/末，頁控制顯示在表格上下各一列；計數行顯示「共 N 筆，符合篩選 M 筆，本頁顯示第 A–B 筆」；篩選變更自動回到第 1 頁；`?skill=` 深連結跳至包含目標行的頁面 |
| 欄寬拖曳調整 | 每欄表頭右側有拖曳把手，拖曳即時調整欄寬(最小 60px)；欄寬以 `table-layout:fixed` + `colgroup` 實作；調整結果在重新分頁/篩選後保留(Session 層級，不跨重新整理) |
| 有效的外部連結 | SKILL.md 連到 GitHub 檔案，連結均可正常開啟 (對照：tobid 標案連結官方不支援) |
| `?skill=<name>` 深連結 | 開啟時以該名稱自動篩選技能列表 |
| 授權合規 | 資料 CC BY-SA 4.0，artifact 依同授權再散布並標示出處 |

## 資料管線

### 1. fetch-kb.mjs — 抓取/讀取並轉為 JSONL

```sh
# 從本地 clone 讀取（建議開發用）
node ingestion/fetch-kb.mjs /tmp/kb-out --from /path/to/HJPLUS_Taiwan_Architect_KB

# 直接 clone 並讀取
node ingestion/fetch-kb.mjs /tmp/kb-out
```

輸出：
- `skills.jsonl` — ~90 筆，欄位：`name, category, class, status, data_currency, region, description, source_url`

### 2. build-artifact.mjs — 建立 DuckDB artifact

```sh
node ingestion/build-artifact.mjs /tmp/kb-out/skills.jsonl /path/to/architect_kb-YYYYMMDD.duckdb
```

> ⚠ 輸出檔名不可使用 `architect_kb.duckdb`（DuckDB CLI 將 stem 視為 catalog 名稱，與 schema 名衝突）。

### 3. verify-source.mjs — 驗證 artifact 合約

由平台在啟動時自動呼叫，也可手動驗證：

```sh
node -e "
import('./ingestion/verify-source.mjs').then(m => {
  const result = m.verifySource({
    name: 'architect_kb',
    file: '/path/to/artifact.duckdb',
    sourceSchemaVersion: '2',
    tables: {
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
  "sourceSchemaVersion": "2",
  "tables": {
    "architect_kb.kb_skills": ["name","category","class","status","data_currency","region","description","source_url"]
  }
}
```

## 執行測試

```sh
node --test architect-kb/ingestion/*.test.mjs
```

## 資料現況說明

- **知識技能**：~90 個 SKILL.md，涵蓋建築法規、建築執照、公共工程等；部分欄位（狀態、資料更新日）僅部分檔案有填寫。
- **資料天花板**：知識技能由人工維護，無爬蟲機制；更新頻率視社群貢獻。

## 授權

原始資料：CC BY-SA 4.0 © HJPLUS_Taiwan_Architect_KB 貢獻者  
本外掛程式碼：Apache License 2.0 © 2026 jobdone.cc  
資料 artifact 依 CC BY-SA 4.0 再散布，標示出處如 index.html 底部 attribution 區塊。
