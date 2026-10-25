# 會議筆記 plugin

獨立 Studio5 app plugin。錄音交由 Azure Speech 轉錄；文字處理沿用 Studio5 的 `studio.ai.complete`，使用平台已設定的模型路由。沒有 Groq，也不需要 GPU。

## 操作

1. 在 Studio5 選擇案場，填寫會議名稱與最多說話者人數。按「開始錄音」使用 Studio 錄音視窗，或選擇既有音檔；人名與工程用語可選填。
2. 「開始轉錄」取得原始轉錄、時間與說話者編號。編號用來區分聲音，不代表已辨識真實姓名。
3. 「整理全文／接續處理」依原發言順序修整錯字、標點與段落，保留例子、否定、條件、疑慮、強調及反對立場。每段可展開原始轉錄對照、直接校正；已完成批次會儲存。
4. 全文完成後，再按「產生會議摘要」，得到主旨、議題、結論及原文依據，區分已決議、提議與未定案。
5. 原始轉錄、全文與摘要可分別匯出 Markdown；原始轉錄不必等全文整理完成就能下載備份。已存會議可從案場清單重開。修改全文會清除舊摘要，須重新產生。
6. 他人已修改同份會議時，由 Studio 共用對話框決定使用自己的版本、伺服器版本或稍後處理。稍後重新開啟會議可恢復未處理的修改；選用伺服器版本會停止本次後續 AI 處理，避免再覆蓋已選定內容。

沒有角色觀點、角色版摘要、額外知識或類比功能。

## 錄音與版面（0.3.0）

- 桌面為左側較寬全文、右側較窄會議摘要；窄螢幕上下排列。
- Studio 使用 SDK 3.12.0 的 `studio.audio.record`，宿主控制麥克風、計時與停止／取消，單次最多 2 小時；停止後存入本專案的會議筆記文件夾，可試聽、下載或開始轉錄。
- 錄音期間請勿關閉分頁，停止前內容仍在宿主記憶體中；取消或切換專案會丟棄未保存的錄音。停止並保存後，原始音檔留在文件中心，不隨轉錄暫存清除。
- 外掛宣告錄音及文件讀取權限，不放寬 iframe 隔離；升級須同意新增權限，草稿預覽不能錄音。
- 文件讀取上限 64 MiB；超限或讀取失敗仍可下載文件中心的原始錄音，再由既有音檔上傳入口轉錄，或按開始轉錄重試讀取。
- Chrome for Testing 已以真正外掛、平台 SDK／bridge／錄音視窗與文件服務，在 opaque iframe 中驗證虛擬音源錄製、取消、停止保存、版本讀取、試聽、解碼及音軌釋放。這不代表正式站或真實麥克風已驗收。[整合細節](docs/platform-recording.md)。
- 獨立 localhost 頁面在沒有宿主錄音 SDK 時沿用原生 MediaRecorder 供開發檢查；音檔只在分頁記憶體內，須下載備份，約 128 MiB 或接近 5 小時自動停止。

## 安裝與設定

`plugin/meeting-notes/` 是靜態 plugin 安裝來源；`backend/` 是其專用的輕量 API 後端，負責驗證 Studio 身分、接收分段上傳及呼叫 Azure Speech。它不執行語音模型。

- 後端需 Node.js 22.17+、`ffmpeg` 與 `ffprobe`，並能連到 Studio5 與 Azure。
- `plugin.json` 的 `backend.url` 為 `http://127.0.0.1:8937`、`backend.data_dir` 為 `data`。後端放在 Studio 主機上，僅監聽 loopback。developer-run 由平台注入 `PORT` 與 `DATA_DIR`；暫存預設為 `DATA_DIR/scratch`，`MEETING_NOTES_SCRATCH` 可明確覆寫。
- 依 Studio5 自有後端部署方式放置服務包，保留 `server.mjs`、`backend/` 與 `plugin/meeting-notes/model.mjs` 的相對位置。服務包根目錄的 `server.mjs` 是正式啟動入口，支援平台的 `backend-deploy` 約定。
- 依 `backend/.env.example` 準備伺服器環境變數；真正金鑰不能放在靜態 plugin 目錄或版本控制中。
- `STUDIO5_URL` 必須指向實際 Studio，以取得簽章公鑰。`AZURE_SPEECH_ENDPOINT` 使用 Azure Speech／AI Services 資源 endpoint，不能填 Foundry project endpoint。
- launchd 的 PATH 未必包含音訊工具；以 `FFMPEG_BIN`、`FFPROBE_BIN` 指定絕對路徑（Mac Homebrew 通常在 `/opt/homebrew/bin/`）。未設定時才從 PATH 找 `ffmpeg`／`ffprobe`。由 Studio 確認工具與私有設定的供應方式，不包含在公開包中。
- 文字 AI 使用 Studio 現有路由；須確認部署環境的路由確實已連到你們的 Foundry 模型。本 plugin 不另存模型金鑰。

