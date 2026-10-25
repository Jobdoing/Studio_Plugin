# 正式 Studio 錄音整合待辦

2026-10-25 使用者決定：「不急，直接解決再上架」。正式 Studio 內的直接錄音是上架前必要條件，不能以音檔上傳取代驗收。已轉交 Studio session 確認並實作宿主介面，外掛方負責接入及驗證；介面契約尚待平台確認。

## 已完成

`meeting-notes` 0.2.0 已有瀏覽器錄音、停止、試聽、下載及既有 Azure 轉錄銜接。獨立 HTTPS／localhost 頁面可使用；Chrome for Testing 使用虛擬音源驗證原生 MediaRecorder、WebM 解碼、下載資料及麥克風釋放。這不代表正式 Studio iframe 已可錄音。

## 平台限制的目前證據

已核對遠端 `origin/main` 的 `src/AppBlockView.tsx`，plugin iframe 為 `sandbox="allow-scripts allow-forms"`。雖可用 manifest 的 `capabilities: ["microphone"]` 設定 Permissions Policy，iframe 仍沒有可直接請求麥克風的有效 origin。

[getUserMedia 官方文件](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#privacy_and_security) 說明 sandbox iframe 需要 `allow-same-origin` 才能直接呼叫此 API。這裡不應為單一 plugin 放寬 Studio 的隔離設定。

目前 `studio.device.speech.transcribe` 回傳辨識文字，不能取代需要原始音檔、長會議及 Azure 說話者區分的本功能。plugin 沒有呼叫任何虛構的宿主錄音 API。

## 請平台提供的最小介面

介面名稱由平台定案；需求如下：

- 從使用者點擊開始，交由宿主開啟麥克風並提供開始／停止／取消與經過時間。
- 停止後回傳實際錄音的 `File`／`Blob`、正確 MIME type、檔名及是否因限制或中斷而停止。
- 在宿主保存檔案或讓使用者下載，避免 plugin 分頁關閉造成唯一音檔遺失。
- 拒絕權限、取消、導航、plugin 關閉或使用者／案場切換時確實停止所有音軌，不能將結果送往其他 plugin 或新案場。
- 長會議須有清楚的時長／大小上限與自動停止提示；不能只靠常駐記憶體假稱無限錄音。

平台完成後，plugin 再把本機錄音入口換成宿主介面，沿用現有上傳、Azure Speech、全文與摘要流程。正式 iframe 目前將直接錄音按鈕停用，保留上傳音檔。
