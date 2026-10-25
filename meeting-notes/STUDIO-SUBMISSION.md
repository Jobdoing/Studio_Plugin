# Studio 上架提交：會議筆記 0.2.0

- 原始碼送審：[Studio_Plugin PR #3](https://github.com/Jobdoing/Studio_Plugin/pull/3)
- Studio 上架交付：[Studio Issue #22](https://github.com/jobdone-cc/Studio/issues/22)
- 狀態：已提交，暫不上架。使用者於 2026-10-25 要求先完成正式 Studio 內的直接錄音與驗證，再進行簽章與上架。

## 識別與安裝來源

- Plugin id：`meeting-notes`
- 顯示名稱：會議筆記
- 版本：`0.2.0`
- 原始碼：本目錄 `plugin/meeting-notes/`
- Plugin 安裝包：`releases/0.2.0/meeting-notes-0.2.0.zip`
- 後端服務包：`releases/0.2.0/meeting-notes-backend-0.2.0.tar.gz`
- 完整性核對：`releases/0.2.0/SHA256SUMS`
- 授權：沿用 repo 根目錄 Apache-2.0。

## 上架內容

中文會議錄音交由 Azure Speech 轉錄並區分說話者；先整理保留內容、語氣、例子、否定與反對立場的易讀全文，再產生主旨、議題、結論與原文依據。提議、已決議與未定案分開呈現。桌面全文／摘要左右分欄，手機上下排列；支援案場保存、重開、修改、原始轉錄及兩段成果分別匯出。

沒有角色觀點或額外知識功能。文字 AI 沿用 Studio 的 `studio.ai.complete`，由部署端確認現有 Foundry 路由。

## 請 Studio 處理

1. 審核並簽署 plugin ZIP，加入官方外掛通道；簽章及正式上架尚未由本提交執行。
2. 部署後端服務包，確認 `127.0.0.1:8937` 可用；服務包根目錄 `server.mjs` 為啟動入口，符合既有 backend-deploy 目錄約定。
3. 以私有、權限 `0600` 的 `backend/.env` 設定 `STUDIO5_URL`、`AZURE_SPEECH_ENDPOINT`、`AZURE_SPEECH_KEY`；真正金鑰沒有包含在原始碼或交付包。
4. 在目標 Studio 驗證安裝與服務設定。使用者同意真實中文多人會議錄音於上線後測試，不要求零錯字。
5. 完成宿主錄音介面及 plugin 接入：[平台整合需求](docs/platform-recording.md)。目前 Studio iframe 的隔離設定禁止 plugin 直接開啟麥克風；這是上架前必須解決的項目。保留音檔上傳作為替代入口，不代表直接錄音已完成。

## 後端部署需求與責任

- 執行環境：Node.js 22.17+，PATH 可執行 `ffmpeg`、`ffprobe`；入口為服務包根目錄 `server.mjs`。
- 網路：預設只監聽 `127.0.0.1:8937`，透過 Studio backend proxy 呼叫；需能連線至 `STUDIO5_URL` 驗證憑證，以及設定的 Azure Speech endpoint。
- 機密：部署方在服務端建立權限 `0600` 的 `backend/.env`，設定 `STUDIO5_URL`、`AZURE_SPEECH_ENDPOINT`、`AZURE_SPEECH_KEY`。金鑰不交給瀏覽器、不放入 plugin ZIP 或公開服務包。
- 寫入資料：上傳音檔、轉檔結果暫存於 `MEETING_NOTES_SCRATCH`；預設 `/Volumes/Vibe-Temp/meeting-notes/uploads`，未掛載則使用專案 `.tmp/uploads` 並警示。其他主機應由部署方指定專用暫存目錄。音檔在成功、失敗或正常服務關閉時清除，未完成上傳閒置 30 分鐘後清除；非正常終止的清理行為仍需部署驗證。
- 保存成果：轉錄、全文與摘要透過 Studio 專案儲存介面保存；目前 browser 錄音僅在記憶體中，持久保存方式須與宿主錄音介面一起確認。
- 責任：外掛方提供服務包、需求及整合檢查；平台方確認託管方式、部署負責人與機密配置，尚未確認，也尚未自行部署到客戶機器。

## 已有證據

- 驗證 SDK：遠端 `origin/main`，提交 `1bcd88f8e611f47b83b0062efa263f2c2a05ea26`。
- 瀏覽器收到組合後 SDK 的 SHA-256：`02592baf0ee726cef15cc5ccbf78bdadaa8cbca4a852c3b8be651c0dee6109cd`，與平台 `assembleSdk()` 輸出一致。
- 官方 plugin check：PASS；strict lint 零警告，沒有 unload 警告、bridge 拒絕或檢查判定的網路失敗，320／375／1024px 無溢出。
- 操作檢查：保存、重開、四種衝突處理、專案切換、左右欄／手機版面通過；SDK 與 ASR／AI 回應為模擬。
- 原生 MediaRecorder：虛擬音源驗證權限拒絕、錄音、停止、下載、WebM 轉檔、轉錄銜接及音軌釋放，沒有使用真人麥克風。
- 後端：簽章驗證、使用者／案場隔離、上傳限制、轉檔與暫存清除通過；ZIP 經官方安裝函數安裝核對，服務包解壓後啟動及關閉清理通過。
- 核心邏輯：5/5 mutation checks 偵測到錯誤。
- 現有 Azure 資源曾成功轉錄合成中文，第二組約 20 秒回傳兩位說話者；實際中文會議品質及正式 Foundry 全流程仍待目標環境驗證。

## 重跑

從 repo 根目錄執行：

```sh
node meeting-notes/checks/model-check.mjs
node meeting-notes/checks/backend-check.mjs
node meeting-notes/checks/current-sdk-check.mjs
```

`current-sdk-check.mjs` 從目前平台主線建立隔離環境，核對實際 SDK，再跑檢查、打包、安裝與後端啟動核對，不使用舊工作目錄中的 SDK。所需 Node、Chrome for Testing、ffmpeg 與套件位置見 [README](README.md)。真實 Azure 測試為獨立、有用量的命令，不包含在上述離線檢查內。