在服務包根目錄，將真正設定存入權限為 `0600` 的 `backend/.env`，再啟動：

```sh
node server.mjs
```

入口使用 Node 原生 `loadEnvFile` 載入該設定。安裝靜態 plugin 不會自動啟動後端；由主機既有服務管理方式維持後端程序。正式安裝、服務部署及市集發布尚未執行。

新版 SDK 檢查成功後會產出兩個可交付檔案，目前版本位於 `releases/0.3.1/`（檢查產物於 `/Volumes/Vibe-Temp/meeting-notes/releases/0.3.1/`）：

- `meeting-notes-0.3.1.zip`：交給目前 Studio 的 `plugin.mjs install` 安裝；使用固定 ZIP 中繼資料，並經官方安裝函數驗證解包後內容一致。
- `meeting-notes-backend-0.3.1.tar.gz`：交給主機既有後端部署流程；包含根目錄入口、執行所需程式、設定範例與本文件，不包含金鑰、真實 `.env`、錄音或測試資料。

重建交付檔案：`python3 meeting-notes/checks/package-release.py <output-directory>`。僅使用 Python 標準庫；ZIP 用儲存模式避免壓縮器版本差異，tar.gz 固定檔案順序、mtime、uid/gid 及 gzip 時間。官方打包器使用當下時間，故未用於此次 SHA 重建交付；官方安裝及檢查流程仍照常執行。

主機若採平台的 developer-run backend：先解包成獨立 source-dir，再由主機既有 `studio-developer.mjs backend-deploy meeting-notes <source-dir>` 部署；首次服務啟用與真正 `backend/.env` 設定由主機管理員完成。請使用部署主機的目前 Studio 版本，勿使用本機舊工作目錄。

## 資料與限制

- 音檔不超過 499 MB、短於 5 小時；後端轉為單聲道 FLAC 後也必須小於 500 MB。這符合 [Azure Fast transcription 的限制與單聲道說話者區分需求](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/fast-transcription-create)。
- 使用 `2025-10-15` API、`zh-TW`、說話者區分及可選的專有名詞清單。關閉 profanity filtering，避免替換原話。
- 原始轉錄、全文、摘要以 `meetings` collection、`v1` schema 保存到選定案場；以版本號防止覆蓋他人修改。
- 後端處理的音檔副本只暫存，轉錄成功或失敗後立即清除；未完成上傳閒置 30 分鐘後清除。文件中心的原始錄音不受暫存清除影響。預設暫存位於 `/Volumes/Vibe-Temp/meeting-notes/uploads`；未掛載時退回專案 `.tmp/uploads` 並輸出警示。非 macOS 主機可設定 `MEETING_NOTES_SCRATCH` 到專用資料碟。
- 每個後端程序最多 4 個工作，轉錄含轉檔逾時 20 分鐘。伺服器重啟會中斷未完成工作；異常斷電遺留的暫存目錄需由維運清除。
- 目前單份紀錄上限 1,000,000 bytes。全文每批約 1,600 字元（含結構資料），配合平台 4,096 output tokens 上限；單段過長會明確停止，不截斷。摘要整合若超過 19,000 字元，也會停止並保留全文。
- 段落數量、順序、長度與引用檢查是防漏機制，不能證明語意完全忠實。真實中文多人錄音仍須核對否定、條件、反對意見與決議；合成音訊測試不能取代這項驗收。

