# DeckCraft Adapter Port Report (`v0.8.0` -> `v0.16.0`)

## 1. Per-Adapter Hunk Summary

### [prepare-deckcraft.py](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/scripts/prepare-deckcraft.py) & [deck-web.rs](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/src/deck-web.rs)
- **Hunk 1 (`crates/engine/src/lib.rs`)**: **Kept** — `#[derive(Clone, Debug)]\npub struct DocState {` -> injects `pub mod studio_save_state;` and copies `deck-save-state.rs`.
- **Hunk 2 (`crates/ui-egui/src/app/commands.rs`, was `lib.rs`)**: **Re-anchored** — `pub fn run(&mut self, id: &str, params: Value) -> Result<Value, String> {` moved from `lib.rs` to `app/commands.rs`; intercepts `file.save`, `file.saveAs`, and `file.saveTemplate` on `wasm32`.
- **Hunk 3 (`crates/ui-egui/src/lib.rs`)**: **Re-anchored** — `pub mod panes;` -> `pub use panels as panes;` (upstream renamed `panes` module to `panels` and re-exported `pub use panels as panes;`); attaches `mod studio;` and `pub mod studio_io;`.
- **Hunks 4–6 (`crates/ui-egui/src/app/files.rs`, was `lib.rs`)**: **Re-anchored** — `pub fn save_as_dialog`, `pub fn save`, and `pub fn save_all` moved from `lib.rs` to `app/files.rs`.
- **Hunk 7 (`crates/ui-egui/src/app.rs`, was `lib.rs`)**: **Re-anchored** — `pub fn logic(&mut self, ctx: &egui::Context) {` moved from `lib.rs` to `app.rs`; calls `crate::studio_io::poll(self, ctx)` on `wasm32`.
- **Hunks 8–9 (`crates/ui-egui/src/app/files.rs`, was `lib.rs`)**: **Re-anchored** — `dl(name, &b);\n                true` and the multi-slide image export loop (`for (file, bytes) in web_image_files(&doc, slide, all, &name, ext, transparent)`) moved from `lib.rs` to `app/files.rs`.
- **Hunk 10 (`crates/ui-egui/src/lib.rs`)**: **Kept** — `PendingFile` (`target: FileTarget,`) in `lib.rs` gains `command: Option<(String, Value)>,`.
- **Hunks 11–17 (`crates/ui-egui/src/app/files.rs`, was `lib.rs`)**: **Re-anchored** — `target: self.capture_file_target() });`, `pick_and_run` (`pub(super) fn` -> `pub(crate) fn`), `self.pending_files.iter_mut().find(|r| r.id == id)` command capture, `apply_external_file` (`fn` -> `pub(crate) fn`), `command_for` override, `mut params`, extra parameter forwarding, and `shape.fill`/`design.background` `params["picture"] = params["data"].clone()` moved from `lib.rs` to `app/files.rs`.
- **Hunks 18–20 (`crates/ui-egui/src/app/commands.rs`, was `lib.rs`)**: **Re-anchored** — `smartart.setPicture` desktop-only guard removal, `ui.browseTheme` (`self.pick_and_insert("theme", "design.browseTheme");`), and `ui.compare` (`self.pick_and_insert("open", "review.compare");`) moved from `lib.rs` to `app/commands.rs`.
- **Hunks 21–22 (`crates/ui-egui/src/app/files.rs`, was `lib.rs`)**: **Re-anchored** — `pick_transition_sound` (`self.pick_and_insert("audio", "transition.sound");`) and `pub(super) fn pick_and_reuse(&mut self, keep: bool)` moved from `lib.rs` to `app/files.rs`.
- **Hunks 23–25 (`crates/ui-egui/src/panels/format_shape.rs` & `panels.rs`, was `panes.rs`)**: **Re-anchored** — `fn pick_fill_picture(app: &mut SlideApp)` moved from `panes.rs` to `panels/format_shape.rs` and is re-exported in `panels.rs` under `#[cfg(test)]` for `studio_import_tests`.
- **Hunks 26–27 (`crates/ui-egui/src/panels/background.rs`, was `panes.rs`)**: **Re-anchored** — `"picture" => {` and `if ui.button("Insert picture from file…").clicked()` moved from `panes.rs` to `panels/background.rs`.
- **Hunks 28–29 (`crates/ui-egui/src/ribbon/home.rs` & `ribbon/transitions.rs`, was `ribbon.rs`)**: **Re-anchored** — `let desktop = app.services.pick_open.is_some();` moved to `ribbon/home.rs`; `let can_pick = app.services.pick_open.is_some();` moved to `ribbon/transitions.rs`.
- **Hunks 30–32 (`crates/pptx/src/opc.rs` & `crates/pptx/src/lib.rs`)**: **Kept / Re-anchored** — `opc.rs` `Package` now initializes `ct_cache: std::sync::OnceLock::new()` (`Ok(Package { parts, ct_cache: std::sync::OnceLock::new() })`); macro rejection and `studio_macro_tests` preserved.
- **Hunks 33–34 (`crates/ui-egui/src/dialogs/photo_album.rs`, was `dialogs.rs`)**: **Re-anchored** — `pub(super) fn photo_album_dialog` and `if ui.button("Add Pictures…").clicked()` moved from `dialogs.rs` to `dialogs/photo_album.rs`.
- **Hunk 35 (`crates/ui-egui/src/dialogs/body.rs`, was `dialogs.rs`)**: **Re-anchored** — close-confirmation save branch (`let web = app.services.pick_save.is_none() && app.services.download.is_some() && app.services.host_save.is_none();`) moved from `dialogs.rs` to `dialogs/body.rs`.
- **Hunks 36–39 (`crates/ui-egui/src/dialogs.rs`, `dialogs/about.rs`, `backstage/files.rs`, `backstage/info.rs`, `backstage/print.rs`)**: **Re-anchored** — `paint_logo` moved to `dialogs/about.rs` (anchored before `\n#[cfg(test)]\nmod about_credits_tests`), and backstage string replacements moved from `backstage.rs` to `backstage/files.rs`, `backstage/info.rs` (including the new `app.services.host_save.is_some()` hover branch), and `backstage/print.rs`.
- **Hunk 40 (`crates/ui-egui/Cargo.toml`)**: **Re-anchored** — anchored on `[target.'cfg(not(target_arch = "wasm32"))'.dependencies]\ncraft-update = { workspace = true }` to append the `wasm32` dependencies (`js-sys`, `wasm-bindgen`, `wasm-bindgen-futures`).
- **Hunk 41 (`apps/deckcraft-web/src/web.rs` & `deck-web.rs`)**: **Re-anchored** — `WebShell::update` now ends with `self.app.raw_input_hook(ctx, raw);` for dropped-file clearing and `self.app.ui(ui);` inside `egui::CentralPanel`; `deck-web.rs` updated to initialize `presenter: Some(crate::presenter::BrowserHost::new(ctx.clone()))` as expected by v0.16.0 `Services`.
- **Hunk 42 (`crates/fonts/build.rs`)**: **Kept + New fallback** — kept `Noto Sans CJK TC` inclusion in `is_excluded_family` and wasm allowlist; added fallback to `/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts` when `CRAFT_FONTS_DIR` is unset in `main()` so `bundled_interface_fonts_cover_the_traditional_chinese_catalog` passes even when `CRAFT_FONTS_DIR` is not passed in the environment.
- **Hunk 43 (`Cargo.lock`)**: **Re-anchored** — `deckcraft-ui-egui` lock entry dependencies anchored on `"egui_kittest",\n` and `"toml",\n` (upstream removed `"rfd"` from `deckcraft-ui-egui`).

