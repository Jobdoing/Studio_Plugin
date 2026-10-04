# studio5-plugins

Studio5(vibe-coding 平台)的第一方外掛集合。名稱標「(Sample)」的是**範例外掛**,示範框架的不同能力面向,以真實開放資料為素材——是展示品,不以真實產品功能為目標;未標的是實際使用的工具。

## 結構約定(刻意最小)

- **一個外掛 = 一個頂層目錄**,完全自成一體:自己的 `README.md`、外掛本體(`plugin/<id>/`)、資料管線、測試、工具。外掛之間**零共用依賴**——未來的外掛可能天南地北、技術與性質都不同,根目錄不強加任何框架。
- 根目錄只有:授權(`LICENSE`,Apache 2.0;個別外掛如需不同授權,目錄內自帶 `LICENSE` 覆蓋)與本索引。
- 外掛顯示名稱要不要加「(Sample)」,由擁有者決定:新增外掛時先詢問,不自行加上或拿掉。

## 外掛索引

| 目錄 | 名稱 | 示範重點 | 資料來源 |
|---|---|---|---|
| [`tobid/`](tobid/) | 標案快訊(Sample) | studio.query 查詢、站內列表/明細、`?tender=` 深連結、openExternal、沙箱邊界、公共資料源管線(去重/schema_version) | 政府電子採購網 OpenData(現況限制照實陳述於外掛內文) |
| [`architect-kb/`](architect-kb/) | 建築知識庫(Sample) | 公共資料源查詢、站內即時篩選、站內分頁(20/50/100 每頁)、欄寬拖曳調整、`?skill=` 深連結、有效個案外部連結、CC BY-SA 授權合規 | HJPLUS 台灣 AEC 開源知識庫(CC BY-SA 4.0) |
| [`real-estate/`](real-estate/) | 實價登錄(sample) | 免 key 公開 HTTP 查詢、條件查詢、成交卡片、伺服器分頁、單筆開啟 Google Maps | ToEstate 整理自內政部實價登錄 |
| [`jobsite-toolbox/`](jobsite-toolbox/) | 工地百寶箱 | 32 項公制工地計算工具（手機 21 項），方塊首頁與個人排序 | 公開原廠手冊、原廠計算器實測、《建築物混凝土結構設計規範》112 年版與幾何公式；來源標在各工具畫面 |

## 授權

Apache License 2.0 © 2026 jobdone.cc
