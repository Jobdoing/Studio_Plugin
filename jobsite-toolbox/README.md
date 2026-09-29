# studio5-plugin-jobsite-toolbox

## 這是什麼

Studio 的「工地百寶箱」外掛：32 項各自獨立的公制工地計算工具，收在同一個外掛裡。首頁是工具方塊，點方塊進入工具；方塊順序可拖曳調整並存在個人帳號（`studio.records`，scope `user`）。手機顯示 21 項需要在現場輸入的工具，其餘 11 項需查型錄或規範、只在電腦版顯示。

每項工具都有「帶入範例」（原廠手冊、原廠計算器實測或規範解說的例題），結果區附公式、適用範圍與驗證等級；不做合格判定，也不取代設計者。

**驗證等級（照實標示）：**
- **原廠算例驗證**：有原廠手冊例題或原廠計算器實測，工具結果與之相符（例：USG 自流平、Schluter 估算器、Southwire 手冊、Greenlee 手冊、Uponor 手冊）
- **依公式驗算**：只有公開公式、沒有原廠算例，畫面寫明「依公式驗算」（例：鋼筋伸展與搭接依《建築物混凝土結構設計規範》112 年版第 25 章，kgf 制）
- 產品值（耗量、每包數量、容許值等）一律由使用者填並填來源，工具不內建

## 外掛的構成

純靜態前端，零伺服器端程式、零資料 block：

- `plugin/jobsite-toolbox/plugin.json`、`index.html`：外掛宣告與全部 32 個工具面板，樣式只用 Studio5 `/studio-kit.css`
- `plugin/jobsite-toolbox/calculations.js`：全部算式（純函式，無 DOM）
- `plugin/jobsite-toolbox/examples.js`：「帶入範例」的輸入與預期值，程式檢查與瀏覽器檢查共用
- `plugin/jobsite-toolbox/app.js`：讀欄位、算結果、方塊首頁、排序、複製結果；使用 SDK 的 `studio.records`、`studio.setRoute`／`onRoute`、`studio.copy`、`studio.kit.sortable`／`mergeOrder`／`signToggle`

## 怎麼掛進一台 Studio

把 `plugin/jobsite-toolbox/` 整個資料夾放到 Studio 的 blocks 根目錄，以 developer 帳號執行 `developer-op.sh lint jobsite-toolbox --strict`，再 `install`（首次）或 `upgrade`（遞增 `plugin.json` 的 `version`）。

## 測試

```bash
node check-calculations.mjs
```

逐項重算規格例題並檢查邊界規則（`checks/*.mjs`）；任何算式改壞時會失敗。

瀏覽器檢查（320／375／1024 px，含方塊首頁、拖曳排序、深層連結、複製、欄位與單位）：先在 Studio5 目錄啟動 `node scripts/plugin-dev.mjs --blocks <本目錄>/plugin --port 5210`，再執行

```bash
STUDIO5_ROOT=<已 npm ci 的 Studio5 目錄> node checks/browser.mjs
```

選填 `SHOTS_DIR=<資料夾>` 存 320 px 截圖。