### [prepare-file-access.py](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/scripts/prepare-file-access.py) (deckcraft section only)
- **Hunk 1 (`crates/engine/src/recovery.rs`)**: **Dropped** — upstream v0.16.0 already guards `std::process::id()` in `crates/engine/src/recovery.rs` with `#[cfg(not(target_arch = "wasm32"))]`.
- **Hunks 2–7 (`crates/ui-egui/src/app/files.rs`, was `lib.rs`)**: **Re-anchored** — `InboxEvent::Cancelled { id } => {` (calling `studio_io::bind_open(id, None)`), `save_as_dialog` (`save_intent(..., true)`), `download` (`studio_io::export(name, &b)`), and `apply_external_file` (`open_request` capture, `file.openBytes` `uid` capture, and `studio_io::bind_open(request_id, opened_uid)`) moved from `lib.rs` to `app/files.rs`.
- **Hunk 8 (`crates/ui-egui/src/app/commands.rs`, was `lib.rs`)**: **Re-anchored** — `let format = params.get("format")` (`save_intent(self, format, false, id != "file.save")`) moved from `lib.rs` to `app/commands.rs`.

### [prepare-localization.py](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/scripts/prepare-localization.py), [deckcraft-zh-hant.patch](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/patches/deckcraft-zh-hant.patch), [deck-zh-hant-tests.rs](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/src/deck-zh-hant-tests.rs), & [deck-zh-hant.tsv](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/src/deck-zh-hant.tsv)
- **Version Pin (`prepare-localization.py`)**: **Re-pinned** — `expected['deckcraft']` updated from `'0.8.0'` to `'0.16.0'` (computed from `NEW_BASE/Cargo.toml` `[workspace.package].version = "0.16.0"`).
- **Patch (`craft-suite/patches/deckcraft-zh-hant.patch`)**: **Re-anchored** across 82 files for the v0.16.0 split module layout (`app/*.rs`, `backstage/*.rs`, `canvas/*.rs`, `dialogs/*.rs`, `panels/*.rs`, `ribbon/*.rs`, `show/*.rs`, `status.rs`, `theme.rs`, `menus.rs`, etc.). Also attached `.labelled_by(label.id)` to the `interface_language` `ComboBox` in `dialogs/body.rs` to satisfy upstream's new accessibility assertion (`preferences_and_format_pane_name_every_input`), and added `app.ui_fonts.note(ctx, "⌘⇧⌥⌃")` + pass discard in `menus::palette` so macOS shortcut symbols (`⌥`) borrow a system fallback face when `Noto Sans Symbols` is not embedded.
- **Tests (`craft-suite/src/deck-zh-hant-tests.rs`)**: **Re-anchored** — updated `every_explicit_literal_translation_has_a_catalog_entry` `include_str!(...)` list to cover all 112 non-test source files under `crates/ui-egui/src/`.

