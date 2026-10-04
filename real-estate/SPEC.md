# 實價登錄(sample)

## 目標與範圍

開源、安裝在客戶 Studio5 的查詢範例。任何使用者都不需申請 key，套件不含開發者或客戶憑證，不建置雲端服務。依最新決定先交付單純查詢，不內嵌地圖，也不做疊圖。

- 縣市必填；行政區、地址片段選填。只查房屋買賣，排除特殊交易與純土地。
- 使用 ToEstate 公開 REST API `/api/transactions`，經客戶 Studio5 的 `studio.http.fetch` 存取；與 ToEstate MCP 共用資料。不新增 MCP client 或後端。
- 每頁 20 筆，分頁使用伺服器 offset；明確顯示本頁範圍，不把本頁筆數說成全區總數。滿頁時允許試下一頁；空頁可返回。
- 顯示成交日期、地址／社區、總價（萬元）、單價（萬元／坪）、坪數、樓層、屋齡與型態。缺值顯示「未提供」，不轉為零。
- 每筆以 `studio.openExternal` 開啟免 key 的 Google Maps 地址搜尋。這只是地址搜尋，不宣稱精確定位或疊圖。
- 顯示資料來源、價格口徑、申報延遲、公開服務限制。查無資料、失敗、限流皆有可操作的訊息。
- 查詢不自動發送；按「查詢」才發送。修改條件後舊結果清空，避免錯配。失敗時保留重試與返回能力。

## 最小實作

`real-estate/plugin/real-estate/` 放 manifest、HTML、CSS、英文 JavaScript 與獨立繁中內容 JSON。`checks/` 放 Node 原生 assert 與瀏覽器檢查。沿用 Studio5 Component Kit、`studio.fmt`、`studio.http`、`studio.openExternal`；不新增 dependency。

## 驗證與交付界線

1. 原生 assert：參數編碼、分頁、格式／金額單位、缺值、非法回應、Google Maps URL。
2. 對核心參數與價格轉換做可執行 mutation check，確認檢查能抓到錯誤。
3. Studio5 `plugin.mjs lint --strict`，逐項審查 IMPORTS。
4. 隔離的 `plugin-dev.mjs` 使用真實 SDK：真實查詢、分頁、空結果、HTTP 429／失敗、外部連結、鍵盤及 320／375／768／1024px 版面。刻意替換的錯誤回應只驗證錯誤狀態，不當成真實資料證據。
5. 在 README 記錄可重跑命令及實際結果。不 install 到正式 Studio5，不 commit／push／部署。

官方來源：[ToEstate MCP](https://toestate.tw/mcp-guide)、[REST API](https://toestate.tw/api/docs)、[Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)。本次實測 REST API 可匿名查詢，仍有 rate limit；外部服務政策變動時 sample 可能不可用。
