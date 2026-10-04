# 驗證紀錄

2026-10-04，外掛 `real-estate` / `0.1.0`。以本機 `/Volumes/AI-Model/Studio5` 的 SDK `3.3.0`、真實 `plugin-dev.mjs` 隔離 runtime 及 Google Chrome 驗證。重跑命令見 README。

## 已完成

- `checks/data.mjs`：PASS。查詢 URL 固定 ToEstate；字串與分頁參數正確編碼，排除特殊交易／純土地。總價、單價各自除以 10,000；缺值不變成零，地下樓層可為負數。畸形回應整頁報錯，不丟棄單筆。Google Maps URL 無 key。
- `checks/mutations.mjs`：PASS。5 個 mutation 全部被原檢查抓到：錯誤每頁筆數、納入特殊交易、單價換算錯誤、缺失總價變成零、Maps URL 版本錯誤。這是範圍限定的品質檢查，不宣稱完整 mutation coverage。
- Studio5 `plugin.mjs lint --strict`：clean。
- Studio5 `plugin.mjs check`：PASS。320／375／1024px 無溢出；初始載入無 console error、network failure 或 rejected bridge call。此通用檢查沒有代替下列真實查詢檢查。
- `checks/browser.mjs`：PASS。320／375／768／1024px 均以實際 `studio.http.fetch` 查詢臺北市大安區，回傳 HTTP 200、每頁 20 筆；成交卡片與實際回應的總價、單價、地址逐項比對。進入下一頁時 offset 為 20、條件保留且交易 ID 改變。
- Google Maps 按鈕經真實 Studio5 離站確認後開啟 Google 網頁，query 等於該筆地址；不使用 Maps JavaScript API。
- 表單 Enter 可查詢，欄位有 label，顯示的按鈕／輸入欄符合 44px 操作高度，手機與桌面截圖已查看。
- 可控注入 HTTP 429、503、空頁及延遲回應，驗證限流／失敗訊息、重試、返回上一頁、清除舊資料及條件改變後拒絕舊回應。注入含 HTML 的地址，DOM 仍只有文字，不生成 img／script。
- 真實查詢沒有 console error。錯誤狀態測試刻意注入的 429、503 各產生一個瀏覽器 resource error，兩個均有記錄與斷言，沒有隱藏或當成真實服務失敗。

## 來源與邊界檢查

依 Studio5 的 `docs/authoring/skills/studio5-plugin-security-review/SKILL.md` 檢查交付範圍。

- 外掛僅引用 `/studio-kit.css`、`/studio-plugin.js`、自己的 CSS／module／繁中內容 JSON；無第三方 JS、npm dependency、key、token、backend 宣告或 browser storage。IMPORTS 沒有未解釋的來源。
- 外部成交資料只透過 `textContent`／DOM node 顯示；查詢參數使用 URLSearchParams。沒有 innerHTML／eval／任意遠端 script。
- 查詢目標固定 `https://toestate.tw/api/transactions`，走 Studio5 公開 HTTP relay；回應錯誤清空舊成交資料。Google URL 固定 `https://www.google.com/maps/search/`；資料說明按鈕固定 ToEstate MCP 教學頁。
- 未修改 Studio5 核心、其他外掛、runtime 設定或客戶資料。沒有 commit／push；正式安裝紀錄如下。

## 正式安裝

- 2026-10-04 依使用者指示，以 `plugin.mjs install --strict` 安裝到 M2 `/opt/studio5/runtime/blocks/real-estate`，結果 `real-estate@0.1.0`、lint clean。平台 PID 維持 705，未重啟。
- 安裝 ZIP SHA-256：`8cc60070605e46397bd638748596c428093f8861eb85c882980c1680766b8c8d`，本機與 M2 一致。
- 公開站開啟預覽及外掛頁時被導向 Jobdone 登入頁，未取得外掛 iframe，因此正式站查詢未驗證。臨時 developer session 已撤銷；沒有更改驗證或登入設定。
- M2 未掛載 `/Volumes/Vibe-Temp`；ZIP 固定放在 `/opt/studio5/runtime/plugin-packages/real-estate/`。

## 限制與未驗證

- ToEstate 當日允許匿名查詢，不代表永久免費、不限量或有 SLA；實際 429 狀態由注入驗證，沒有故意耗盡其服務額度。
- 不提供地圖底圖、疊圖、全區成交總數、估價或投資判斷。
- Google 地址搜尋不保證精確門牌位置；本次驗證外部連結與參數，沒有驗證每筆地址的實際地圖位置。
- 正式 M2 安裝已完成，但登入後的正式瀏覽器查詢、不同 Studio5 版本、Safari、實體手機及 screen reader 尚未驗證。本機已完成 Chrome 版面尺寸與鍵盤檢查。
- 本檢查不是整個平台安全審計，也沒有證明 iframe 能隔離惡意外掛。

log、截圖與隔離 runtime：`/Volumes/Vibe-Temp/studio5-plugins/real-estate/`。交付原始碼與套件留在本專案 `real-estate/`。
