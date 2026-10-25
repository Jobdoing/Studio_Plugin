# 會議筆記 0.3.1 交付報告

## 版本與交付物

- 原始碼：[accb7690f618e6426efa6f9bf4ac948d07de4383](https://github.com/Jobdoing/Studio_Plugin/commit/accb7690f618e6426efa6f9bf4ac948d07de4383)。固定於 [PR #3](https://github.com/Jobdoing/Studio_Plugin/pull/3) 的專案分支，尚未合併主線；主線 commit 條件須在審查合併後確認，不能把分支 SHA 稱作主線。
- Plugin：`releases/0.3.1/meeting-notes-0.3.1.zip`，SHA-256 `403c70f3a140178b315dfc30451539628dcac0df37b941e6759f275223e31f73`。
- 後端：`releases/0.3.1/meeting-notes-backend-0.3.1.tar.gz`，SHA-256 `6384bca0c21068c230e90748c1190305248e0d9a457d171bd41b11db73f3ae26`。
- 兩個包皆未簽章。外掛專案不執行簽章、上傳市集、發布或部署。
- 依使用者指定的 [Studio PR #27](https://github.com/jobdone-cc/Studio/pull/27) `docs/operations/plugin-submission-standard.md` 提交；未自行合併該平台 PR。

## 這一版的變更

會議筆記已接上 Studio 錄音，停止後保存原始音檔，再產生保留語氣脈絡的全文與會議摘要。

相對 0.3.0：

- 加上 `backend.data_dir: "data"`，配合 Studio 指定的 developer-run 後端；不是 managed backend。
- 讀取平台 `PORT`、`DATA_DIR`，暫存預設 `DATA_DIR/scratch`；`MEETING_NOTES_SCRATCH` 明確設定時優先。
- 支援 `FFMPEG_BIN`、`FFPROBE_BIN` 絕對路徑，解決 launchd PATH 不含 Homebrew 的問題。
- 未知錯誤只顯示繁體中文通用訊息，不顯示原始錯誤代碼。
- 以固定中繼資料打包，從固定 commit 乾淨檔案重建兩個包，逐 byte 比對一致。

## 權限

| uses | 實際用途 | 預期同意範圍 |
| --- | --- | --- |
| `ai: true` | `studio.ai.complete` 整理全文與摘要 | `ai` |
| `audio-record: true` | `studio.audio.record` 宿主錄音 | `audio:record` |
| `studio-docs: {access: "read"}` | 釘選版本 `docs.fetch`、`docs.download` | `docs:read` |

另由平台導出 `backend:127.0.0.1:8937`，以及共用 `own-data`／`print` 範圍。沒有 `docs:write`、相機、外部轉存或 iframe 麥克風 capability。紀錄、專案、同步與下載均沿用 Studio 介面。

## 提交自查

| 項目 | 結果與範圍 |
| --- | --- |
| 官方嚴格檢查 | PASS，零 lint 警告；320／375／1024px 無溢出，無檢查判定的 bridge／網路失敗 |
| 權限 | uses 已逐項對照實際 AI、錄音、文件讀取呼叫 |
| 版本 | 0.3.1，未覆寫既有 0.3.0 包 |
| 秘密與資料 | 交付檔案已核對，無真實 `.env`、金鑰、密碼、個資或錄音；只有 `.env.example` 佔位設定。常見私鑰／token 樣式搜尋無命中 |
| 資料路徑 | 長期成果走 Studio records／docs；處理副本在指定資料目錄，既有明示用途的 Azure Speech 轉錄不改變，沒有新增外送目的地 |
| 語言 | UI 繁體中文；程式、註解、log 英文；未知錯誤不顯示原始代碼 |
| 隔離 | 正式 opaque iframe 只呼叫宿主錄音，不放寬 sandbox；原生錄音後備只供非 opaque 的獨立開發頁面 |
| 測試證據 | 自動檢查及虛擬音源通過；正式站、真實裝置與模型證據分開列示如下 |
| 固定 commit／重建 | 固定分支 SHA 的乾淨 `git archive` 重建與交付物完全相同；主線合併仍待審查 |

## 驗證

- `node meeting-notes/checks/model-check.mjs`：PASS，5/5 mutations 被偵測。
- `node meeting-notes/checks/backend-check.mjs`：PASS；簽章身分、使用者／專案隔離、上傳容量、轉檔與清理；在 PATH 找不到音訊工具時，兩個絕對路徑仍能完成實際轉檔；相對路徑被拒絕。Speech 回應為模擬。
- `node meeting-notes/checks/current-sdk-check.mjs`：PASS；平台 `origin/main` `766debb1e1d42d55ade431461952c9fe20dd9e60`，實際 SDK SHA-256 `8bd9fbfbee6b5b6619f9d565547c67de30b983e0a0ed6fa0e138ab92c0850b29`。官方 checker 明確排除的 authoring 能力探測 403 仍有列在診斷，沒有隱藏。
- Chrome for Testing：版面、兩段文字、保存／衝突、取消／錯誤／重試、讀取失敗仍可下載、跨專案結果隔離通過；SDK、AI／ASR 回應模擬。
- 真正平台 SDK／bridge／錄音視窗／文件服務及 opaque iframe：虛擬麥克風錄製、停止保存、版本讀取、試聽、ffmpeg 解碼、音軌釋放通過。
- `recorder-check.mjs`：PASS，5/5 mutations 被偵測。
- 後端包解壓啟動：PASS；launchd `PORT` 不被私有設定覆蓋，確實寫入 `DATA_DIR/scratch`；未授權請求被拒絕，正常關閉清除暫存。
- `python3 meeting-notes/checks/package-release.py <output-directory>`：ZIP／tar.gz 固定排序、時間、權限，未簽章。從上述 source SHA 乾淨 `git archive` 重建，兩個檔案與本次交付 `cmp` 一致，`SHA256SUMS` 核對通過。舊官方 ZIP 工具含當下時間，故此次改用 Python 標準庫打包，再交由官方安裝函數核對內容。

## 未驗證與限制

- 未部署本版本，未完成正式站隔離案場的完整流程；主控安排部署與上架。
- 真實麥克風待使用者實測，步驟見 [錄音實測](recording-acceptance.md)。未實測 Safari、手機及連續 2 小時負載；M4A 命名已自動檢查，不代表 Safari 實機通過。
- 本版未新增 Azure 付費呼叫；之前合成中文曾成功呼叫 Speech，但不等於本版實際中文多人會議或正式 Foundry 全流程驗收。
- 宿主錄音停止前在記憶體中，關閉／當機會遺失；停止後原始檔留在文件中心。文件讀取上限 64 MiB，超限保留原檔及下載入口，可下載後從原有音檔入口轉錄。
- 後端上傳小於 499 MB、音訊小於 5 小時；最多 4 個工作，處理逾時 20 分鐘，異常終止的殘留暫存須維運清理。

## 後端需求

- Studio 指定 developer-run 路徑，Node.js 22.17+，入口 `node server.mjs`；loopback 8937，平台注入 `PORT`／`DATA_DIR`。
- 設定名稱：`STUDIO5_URL`、`AZURE_SPEECH_ENDPOINT`、`AZURE_SPEECH_KEY`；可選 `FFMPEG_BIN`、`FFPROBE_BIN`、`MEETING_NOTES_SCRATCH`。只需 Speech key，不需要 Foundry／OpenAI／Groq key。
- 私有設定由 Studio／擁有者處理，原始碼與包不含值。此提交沿用主控指定的 developer-run 過渡方式，不宣稱已有平台通用秘密交付或一鍵代管。
- 主機提供 ffmpeg／ffprobe 及可讀取的絕對路徑；外掛專案不安裝系統工具。
- 對外連線僅為設定的 Studio JWKS 與 Azure Speech HTTPS；文字模型由 Studio 既有 AI 路由處理。
- 後端只寫 `DATA_DIR/scratch`（或明確覆寫的暫存目錄）；處理成功、失敗、正常關閉即清除，未完成上傳閒置 30 分鐘後清除。原始錄音與筆記分別保存在 Studio docs／records，不由後端自建長期資料庫。
