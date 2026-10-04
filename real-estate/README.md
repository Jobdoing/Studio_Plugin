# 實價登錄(sample)

安裝在客戶 Studio5 的開源查詢範例。**不需 API key、不含我們的憑證、不使用我們的雲端、不新增後端或 npm dependency。**

輸入縣市、行政區與路名／地址片段，查詢房屋買賣成交。結果以卡片顯示成交日期、社區／地址、總價、單價、坪數、樓層與屋齡，每頁 20 筆。每筆可開啟 Google Maps 地址搜尋；依最新需求，這一版不內嵌地圖，也不提供疊圖。

## 資料與網路

資料流：`plugin → 客戶 Studio5 的 studio.http.fetch → https://toestate.tw/api/transactions → 成交列表`。

- 使用 [ToEstate 公開 REST API](https://toestate.tw/api/docs)，與其 [MCP](https://toestate.tw/mcp-guide) 共用資料；不是 MCP client。2026-10-04 已實測匿名 HTTP 200，有 rate limit，外部服務政策可能改變，不保證永久免費或持續可用。
- 原始來源為內政部地政司實價登錄；顯示回應內的 attribution。排除特殊交易與純土地，只查 `txn_kind=sale`。
- 總價可能含車位；單價與坪數依 ToEstate 口徑扣除車位，坪數含公設。申報約延遲 1–3 個月；地址可能經模糊化，不作精確定位或估價。
- 每頁最多 20 筆，不宣稱全區總數。上游沒有 `has_more`；最後一頁剛好滿 20 筆時，再按下一頁可能為空，可返回上一頁。
- 查詢條件會送到 ToEstate，不傳送 Studio 身分／token。只在使用者點選地圖按鈕、並通過 Studio 原有的離站確認後，將該筆地址交給 Google。
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) 不需 key；不是 Google Maps JavaScript API，不呼叫付費地圖 API。

## 套件結構與安裝

`plugin/real-estate/` 為可安裝的外掛目錄，manifest id 為 `real-estate`，版本 `0.1.0`。HTML／CSS／JavaScript 均為純靜態檔；繁中顯示內容獨立存於 `content.zh-Hant.json`，程式碼與註解使用英文。

可安裝 ZIP：[releases/real-estate-0.1.0.zip](releases/real-estate-0.1.0.zip)。ZIP 根目錄包含 `plugin.json`，也可把上面的 install 路徑替換為此 ZIP。

需要支援 `studio.http`、`studio.fmt`、`studio.openExternal` 與 Component Kit 的 Studio5；本次以 SDK `3.3.0` 驗證。套件不複製 Studio5 SDK，也沒有第三方腳本。

盒主在自己的 Studio5 repo 執行以下命令即可安裝，不需要建立 key 或資料庫：

```sh
node scripts/plugin.mjs install /path/to/studio5-plugins/real-estate/plugin/real-estate --strict
```

2026-10-04 已依使用者指示安裝到正式 M2 的 Studio5，版本 `0.1.0`，strict lint clean。公開站驗證被導向 Jobdone 登入頁，登入後的正式查詢尚未確認；本機真實查詢驗證見 CHECKS.md。

## 可重跑檢查

從 `studio5-plugins` 根目錄執行：

```sh
node real-estate/checks/data.mjs
node real-estate/checks/mutations.mjs
```

Studio5 契約／瀏覽器通用檢查（以下為本機路徑；換機時改成自己的 checkout）：

```sh
mkdir -p /Volumes/Vibe-Temp/studio5-plugins/real-estate/tmp
TMPDIR=/Volumes/Vibe-Temp/studio5-plugins/real-estate/tmp node /Volumes/AI-Model/Studio5/scripts/plugin.mjs lint /Volumes/AI-Model/studio5-plugins/real-estate/plugin/real-estate --strict
TMPDIR=/Volumes/Vibe-Temp/studio5-plugins/real-estate/tmp node /Volumes/AI-Model/Studio5/scripts/plugin.mjs check /Volumes/AI-Model/studio5-plugins/real-estate/plugin/real-estate
```

功能檢查需先在一個 terminal 啟動隔離預覽，在另一個 terminal 執行瀏覽器檢查：

```sh
mkdir -p /Volumes/Vibe-Temp/studio5-plugins/real-estate/evidence
TMPDIR=/Volumes/Vibe-Temp/studio5-plugins/real-estate/tmp node /Volumes/AI-Model/Studio5/scripts/plugin-dev.mjs --blocks /Volumes/AI-Model/studio5-plugins/real-estate/plugin/real-estate --data /Volumes/Vibe-Temp/studio5-plugins/real-estate/preview --port 5220 --maintenance-port 5221
```

```sh
TMPDIR=/Volumes/Vibe-Temp/studio5-plugins/real-estate/tmp STUDIO5_ROOT=/Volumes/AI-Model/Studio5 EVIDENCE_DIR=/Volumes/Vibe-Temp/studio5-plugins/real-estate/evidence node real-estate/checks/browser.mjs
```

瀏覽器檢查使用既有 Studio5 的 puppeteer-core 與本機 Chrome，不替外掛新增 dependency。log、隔離 runtime 與截圖固定存於 `/Volumes/Vibe-Temp/studio5-plugins/real-estate/`；若該磁碟未掛載，需改用專案內固定暫存目錄。

驗證紀錄另見 `CHECKS.md`；規格見 `SPEC.md`。專案根目錄的 Apache 2.0 授權適用於程式碼，政府資料與外部服務各依原來源條款。