## 可重跑檢查

從 repo 根目錄執行，前兩項只需 Node 與本機 ffmpeg，不呼叫付費 API：

```sh
node meeting-notes/checks/model-check.mjs
node meeting-notes/checks/backend-check.mjs
node meeting-notes/checks/current-sdk-check.mjs
```

`current-sdk-check.mjs` 從 Studio Git repository 更新並核對遠端 `origin/main`，在暫存目錄展開該版本，執行新版平台的正式 `plugin check`。它以平台 `assembleSdk()` 產生預期內容，再比對瀏覽器實際收到的 `/studio-plugin.js` SHA-256；不讀取舊工作目錄的 SDK、樣式或平台程式。Chrome console／CDP 如有 `unload` 訊息會列出來源並使檢查失敗。

依賴套件沿用已安裝的版本，主線自帶的本地套件從該版本的 vendor 檔案展開；所有可寫入快取、瀏覽器 profile 與平台資料均放在 `/Volumes/Vibe-Temp/meeting-notes/checks`，完成或失敗後清除。不同環境用 `STUDIO5_REPOSITORY` 指定 Git repository、`CHROME_FOR_TESTING` 指定瀏覽器。既有 Studio 工作目錄不會被更新或覆寫。

平台檢查後，還會使用同一版本的樣式跑 `browser-check.mjs` 的兩段流程、保存重開、失敗復原及專案切換測試。這一項仍使用模擬 SDK／ASR／模型回應，與前面的真實 SDK 載入檢查分開計算；單獨執行它須明確提供 `STUDIO5_ROOT`，不再默認使用相鄰的舊工作目錄。

`model-check.mjs` 含 5 個 mutation checks，確認漏段、額外段落、錯序、過度縮寫、虛構引用與整合漏證據會被檢查擋下。

上述新版平台檢查已包含 strict lint、bridge／網路錯誤及 320／375／1024px 溢出檢查；它使用隔離的 Studio 開發環境，仍不是正式安裝驗收。

`checks/azure-check.mjs <resource-group> <resource-name>` 是**會產生 Azure 用量的獨立檢查**：使用 Azure CLI 讀取資源 endpoint 與 key（只留在程序記憶體），在 macOS 以兩個系統聲音產生 `checks/transcript.json` 中的合成中文對話，測試真實 Speech API，結束後清除音檔。不要放入預設離線測試流程。

## 契約差異

初次實作時，舊工作目錄的 `guidance/data.md` 與 `store.mjs` 對 `records.list.select` 的描述不一致；這不是目前主線文件仍有問題的證據。本 plugin 不使用 `select`，目前主線驗證的清單呼叫沒有被拒絕。

## 2026-10-24 驗證結果

| 檢查 | 結果與範圍 |
| --- | --- |
| 兩段處理核心 | 通過；段落覆蓋、重試接續、引用有效性、整合漏證據，以及 5/5 mutation 被偵測 |
| 後端 | 通過；真實 Ed25519 簽章、案場／使用者隔離、分段上傳、工作容量、實際 ffmpeg 轉檔、暫存清除；Speech 回應模擬 |
| Chrome for Testing 操作 | 通過；保存重開、全文修改使摘要失效、儲存衝突、AI 失敗、專案切換、文字安全顯示、390px 無溢出；SDK／AI 模擬 |
| Studio5 strict lint | 通過，沒有警告 |
| 舊本機環境 `plugin check` | **未通過**；`Permissions policy violation: unload is not allowed in this document.`。此結果來自過時的本機 Studio5 工作目錄，不能代表目前主線或上線環境；網路／bridge 無失敗，320／375／1024px 無溢出 |
| 舊環境基準比對 | 同一舊環境的 `inspection-request` 也出現警告，僅能證明該環境有共通問題，不能據此判定現行平台仍有問題。當時沒有保存瀏覽器的來源檔案與行號，不能把本機原始碼行號當作瀏覽器追蹤證據 |
| Azure 真實轉錄 | 成功呼叫現有 AI Services 資源。第一組 19.04 秒、兩個合成聲音被合併為 1 位；改用音色更不同的合成聲音後，19.656 秒被分成 2 段、2 位說話者，保留提議、否定、反對與未定案的關鍵詞。兩組均有錯字，**真人多人會議品質尚未驗收**。首次設定查詢逾時，延長等待後成功 |
| 正式安裝／真人錄音 | 尚未執行；待後端安全設定完成、目前平台環境驗證及中文多人錄音核對；不要求零錯字 |

