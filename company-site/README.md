# 公司立體模型（company-site）

從 Studio 的 `blender-model-viewer` 範本做出來的成品外掛：在 Studio 的隔離 iframe 內檢視一個從 Blender 匯出、已上傳到案場檔案夾並發布正式版本的 GLB 模型，並以 `annotations.json`（以 Blender 物件名稱為 key）顯示各部位的標題與說明。

安裝後請編輯 `plugin/company-site/config.json`，填入你自己的 `projectKey` 與文件版本（例如 `doc:<file-id>@<version>`）；空白設定不會讀取任何檔案。`annotations.json` 範例內容是示範用的建物部位說明，請換成你的。

授權：Apache License 2.0（見 repo 根目錄 LICENSE）。
