# 驗證紀錄

2026-10-04，`site-diorama` / `0.1.0`。原 dashboard、其他外掛及平台設定均未修改。

## 查詢口徑

六個 data blocks 均為 project scope，SDK 查詢明確傳遞 project_handle。摘要使用全部符合條件的紀錄，明細最多 20 筆。日誌摘要與明細固定篩選 Asia/Taipei 的 2026/06/01。

公開交付只含程式、查詢定義與人工測試資料；不含客戶資料、案場名稱、正式查詢結果、截圖、log、資料庫或憑證。

## 程式與瀏覽器

- `checks/data.mjs` PASS：計數口徑、缺值與零、非法日期、非法母體、不得跳過壞紀錄、全案場拒絕與每次查詢明確指定案場。
- `checks/mutations.mjs` PASS：5 個故意改壞的版本都被原檢查抓到，包含未完成件數錯用總數、容許不合法母體、缺值變零、容許全部案場、漏傳案場。不宣稱完整 mutation coverage。
- `plugin.mjs lint --strict` clean。
- `plugin.mjs check` PASS：320／375／1024px 無頁面或容器溢出，初始載入無 console error、network failure 或 rejected bridge call。
- `checks/browser.mjs` 使用真實 Studio SDK、sandbox iframe 與案場切換事件，block 回應明確模擬。驗證選案場前不查詢、每次查詢有案場 handle、摘要與明細、文字注入不生成 HTML、明細標題接收焦點、空資料、零、失敗不冒充零、案場切換清空明細、延遲的舊回應不覆蓋新案場。
- 瀏覽器實際 canvas 截圖比對：動畫關閉後畫面不變；開啟後畫面會變；旋轉改變 3D 幾何。reduced motion 與離開外掛會停止動畫，返回可恢復。
- 320／375／768／1024／1440px 檢查頁面無水平溢出、標記不重疊；截圖留在固定 evidence 目錄。
- 測試刻意模擬 503。這些 resource error 是預期錯誤，不宣稱錯誤狀態測試零 console error；正常狀態沒有未預期錯誤。

## 交付前來源檢查

依 Studio5 `docs/authoring/skills/studio5-plugin-security-review/SKILL.md` 審查本外掛。

- IMPORTS：平台 `/studio-kit.css`、`/studio-plugin.js`；自己的 app、data、scene、繁中 JSON；平台 vendor Three.js 0.186.1 與 OrbitControls，MIT。沒有來源不明腳本、遠端素材或新的 dependency。
- 無 key、token、backend、browser storage、records 寫入或第三方網路請求。交付檔案不含任何憑證。
- 資料僅進 DOM textContent；不得由資料指定 SQL、任意 URL 或可執行程式。queryModule 使用固定 block id；權限由平台 project-scoped kernel 決定。
- 此檢查不是整個平台安全審計，也不宣稱 iframe 能隔離惡意外掛。

## 未驗證與已知界線

- 瀏覽器自動檢查使用模擬 block 回應，不等同於各客戶環境的正式驗收。跨帳號、跨案場實際越權測試尚未完成。
- Safari、實體手機、screen reader、實際無 WebGL 裝置尚未驗證。無 WebGL 的文字資料退路已實作，未冒充裝置驗收。
- 第一版幾何場景無真實 BIM／空間座標／進度，不代表實際工程位置。明細只提供前 20 筆，無分頁。
- 原 dashboard 使用者釘選不在本外掛內；沒有私下讀取或改寫 dashboard API。

## 固定日期與套件

`checks/diary-date.mjs` 通過；兩種錯誤日期 mutation 均被抓到。日期版本的瀏覽器檢查已重跑通過，涵蓋案場切換、指定日期標示、當日無資料及動畫停止。截圖比對會等待停止狀態與最終 GPU 畫面。

ZIP 已產生且逐檔與來源比對一致。正式環境驗證紀錄與畫面不列入公開版本。