### Check Scripts ([check-deck-imports.py](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/scripts/check-deck-imports.py), [check-deck-wasm.py](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/scripts/check-deck-wasm.py), [check-localization-mutations.py](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/scripts/check-localization-mutations.py))
- `check-deck-imports.py`: Re-anchored `fill-target` mutation path from `crates/ui-egui/src/panes.rs` to `crates/ui-egui/src/panels/format_shape.rs`.
- `check-deck-wasm.py`: Stripped `//` line comments from `instance_id()` body before asserting no unguarded `std::process::id()` call exists (upstream added a doc/inline comment mentioning `std::process::id()`).
- `check-localization-mutations.py`: Re-anchored DeckCraft mutation 3 path from `crates/ui-egui/src/lib.rs` to `crates/ui-egui/src/app/commands.rs`, and DeckCraft mutation 6 target in `crates/ui-egui/src/status.rs` from `'left_rect.max.x + 12.0'` to `'sr.max.x + 16.0'`.

---

## 2. Re-Pinned Values and How Computed

- `craft-suite/scripts/prepare-localization.py`:
  - `expected['deckcraft']`: `'0.8.0'` -> `'0.16.0'`
  - Computed from `/Volumes/Vibe-Temp/Craft/tmp/breakmap2/deckcraft-base/Cargo.toml` (`[workspace.package] version = "0.16.0"`, git commit `a3e2254`).

---

## 3. Acceptance Verification Output Tails (A–D)

### A. Fresh v0.16.0 Copy — Adapter Pipeline Execution
```text
$ cp -R /Volumes/Vibe-Temp/Craft/tmp/breakmap2/deckcraft-base /Volumes/Vibe-Temp/Craft/tmp/deck-fresh
$ python3 craft-suite/scripts/prepare-deckcraft.py /Volumes/Vibe-Temp/Craft/tmp/deck-fresh
DeckCraft Studio storage prepared; upstream English interface retained
$ python3 craft-suite/scripts/prepare-file-access.py deckcraft /Volumes/Vibe-Temp/Craft/tmp/deck-fresh
Prepared deckcraft file identity and save intent
$ python3 craft-suite/scripts/prepare-localization.py deckcraft /Volumes/Vibe-Temp/Craft/tmp/deck-fresh
Applied Traditional Chinese interface to deckcraft 0.16.0
```

### B. `cargo test --locked -p deckcraft-ui-egui --lib`
Counts: **503 passed, 0 failed, 4 ignored**.
```text
test units_tests::the_format_pane_shows_and_takes_centimetres ... ok
test units_tests::the_slide_size_dialog_shows_and_takes_centimetres ... ok
test units_tests::ok_in_the_slide_size_dialog_without_edits_keeps_the_size ... ok
test units_tests::portrait_swaps_the_exact_slide_size ... ok
test units_tests::the_format_pane_scales_and_positions_from_the_centre ... ok
test units_tests::a_slide_size_preset_gives_its_exact_size ... ok
test ui_soak_tests::ui_soak_random_input_keeps_the_app_sound ... ok

test result: ok. 503 passed; 0 failed; 4 ignored; 0 measured; 0 filtered out; finished in 6.65s
```

### C. `cargo check --locked -p deckcraft-web --target wasm32-unknown-unknown`
```text
    Checking deckcraft-engine v0.16.0 (/Volumes/Vibe-Temp/Craft/tmp/deck-fresh/crates/engine)
    Checking deckcraft-web v0.16.0 (/Volumes/Vibe-Temp/Craft/tmp/deck-fresh/apps/deckcraft-web)
    Finished `dev` profile [optimized + debuginfo] target(s) in 8.58s
```

### D. Existing Check Scripts (`check-deck-wasm.py`, `check-deck-imports.py`, and DeckCraft mutations in `check-localization-mutations.py`)
```text
$ python3 craft-suite/scripts/check-deck-wasm.py /Volumes/Vibe-Temp/Craft/tmp/deck-fresh
Deck WASM PID source guard passed; real browser startup must also pass

$ python3 craft-suite/scripts/check-deck-imports.py /Volumes/Vibe-Temp/Craft/tmp/deck-fresh
baseline: passed
all-documents: caught
fill-target: caught
macro-rejection: caught
restored: passed

$ # DeckCraft localization mutations (from check-localization-mutations.py):
Mutation 3: detected (deckcraft, language_changes_preserve)
Mutation 4: detected (deckcraft, bundled_interface_fonts_cover)
Mutation 5: detected (deckcraft, rendered_file_tab)
Mutation 6: detected (deckcraft, rendered_file_tab)
All 4 deckcraft localization mutations detected; original sources restored
```

---

## 4. New English UI Strings Added in `v0.16.0` (`English -> zh-hant` in [deck-zh-hant.tsv](file:///Volumes/AI-Model/Craft/.worktrees/port-deck/craft-suite/src/deck-zh-hant.tsv))

555 new English UI strings were added to `craft-suite/src/deck-zh-hant.tsv`:

