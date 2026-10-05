# 立體工地

獨立 Studio5 外掛，版本 `0.1.1`，id `site-diorama`。不修改原 dashboard。

固定的立體工地有建物、吊車、工務所、材料棧板及工人小物。警示錐、日誌、查驗夾對應選定案場的改善單、施工日誌、查驗紀錄，點擊物件或摘要按鈕查看明細。可拖曳旋轉、使用旋轉按鈕與重設視角；可關閉動畫。外掛隱藏、裝置要求減少動態時停止動畫。WebGL 不可用時保留資料按鈕。

名稱為「立體工地」。原 dashboard 的使用者釘選仍留在原頁面；本外掛沒有另做釘選系統。

## 資料與模型

- 重用 Studio SDK `studio.project`／`onProjectChange`／`query`／`dataset`，六個內附 data blocks 均為 `scope: project`。只接受單一案場；沒有選案場不查資料。切換案場立即清空資料，拒絕舊回應。
- `fact_corrective_sheet`：有效、未撤銷改善單的未完成與逾期件數。逾期依查詢當下 Asia/Taipei 的日期判斷。
- `fact_daily_log`：選取案場在 2026/06/01 的有效、未刪除日誌。含公共工程、一般建築、監造日誌；無資料時顯示當日無日誌，不改查其他日期。
- `fact_inspection_record`：有效且查驗未刪除的紀錄總筆數、不合格筆數。不同於改善單，不合併母體或推算待查驗件數。
- 明細只顯示排序後前 20 筆；摘要使用獨立的全母體彙總，不從前 20 筆加總。沒有新增分頁、資料編輯、即時監控或 AI 功能。
- 場景是自行建模的幾何示意，不是設計稿圖片背景、真實 BIM、真實樓層、工程進度或缺失位置。吊鉤是裝飾動畫；日誌及查驗夾有紀錄時才動，標記文字顯示真實查詢值。
- 零、未提供、讀取失敗分開顯示；外部內容以 `textContent` 顯示，不執行資料中的 HTML。

## 套件與安裝

安裝目錄：`plugin/site-diorama/`。ZIP：[releases/site-diorama-0.1.1.zip](releases/site-diorama-0.1.1.zip)，根目錄包含 `plugin.json`。

```sh
node scripts/plugin.mjs install /path/to/site-diorama-0.1.1.zip --strict
```

需要 Studio Component Kit、上述 SDK 能力、內建 `/vendor/three/0.186/three.module.min.js` 與 OrbitControls，以及三類 curated tables。無新 npm dependency、API key、AI 呼叫、第三方網路請求或自建後端。模型使用平台內建 Three.js 0.186.1（MIT）；外掛原始碼依 Apache 2.0。SDK 及 vendor 檔案不複製進 ZIP。

公開套件不含客戶資料、正式案場驗證紀錄或憑證；各客戶安裝後透過自己的 Studio 登入與案場權限查詢。

## 可重跑檢查

```sh
node site-diorama/checks/data.mjs
node site-diorama/checks/mutations.mjs
STUDIO5_ROOT=/Volumes/AI-Model/Studio5 node site-diorama/checks/fallback-layout.mjs
TMPDIR=/Volumes/Vibe-Temp/studio5-plugins/site-diorama/tmp node /Volumes/AI-Model/Studio5/scripts/plugin.mjs lint /Volumes/AI-Model/studio5-plugins/site-diorama/plugin/site-diorama --strict
TMPDIR=/Volumes/Vibe-Temp/studio5-plugins/site-diorama/tmp node /Volumes/AI-Model/Studio5/scripts/plugin.mjs check /Volumes/AI-Model/studio5-plugins/site-diorama/plugin/site-diorama
```

隔離預覽：

```sh
TMPDIR=/Volumes/Vibe-Temp/studio5-plugins/site-diorama/tmp node /Volumes/AI-Model/Studio5/scripts/plugin-dev.mjs --blocks /Volumes/AI-Model/studio5-plugins/site-diorama/plugin/site-diorama --data /Volumes/Vibe-Temp/studio5-plugins/site-diorama/preview --port 5224 --maintenance-port 5225
```

在另一個 terminal 執行功能檢查：

```sh
TMPDIR=/Volumes/Vibe-Temp/studio5-plugins/site-diorama/tmp STUDIO5_ROOT=/Volumes/AI-Model/Studio5 EVIDENCE_DIR=/Volumes/Vibe-Temp/studio5-plugins/site-diorama/evidence node site-diorama/checks/browser.mjs
```

檢查重用 Studio5 的 puppeteer-core 與本機 Chrome；不替外掛新增依賴。執行前需建立上述 tmp 與 evidence 目錄。換機時改用自己的 Studio5 路徑；Vibe-Temp 未掛載則改用專案內固定暫存目錄。

**驗證邊界：** 瀏覽器功能檢查使用真實 SDK／案場事件與明確模擬的 block 回應；各客戶環境仍需自行驗收。詳見 [CHECKS.md](CHECKS.md)。

## 修改立體場景

模型、材質、光影與物件位置集中於 `plugin/site-diorama/scene.mjs` 的 `createSite`。可修改建物、吊車、工人等示意物件；保留其回傳的場景操作方法與三類標記對應，讓 `app.mjs` 持續控制動畫、案場切換與明細。

查詢口徑在 `blocks/`，資料解析與案場參數在 `data.mjs`。只改模型時無須改這兩處。不要把真實紀錄、案場名稱、憑證或資料庫加入程式或 Git。
