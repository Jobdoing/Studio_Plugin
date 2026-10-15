# 施工查驗申請單

Studio5 App plugin。以提供的「施工自主檢查表.docx」首頁為版面參考，製作可填寫、儲存與 A4 列印的施工查驗申請單。新表單的工程名稱會先帶入目前選取的案場名稱，仍可修改；儲存資料依案場隔離。

## 本機檢查

先用 Studio5 的 `scripts/plugin-dev.mjs` 啟動此目錄下的 `plugin/inspection-request`，資料目錄放在 `/Volumes/Vibe-Temp/studio5-plugins/plugin-dev-data`，連接埠設為 `5212`。接著執行：

```sh
node inspection-request/checks/form.mjs
```

檢查涵蓋案場預填、儲存、重開、重新載入、案場隔離與列印預覽。另在 Studio5 專案目錄執行 `node scripts/plugin.mjs lint /Volumes/AI-Model/studio5-plugins/inspection-request/plugin/inspection-request --strict` 和 `node scripts/plugin.mjs check /Volumes/AI-Model/studio5-plugins/inspection-request/plugin/inspection-request`。

目前固定十列明細，紙本簽章欄保留空白，不處理電子簽章。表格主要區塊與原頁相近，並非逐字逐毫米的正式版型複製。
