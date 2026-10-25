# Studio 宿主錄音整合

2026-10-25 使用者決定：錄音解決再上架。平台 PR #25 已合併；Studio session 回報 m2-studio5 0.6.5、m2-aha-demo／onlywin 0.4.5 已發布宿主錄音。外掛 0.3.0 已接入最終介面；正式站安裝與真實麥克風驗證尚待進行，不能與本機整合檢查混稱完成。

## 實際流程

1. 使用者直接按「開始錄音」，呼叫 `studio.audio.record({project_handle})`；不在點擊前後插入非同步工作而失去使用者啟動狀態。
2. Studio 宿主控制麥克風、計時、停止／取消，最多 2 小時。取消回 `null`，不讀取文件，也不顯示失敗。
3. 停止後宿主把錄音存入這個外掛在本專案的文件中心系統資料夾，回傳音檔中繼資料與 `doc:<id>@<version>`。
4. 外掛驗證回傳資料，透過 `studio.docs.fetch(ref, {}, {project_handle})` 讀回釘選版本，建立試聽與既有轉錄流程。Safari MP4 以 M4A 檔名交給既有 ffmpeg 轉檔流程。
5. 下載使用 `studio.docs.download`；轉錄紀錄保留來源文件參照，後端只清除處理副本，不刪除原始文件。

## 權限與失敗處理

- `uses["audio-record"]: true`、`uses["studio-docs"]: {"access":"read"}`；文字處理另宣告 `uses.ai`。新增權限需使用者同意。
- 不需要 `docs:write` 或 iframe 麥克風 capability，也不加入 `allow-same-origin`。草稿預覽會回 `DEVELOPER_SCOPE`。
- 權限拒絕、其他外掛忙碌、缺少點擊與離線均有對應說明；失敗後可重試。
- SDK 文件讀取上限 64 MiB。較大錄音仍留在文件中心，可下載後由原有選擇音檔入口轉錄；讀取失敗不把錄音標成已載入。
- 專案切換後忽略先前錄音及讀取結果，不把音檔或轉錄送入新專案。

## 已知限制

錄音停止前在宿主記憶體中；分頁當機／關閉會遺失這段，離開或切換專案會丟棄未保存內容。畫面明示錄音時勿關閉分頁。未實測 Safari、手機或連續 2 小時記憶體負載。

## 可重跑驗證

`node meeting-notes/checks/current-sdk-check.mjs` 從目前平台 `origin/main` 建立可刪除的隔離環境，執行：

- 官方 strict lint、實際 SDK 核對、桌面／窄螢幕檢查。
- Chrome for Testing：模擬 SDK 的取消、權限／忙碌／草稿錯誤、讀取失敗後下載及重試、跨專案結果隔離、轉錄銜接。
- `host-browser-check.mjs`：真正外掛安裝、opaque iframe、平台 SDK／bridge／錄音視窗、虛擬麥克風、真正文件服務保存及版本讀取、試聽、音軌釋放、ffmpeg 解碼。
- `recorder-check.mjs`：參照釘選、專案參數、M4A 命名、不完整中繼資料、大小上限及實際內容大小。

上述未使用正式站登入或真實麥克風。實際中文會議的辨識與兩段文字品質仍依使用者要求，在目標部署完成後驗證。
