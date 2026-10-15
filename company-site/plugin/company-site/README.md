# Blender Model Viewer

此範本在 Studio 的隔離 iframe 內檢視你從 Blender 匯出的 GLB。模型必須先上傳到目標專案並發布正式版本；範本只透過 Studio Docs SDK 讀取該版本，不會讀取草稿或公開網址。

## 設定

1. 在 Blender 將模型匯出為 GLB 2.0，並嵌入所有資源。v1 不支援需要額外解碼器的壓縮格式；請匯出未壓縮的幾何與貼圖。
2. 將 GLB 上傳至 Studio 目標專案並發布正式版本。
3. 編輯 `config.json`，填入該專案的 `projectKey` 和精確文件版本，例如 `doc:11111111-1111-4111-8111-111111111111@3`。空白設定不會發出文件讀取。
4. 可在 `annotations.json` 以匯出的 Blender 物件名稱為 key，填入 `title` 和 `description`。例如：

```json
{
  "Beam_A": {
    "title": "Primary beam",
    "description": "Steel frame member"
  }
}
```

選取模型中的 mesh 後，若名稱相符便顯示對應文字。文字以文字節點呈現。

## 開發流程

使用 Studio Dev MCP 的 `scaffold_plugin` 建立此範本，使用 `inspect_model` 檢查工作區內的 GLB，接著執行 strict lint、preview，最後透過既有發布流程發佈。大型模型超過整個 Blob 的 64 MiB 上限時，需另行設計交付方式。

模型讀取受目前專案 ACL 管理；切換專案會立即清除模型，且取消舊讀取的顯示資格。範本不會執行 Blender、外部 Python 腳本或網路模型載入。

此範本沒有自己的持久資料。移除外掛會移除檢視器程式；GLB 是專案文件，仍由 Studio 文件權限與版本流程管理。

Three.js 0.186.0、GLTFLoader、OrbitControls 與對應授權檔均隨範本放在 `vendor/three/0.186/`，執行時不會連外載入套件。