## 2026-10-25 SDK 判斷更正

已確認 `origin/main`（目前本機遠端追蹤版本 `1bcd88f8`）的 `src/studio-plugin.js` 使用 `pagehide`／`pageshow`，沒有 `unload` 事件監聽。修正提交為 `5e5ffb251ca98891074fb008778d8d0603d1cb22`，日期為 2026-09-27。

本 plugin 使用 `/studio-plugin.js`，不內嵌 SDK 副本；plugin 原始碼也沒有 `unload` 監聽。先前「平台仍有 unload 問題」的判斷撤回。上線 SDK 已無該監聽是使用者提供的驗證結果；本次 Chrome DevTools 連線受既有 browser profile 衝突阻擋，尚未取得上線瀏覽器 console 的來源檔案／行號。後續如再出現警告，應先擷取當下載入的 SDK URL、版本及 console 來源，再判斷歸屬。

## 2026-10-25 改用新版 SDK 的驗證

- 版本：遠端 `origin/main`，提交 `1bcd88f8e611f47b83b0062efa263f2c2a05ea26`。
- 瀏覽器實際收到新版平台組合後的 SDK，SHA-256：`02592baf0ee726cef15cc5ccbf78bdadaa8cbca4a852c3b8be651c0dee6109cd`，與主線 `assembleSdk()` 輸出一致。
- 官方 `plugin check`：**PASS**，沒有 `unload` 警告、bridge 拒絕、網路檢查失敗或三種寬度溢出。authoring 能力探測的預期 403 由官方 checker 明確排除，額外的 console 診斷仍有列出，未隱藏原始訊息。
- 兩段筆記操作檢查：**PASS**，使用新版樣式；SDK／ASR／AI 仍為模擬資料，不能當作完整線上串接證據。
- 新版 lint 無阻擋錯誤，但有 **4 項提示**：會議名稱、說話者上限、專有名詞欄位缺少 `autocomplete`；保存流程尚未接新版 `sync.resolveConflict`／`resumeConflict` 共用對話框。現行衝突行為會停止保存並保留本頁內容，本次沒有擴大修改衝突處理流程。
- 正式 plugin 持續載入主機提供的 `/studio-plugin.js`；本次更換的是驗證依據與工具，沒有部署或覆寫正式 Studio。

## 2026-10-25 開發收尾

上述 4 項提示已修復：三個欄位設定 `autocomplete="off"`，保存與重開接上新版 SDK 共用的衝突處理及恢復流程。已驗證稍後處理、採用我的版本、採用伺服器版本、重新開啟恢復草稿。重新執行新版 SDK 檢查為零 lint 警告。

程式與交付包完成；交付檢查另包含 ZIP 經官方安裝函數安裝後的內容核對，以及後端包解壓後實際啟動、環境設定載入、未授權請求拒絕與乾淨關閉。真實錄音依使用者指示留到上線後測試，不作為本次開發完成前提。正式部署與實際 Foundry 路由仍須在目標主機設定與確認。

## 2026-10-25 宿主錄音接入（0.3.0）

已接入平台最終錄音契約，前述 0.2.0「正式 iframe 不能錄音」的限制已由宿主介面解決。以 `origin/main` `86ec85af` 驗證實際 SDK（SHA-256 `8bd9fbfbee6b5b6619f9d565547c67de30b983e0a0ed6fa0e138ab92c0850b29`），官方 strict check 通過、零 lint 警告。真正 opaque iframe、錄音視窗、文件保存／釘選讀取、試聽及 ffmpeg 解碼的虛擬音源整合檢查通過；未使用正式站登入或真人麥克風。此版本須完成目標安裝驗證，再由 Studio 簽章並取得使用者最後上架確認。