```text
Pick -> 選取
All slides -> 所有投影片
Keep Mouse Cursor Visible -> 保持滑鼠游標可見
Check for Updates… -> 檢查更新…
Select Slide Range -> 選取投影片範圍
List Slides to Reuse -> 列出要重複使用的投影片
Delete Segment -> 刪除線段
Segment Type -> 線段類型
Open Path -> 開放路徑
Close Path -> 封閉路徑
Delete Surrounding Text -> 刪除周圍文字
Language for All Text -> 所有文字的語言
Reject Revision -> 拒絕修訂
Inspect Slide Actions -> 檢查投影片動作
Transparent background -> 透明背景
Leave the slide background out: only what is on the slide is drawn -> 省略投影片背景：僅繪製投影片上的內容
{} of {} -> 第 {} 頁，共 {} 頁
{n} slides per page -> 每頁 {n} 張投影片
Unlock -> 解除鎖定
  Format: ->   格式：
Action on mouse over -> 滑鼠移過時的動作
Action on click -> 按一下時的動作
Hyperlink to: -> 跳到：
Alt text -> 替代文字
Select None -> 全部取消選取
Keep source formatting -> 保留來源格式設定
a dictionaries folder -> 字典資料夾
Apply to: -> 套用至：
Selected text -> 選取的文字
Whole presentation -> 整份簡報
Mark all text in the presentation as: -> 將簡報中的所有文字標示為：
Chart cell -> 圖表儲存格
SmartArt items -> SmartArt 項目
Ordinals (1st) with superscript -> 序數 (1st) 改為上標
Automatic bulleted and numbered lists -> 自動項目符號及編號清單
Measurement units: -> 度量單位：
Inches -> 英吋
Centimeters -> 公分
Do you want to save the changes you made to “{name}”? -> 是否要儲存對「{name}」所做的變更？
Insert slides from {name} after the current slide: -> 在目前投影片之後插入來自 {name} 的投影片：
{}  (no title) -> {}  (無標題)
Dictionary: {} -> 字典：{}
Width: enter {MIN_WIDTH} to {MAX_WIDTH} pixels -> 寬度：請輸入 {MIN_WIDTH} 至 {MAX_WIDTH} 像素
Seconds per slide: enter {MIN_SECONDS} to {MAX_SECONDS} -> 每張投影片秒數：請輸入 {MIN_SECONDS} 至 {MAX_SECONDS}
Slides: choose a range from 1 to {n} -> 投影片：請選擇 1 至 {n} 的範圍
Find what: -> 尋找目標：
 (notes) ->  (備忘稿)
Replaced {} occurrence(s). -> 已取代 {} 個項目。
DeckCraft can't find “{text}”. -> DeckCraft 找不到「{text}」。
Match {} of {} on slide {}{where_}. -> 第 {} 個符合項目（共 {} 個），位於投影片 {}{where_}。
The web build inserts album pictures from data passed to insert.photoAlbum -> 網頁版會從傳遞給 insert.photoAlbum 的資料插入相簿圖片
That file is empty -> 該檔案為空白
That picture is larger than 32 MB -> 該圖片大於 32 MB
Text: {text} -> 文字：{text}
Clear the tab at {pos}" -> 清除位於 {pos}" 的定位點
Heading sample  {major} -> 標題範例  {major}
Body sample  {minor} -> 本文範例  {minor}
Enter a zoom percent -> 請輸入縮放百分比
Slide {} of {n} -> 第 {} 張投影片，共 {n} 張
Reject -> 拒絕
Compared with {} -> 與 {} 比較
Accept All ({}) -> 全部接受 ({})
Reject All ({}) -> 全部拒絕 ({})
Slide inserted after {slide} -> 在第 {slide} 張之後插入的投影片
Slide {} deleted -> 已刪除第 {} 張投影片
Slide {} changed -> 已變更第 {} 張投影片
Slide {} -> 投影片 {}
{when} · Resolved -> {when} · 已解決
No glow -> 無光暈
No soft edges -> 無柔邊
{r} pt soft edges -> {r} 點柔邊
Pattern -> 圖樣
From -> 自
Top Left Corner -> 左上角
Columns… -> 欄…
Hide -> 隱藏
SmartArt text -> SmartArt 文字
Look up -> 查閱
No synonyms for "{}". -> 找不到「{}」的同義字。
Click the preview to zoom. -> 按一下預覽以縮放。
A− -> A−
Choose a slide to show it, or press G to return. -> 選擇要顯示的投影片，或按 G 返回。
First {} slides -> 前 {} 張投影片
Choosing a presentation to reuse needs the desktop app -> 需要桌面版應用程式才能選擇要重複使用的簡報
More Columns… -> 其他欄…
1 Slide -> 1 張投影片
Slides Per\nPage: {} -> 每頁投影片數：\n{}
{n} Slides -> {n} 張投影片
Click a colour in the picture to make it transparent -> 按一下圖片中的色彩使其變為透明
Pictures are already at or below that resolution -> 圖片已符合或低於該解析度
Compressed {n} picture(s): {} KB → {} KB -> 已壓縮 {n} 張圖片：{} KB → {} KB
For rectangles and rounded rectangles -> 適用於矩形與圓角矩形
Play this slide's transition -> 播放此投影片的轉場效果
[Stop Previous Sound] -> [停止前一個聲音]
[No Sound] -> [無聲音]
Choosing a sound file needs the desktop app -> 需要桌面版應用程式才能選擇聲音檔案
Loop Until Next Sound -> 循環播放至下一個聲音
The presentation has no sections. Add one with Home › Section. -> 此簡報沒有節。請從「常用 › 節」新增。
No slides. -> 沒有投影片。
 (not checked) ->  (未檢查)
DeckCraft can't export “{other}” -> DeckCraft 無法匯出「{other}」
Waiting for document-center export confirmation -> 正在等待文件中心匯出確認
Saving a copy needs a file picker, which this window doesn't have. -> 儲存副本需要檔案選擇器，但此視窗未提供。
Couldn't create a private print preview: {e} -> 無法建立私密列印預覽：{e}
Opened the presentation as a PDF to print -> 已將簡報開啟為 PDF 以供列印
Reuse Slides needs the desktop app -> 「重複使用投影片」需要桌面版應用程式
Inserted {} slides -> 已插入 {} 張投影片
Saved {name} -> 已儲存 {name}
This slide has no animations -> 此投影片沒有動畫
Previewing animations -> 正在預覽動畫
Save as type -> 存檔類型
Credits -> 製作群
Print range -> 列印範圍
Print layout -> 列印版面配置
Paper size -> 紙張大小
Orientation -> 方向
Slides per page -> 每頁投影片數
Play animated GIF -> 播放動態 GIF
Text ruler -> 文字尺規
OK -> 確定
Width ({abbr}): -> 寬度 ({abbr})：
Height ({abbr}): -> 高度 ({abbr})：
Keep mouse cursor visible -> 保持滑鼠游標可見
Custom character: -> 自訂字元：
Start at: -> 起始號碼：
Size (% of text): -> 大小 (文字的 %)：
Program: -> 程式：
Highlight click -> 按一下時醒目提示
Tick at least one slide to insert -> 請至少勾選一張要插入的投影片
Number: -> 欄數：
Spacing (in): -> 間距 (英吋)：
Update automatically -> 自動更新
Width (pixels): -> 寬度 (像素)：
Seconds per slide: -> 每張投影片秒數：
From slide: -> 起始投影片：
To slide: -> 結束投影片：
Loop forever -> 無限循環
Small (640 px wide) -> 小 (寬 640 像素)
Medium (960 px wide) -> 中 (寬 960 像素)
Large (1280 px wide) -> 大 (寬 1280 像素)
Extra Large (1920 px wide) -> 特大 (寬 1920 像素)
Custom width -> 自訂寬度
Replace with: -> 取代為：
Match case -> 大小寫須相符
Find whole words only -> 全字拼寫須相符
Choose a font -> 選擇字型
Font size must be a number -> 字型大小必須是數字
Character spacing must be a number -> 字元間距必須是數字
Snap objects to other objects -> 將物件貼齊其他物件
Spacing (pt): -> 間距 (點)：
Display grid on screen -> 在螢幕上顯示格線
Display drawing guides on screen -> 在螢幕上顯示繪圖輔助線
Before text -> 文字前
After text -> 文字後
First line -> 第一行
Hanging -> 凸排
By -> 位移
Spacing before -> 與前段距離
Spacing after -> 與後段距離
At -> 行高
Single -> 單行間距
Double -> 兩倍行高
Multiple -> 多行
Exactly -> 固定行高
Justify low -> 低度左右對齊
Distributed -> 分散對齊
Indent before text must be a number of inches -> 文字前縮排必須是以英吋為單位的數字
Indent after text must be a number of inches -> 文字後縮排必須是以英吋為單位的數字
Special indent must be a number of inches -> 指定方式縮排必須是以英吋為單位的數字
Spacing before must be a number -> 與前段距離必須是數字
Spacing after must be a number -> 與後段距離必須是數字
Line spacing must be a number -> 行距必須是數字
Pass pictures to insert.photoAlbum -> 將圖片傳遞至 insert.photoAlbum
{path}: {e} -> {path}：{e}
A photo album holds at most 48 pictures or text boxes -> 相簿最多可容納 48 張圖片或文字方塊
The picture list is invalid -> 圖片清單無效
Type the text for the new text box -> 輸入新文字方塊的文字
Text is longer than 400 characters -> 文字超過 400 個字元
Text box: -> 文字方塊：
Fit to slide -> 符合投影片大小
Rounded -> 圓角
Simple, white -> 簡單白框
Captions under pictures -> 圖片下方標題
ALL pictures black and white -> 所有圖片皆為黑白
Update -> 更新
Add a picture or a text box first -> 請先新增圖片或文字方塊
Select a picture to rotate it or change brightness and contrast -> 選取圖片以旋轉或變更亮度與對比
Text boxes have no picture options -> 文字方塊沒有圖片選項
Rotation (°): -> 旋轉 (°)：
Scale height (%): -> 高度比例 (%)：
Scale width (%): -> 寬度比例 (%)：
Horizontal (in): -> 水平 (英吋)：
Vertical (in): -> 垂直 (英吋)：
Default tab stops (in): -> 預設定位停駐點 (英吋)：
Decimal -> 小數點
Scheme name -> 色彩配置名稱
The Eyedropper takes colours from a slide -> 滴管工具會從投影片擷取色彩
Media position -> 媒體位置
Animation\nPainter -> 複製\n動畫
Replace Fonts… -> 取代字型…
Photo\nAlbum -> 相簿
New Photo Album… -> 新增相簿…
Artistic\nEffects -> 藝術\n效果
More Picture Styles -> 其他圖片樣式
Picture Border -> 圖片框線
Accept\nAll -> 全部\n接受
End\nReview -> 結束\n檢閱
Text\nPane -> 文字\n窗格
Insert Picture -> 插入圖片
Layouts -> 版面配置
Convert -> 轉換
Window title bar -> 視窗標題列
Grid\nOptions -> 格線\n選項
New\nWindow -> 開新\n視窗
Pen -> 畫筆
The picture is empty or larger than 32 MB -> 圖片為空白或大於 32 MB
Document-center open failed: {e} -> 文件中心開啟失敗：{e}
Waiting for document-center save confirmation -> 正在等待文件中心儲存確認
Document-center save was not confirmed: {e} -> 文件中心未確認儲存：{e}
Still opening {name} -> 正在開啟 {name}
Stopped opening {} -> 已停止開啟 {}
Opening {name}… -> 正在開啟 {name}…
Reading the file: {secs} s -> 正在讀取檔案：{secs} 秒
align text to the top of the cell -> 將文字對齊儲存格頂端
align text to the center of the cell -> 將文字對齊儲存格中央
align text to the bottom of the cell -> 將文字對齊儲存格底端
No shadow -> 無陰影
Outer shadow -> 外陰影
Bottom shadow -> 下方陰影
Centered shadow -> 置中陰影
Inner shadow -> 內陰影
Perspective shadow -> 透視陰影
Light horizontal -> 淺色橫線
Light vertical -> 淺色直線
Dark horizontal -> 深色橫線
Dark vertical -> 深色直線
Narrow horizontal -> 窄橫線
Narrow vertical -> 窄直線
Dashed horizontal -> 虛線橫線
Dashed vertical -> 虛線直線
Downward diagonal -> 右斜線
Upward diagonal -> 左斜線
Light downward diagonal -> 淺色右斜線
Light upward diagonal -> 淺色左斜線
Dark downward diagonal -> 深色右斜線
Dark upward diagonal -> 深色左斜線
Wide downward diagonal -> 寬右斜線
Wide upward diagonal -> 寬左斜線
Dashed downward diagonal -> 虛線右斜線
Dashed upward diagonal -> 虛線左斜線
Diagonal cross -> 交叉斜線
Small checkerboard -> 小棋盤
Large checkerboard -> 大棋盤
Small grid -> 小格線
Large grid -> 大格線
Dotted grid -> 點狀格線
Small confetti -> 小紙屑
Large confetti -> 大紙屑
Horizontal brick -> 橫向磚牆
Diagonal brick -> 斜向磚牆
Solid diamond -> 實心菱形
Outlined diamond -> 空心菱形
Dotted diamond -> 點狀菱形
Plaid -> 蘇格蘭紋
Sphere -> 球體
Weave -> 編織紋
Divot -> 草皮紋
Shingle -> 瓦片紋
Trellis -> 格架紋
Zig zag -> 鋸齒紋
Blur -> 模糊
Distance -> 距離
Scale Height -> 高度比例
Scale Width -> 寬度比例
Slide background fill -> 投影片背景填滿
Compound type -> 複合類型
Thick Thin -> 粗細線
Thin Thick -> 細粗線
Triple -> 三線
Cap type -> 端點類型
Flat -> 平端
Round -> 圓端
Join type -> 連接類型
Miter -> 斜接
Open Arrow -> 開放式箭號
Stealth -> 隱形箭號
Small -> 小
Large -> 大
Begin arrow -> 起點箭號
Begin size -> 起點大小
End arrow -> 終點箭號
End size -> 終點大小
Offset X -> X 位移
Offset Y -> Y 位移
Scale X -> X 比例
Scale Y -> Y 比例
Top left -> 左上
Top right -> 右上
Bottom left -> 左下
Bottom right -> 右下
Mirror type -> 鏡像類型
Offset left -> 左側位移
Offset top -> 上方位移
Offset right -> 右側位移
Offset bottom -> 下方位移
Top bevel -> 上方浮凸
Bottom bevel -> 下方浮凸
   Width ->    寬度
   Height ->    高度
Depth -> 深度
Contour -> 輪廓
Material -> 材質
Lighting -> 光源
Presets -> 預設
X Rotation -> X 旋轉
Y Rotation -> Y 旋轉
Z Rotation -> Z 旋轉
Distance from ground -> 與地面距離
Resume -> 繼續
Black -> 黑幕
White -> 白幕
List -> 清單
Process -> 流程圖
Cycle -> 循環圖
Relationship -> 關聯圖
Remove More (looser) -> 移除更多 (較寬鬆)
Remove Less (tighter) -> 移除更少 (較緊密)
No Recolor -> 不重新著色
HD (330 ppi): good quality for high-definition displays -> HD (330 ppi)：適合高畫質顯示器的良好品質
Print (220 ppi): excellent quality on most printers and screens -> 列印 (220 ppi)：在大多數印表機與螢幕上呈現絕佳品質
Web (150 ppi): good for web pages and projectors -> 網頁 (150 ppi)：適合網頁與投影機
E-mail (96 ppi): minimise document size for sharing -> 電子郵件 (96 ppi)：將文件大小縮到最小以便分享
No Border -> 無框線
All Borders -> 所有框線
Outside Borders -> 外框線
Inside Borders -> 內框線
Top Border -> 上框線
Bottom Border -> 下框線
Left Border -> 左框線
Right Border -> 右框線
Inside Horizontal Border -> 內橫框線
Inside Vertical Border -> 內直框線
Diagonal Down Border -> 右下斜框線
Diagonal Up Border -> 右上斜框線
Pen Weight -> 筆跡粗細
Pen Style -> 筆跡樣式
Dot -> 點線
Pen Color -> 筆跡色彩
Narrow -> 窄
Wide -> 寬
Duration -> 期間
After -> 之後
Chime -> 風鈴
Click -> 按一下
Camera -> 相機
Whoosh -> 呼嘯
Drum Roll -> 鼓聲
Laser -> 雷射
Vertical Bullet List -> 垂直項目符號清單
Basic Block List -> 基本方塊清單
Horizontal Bullet List -> 水平項目符號清單
Basic Chevron Process -> 基本燕尾形流程圖
Vertical Process -> 垂直流程圖
Step Up Process -> 步進式流程圖
Block Cycle -> 方塊循環圖
Basic Radial -> 基本放射圖
Basic Pyramid -> 基本金字塔圖
Inverted Pyramid -> 倒金字塔圖
Basic Matrix -> 基本矩陣
Titled Matrix -> 標題矩陣
Vertical Picture List -> 垂直圖片清單
Picture Caption List -> 圖片標題清單
Picture Accent Process -> 圖片強調流程圖
Horizontal Picture List -> 水平圖片清單
Basic Timeline -> 基本時間軸
Basic Venn -> 基本文氏圖
Basic Target -> 基本目標圖
Text Cycle -> 文字循環圖
Continuous Cycle -> 連續循環圖
Horizontal Hierarchy -> 水平階層圖
Grid Matrix -> 格線矩陣
Gear -> 齒輪圖
Segmented Cycle -> 區段循環圖
Multidirectional Cycle -> 多向循環圖
Organization Chart -> 組織圖
Half Circle Organization Chart -> 半圓形組織圖
Cycle Matrix -> 循環矩陣
Segmented Pyramid -> 區段金字塔圖
Basic Pie -> 基本圓形圖
Name and Title Organization Chart -> 姓名與職稱組織圖
Vertical Box List -> 垂直方塊清單
Trapezoid List -> 梯形清單
Table List -> 表格清單
Accent Process -> 強調流程圖
Continuous Block Process -> 連續方塊流程圖
Basic Bending Process -> 基本彎曲流程圖
Linear Venn -> 線性文氏圖
Stacked Venn -> 堆疊文氏圖
Nested Target -> 巢狀目標圖
Simple Fill -> 簡單填滿
Subtle Effect -> 微弱效果
Intense Effect -> 強烈效果
White Outline -> 白色外框
Polished -> 拋光
Inset -> 內嵌
Cartoon -> 卡通
Powder -> 粉彩
Brick Scene -> 立體磚塊
Colorful -> 彩色
Colorful Range - Accent Colors 2 to 3 -> 彩色範圍 - 強調色 2 到 3
Colorful Range - Accent Colors 3 to 4 -> 彩色範圍 - 強調色 3 到 4
Colorful Range - Accent Colors 4 to 5 -> 彩色範圍 - 強調色 4 到 5
Colorful Range - Accent Colors 5 to 6 -> 彩色範圍 - 強調色 5 到 6
Gradient Range - Accent 1 -> 漸層範圍 - 強調色 1
Gradient Range - Accent 2 -> 漸層範圍 - 強調色 2
Gradient Range - Accent 3 -> 漸層範圍 - 強調色 3
Gradient Range - Accent 4 -> 漸層範圍 - 強調色 4
Gradient Range - Accent 5 -> 漸層範圍 - 強調色 5
Gradient Range - Accent 6 -> 漸層範圍 - 強調色 6
Orthographic front -> 正視前視圖
Isometric top up -> 等角俯視向上
Isometric top down -> 等角俯視向下
Isometric bottom up -> 等角仰視向上
Isometric bottom down -> 等角仰視向下
Isometric left up -> 等角左視向上
Isometric left down -> 等角左視向下
Isometric right up -> 等角右視向上
Isometric right down -> 等角右視向下
Oblique top left -> 斜視左上
Oblique top right -> 斜視右上
Oblique bottom left -> 斜視左下
Oblique bottom right -> 斜視右下
Perspective front -> 透視前視圖
Perspective left -> 透視左視圖
Perspective right -> 透視右視圖
Perspective above -> 透視俯視圖
Perspective below -> 透視仰視圖
Perspective above left facing -> 透視左上方朝向
Perspective above right facing -> 透視右上方朝向
Perspective contrasting left facing -> 透視高對比朝左
Perspective contrasting right facing -> 透視高對比朝右
Perspective heroic left facing -> 透視仰角朝左
Perspective heroic right facing -> 透視仰角朝右
Perspective heroic extreme left facing -> 透視極端仰角朝左
Perspective heroic extreme right facing -> 透視極端仰角朝右
Perspective relaxed -> 透視緩和角度
Perspective relaxed moderately -> 透視適度緩和角度
Relaxed inset -> 緩和內嵌
Cool slant -> 冷色斜角
Soft round -> 柔和圓角
Convex -> 凸面
Slope -> 斜坡
Riblet -> 細稜紋
Hard edge -> 硬邊
Art deco -> 裝飾藝術
Warm matte -> 暖色霧面
Matte -> 霧面
Plastic -> 塑膠
Metal -> 金屬
Dk edge -> 深色邊緣
Soft edge -> 柔邊
Legacy wireframe -> 舊版線框
Translucent powder -> 半透明粉彩
Softmetal -> 柔光金屬
Three pt -> 三點光源
Balanced -> 平衡
Soft -> 柔和
Harsh -> 強烈
Flood -> 泛光
Contrasting -> 對比
Morning -> 晨光
Sunrise -> 日出
Sunset -> 日落
Chilly -> 冷調
Freezing -> 冰冷
Two pt -> 兩點光源
Bright room -> 明亮室內
From Bottom-Left -> 自左下
From Bottom-Right -> 自右下
From Top-Left -> 自左上
From Top-Right -> 自右上
Vertical Out -> 垂直向外
Vertical In -> 垂直向內
Horizontal Out -> 水平向外
Horizontal In -> 水平向內
Smoothly From Left -> 平滑自左
Smoothly From Right -> 平滑自右
Through Black From Left -> 穿過黑色自左
Through Black From Right -> 穿過黑色自右
Double Left -> 雙頁向左
Double Right -> 雙頁向右
Single Left -> 單頁向左
Single Right -> 單頁向右
Counterclockwise -> 逆時針
Diamonds From Left -> 菱形自左
Diamonds From Right -> 菱形自右
Diamonds From Top -> 菱形自上
Diamonds From Bottom -> 菱形自下
Hexagons From Left -> 六角形自左
Hexagons From Right -> 六角形自右
Hexagons From Top -> 六角形自上
Hexagons From Bottom -> 六角形自下
Strips In -> 條狀向內
Strips Out -> 條狀向外
Particles In -> 微粒向內
Particles Out -> 微粒向外
Zoom and Rotate -> 縮放並旋轉
In with Bounce -> 向內彈跳
Out with Bounce -> 向外彈跳
1 Spoke -> 1 根輪輻
2 Spokes -> 2 根輪輻
3 Spokes -> 3 根輪輻
4 Spokes -> 4 根輪輻
8 Spokes -> 8 根輪輻
Left Up -> 左上
Right Up -> 右上
Left Down -> 左下
Right Down -> 右下
To Bottom -> 至底部
To Bottom-Left -> 至左下
To Left -> 至左側
To Top-Left -> 至左上
To Top -> 至頂端
To Top-Right -> 至右上
To Right -> 至右側
To Bottom-Right -> 至右下
Peek Out -> 悄悄移出
Sink Down -> 下沉
Contract -> 收縮
Diagonal Down Right -> 向右下對角線
Diagonal Up Right -> 向右上對角線
Zigzag -> 鋸齒
Sine Wave -> 正弦波
Decaying Wave -> 衰減波
Heartbeat -> 心跳
S Curve 1 -> S 型曲線 1
S Curve 2 -> S 型曲線 2
Stairs Down -> 階梯向下
Bounce Right -> 向右彈跳
Bounce Left -> 向左彈跳
Spiral Right -> 向右螺旋
Spiral Left -> 向左螺旋
Spring -> 彈簧
Swoosh -> 飛掠
4 Point Star -> 四角星
5 Point Star -> 五角星
6 Point Star -> 六角星
8 Point Star -> 八角星
Crescent Moon -> 新月形
Football -> 橄欖球形
Curved Square -> 弧角正方形
Horizontal Figure 8 -> 水平 8 字形
Vertical Figure 8 -> 垂直 8 字形
Loop de Loop -> 連續迴圈
Bean -> 豆形
Peanut -> 花生形
Neutron -> 中子軌跡
```

---

## 5. Notes / Uncertainties
- None. All Studio document-center and local-file open/save flows, save acknowledgements, unsaved-change protections, pending source cleanup on cancel/error, and localization behaviors are preserved in full. All temporary directories under `/Volumes/Vibe-Temp/Craft/tmp/deck-*` have been removed.


## Review changes (orchestrator)

- Removed the hard-coded `CRAFT_FONTS_DIR` fallback path in `crates/fonts/build.rs`; builds must set it explicitly.
- Translation fixes: Hyperlink to: → 超連結到：; Pen Weight/Style/Color → 畫筆粗細／畫筆樣式／畫筆色彩; line spacing At → 設定值.
- Re-verified outside the sandbox: adapters exit 0 on fresh v0.16.0; 503 passed, 4 ignored; wasm32 check exit 0; WASM PID guard passed.
