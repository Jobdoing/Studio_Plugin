# GridCraft v0.17.0 adapter port

Result: A–D passed on a fresh v0.17.0 copy. Final patched source: `/Volumes/Vibe-Temp/Craft/tmp/grid-accept`. Branch: `port/grid-v017`. No commit, push, publication, or `upstream.json` change.

The pristine tag is `v0.17.0`, commit `a6a6a49a0415087474251b08e887a3581fab9e14`; the comparison source is `v0.9.0`. Both tags were checked locally. All 17 pinned pristine files still match after testing. The patched Cargo.lock is unchanged (SHA-256 `bb9f15e76728fea6cbf9470b31fbb499a462f4d0a90080a62f549a0defdf52f1`).

## Adapter hunk review

The reuse ladder stopped at existing code: retained the Studio bridge/save queue and used the upstream split modules and `settle_drafts` hook. No new dependency or machine-path fallback was added.

### prepare-gridcraft.py

| Hunk | Disposition and reason |
|---|---|
| Font input hashes and copies | Kept. Same TC font and OFL SHA-256 checks; font directory remains a required CLI argument. |
| Pristine-file hashes | Re-pinned all seven original files to v0.17.0; added ten split implementation files, including control cancellation. All checks run before writes. |
| Host initialization | Re-anchored: old parent-host comment → `// Host modes (craft-web-host)` block and `Bridge::detect(&canvas)`. The same always-on Studio bridge replaces upstream host transports. |
| Initial language | Kept default Chinese, then the localization pass selects ZhHant. Re-anchored slice end: context setup → the new preferences-restoration comment, so stored UI/preferences are retained. |
| Upstream author/ready block | Re-anchored: author-only block → block starting with `prefs.keep_user_name`. Kept its removal because Studio owns this bridge; the new preferences restore/sync remains intact. Removed the now-unneeded local mutability. |
| Upstream failed notification | Kept removal of the old host protocol notification; loading/error rendering remains. |
| Browser file drops | Kept clearing drops; they cannot bypass Studio source binding or permission handling. |
| Bridge sync | Kept supplying `ui.ctx()` to Studio sync. |
| Browser storage services | Kept replacing open/picture/download with Studio services. Preserved upstream rich clipboard, print, and external-link services. |
| JsValue import removal | Dropped: v0.17.0 print cleanup uses JsValue. Its import is required. |
| query_param removal | Dropped: the new `?chrome=none/notitlebar/nofiletab` feature uses this helper. Both index/ordering checks remain. |
| mime/download removal | Kept; Studio owns destination selection, writes and acknowledgement. |
| WebShell initializer | Re-anchored to the initializer containing `prefs`; remove only the unused inbox field, retain preference sync. |
| Bridge/save/harness copies | Kept. The harness remains the exact pre-SheetApp portion of grid-save.rs. New: native UI integration test module. |
| Module registration | Re-anchored in lib.rs; add the same save module and new test-only module. |
| Services field | Re-anchored: lib.rs `pub struct Services` → services.rs, same optional asynchronous-save service. |
| Save/export/open interception | Re-anchored: lib.rs `run_ui_command` boundary → app/commands.rs. Upstream draft settling and view-state storage execute before interception. Same Save/Save As/copy flags. |
| Save As dialog | Re-anchored: lib.rs → app/commands.rs; same asynchronous Studio destination selection. |
| Save completion polling | Re-anchored: lib.rs `logic` → app.rs `logic`; no clean state before successful acknowledgement of that document snapshot. |
| Autosave | Re-anchored: `self.grid.autosave` branch → app/files.rs `autosave_due` and scheduled-repaint branch using persisted `ui.autosave`. Both branches stay disabled for Studio. The direct engine save still routes through SheetApp. |
| Save a Copy | Re-anchored: dialogs.rs single-line picker → dialogs/show.rs multiline picker. Kept upstream relative-path/native-picker handling and added only the Studio empty-name case and copy intent. |
| Save before close | Re-anchored: dialogs.rs Save Changes body → app/quit.rs `answer_save_changes`. Queue close intent; synchronous upstream close is suppressed while Studio owns saving. |
| Backstage destination label/export | Kept existing Backstage anchors and copy routing. PDF still follows upstream print/export delivery. |
| Options AutoSave control | Re-anchored: backstage.rs → backstage/options.rs; same disabled control and destination explanation. |
| Title-bar AutoSave toggle | Re-anchored: ribbon.rs → ribbon/title_bar.rs and upstream's translated tooltip. Preserved upstream translation and disabled Studio toggling. |
| Web CJK fallback | Re-anchored: theme.rs private function → theme/font_fallback.rs `pub(super) fn load_fallback`. Corrected include path for the extra directory; exact pinned TC bytes remain embedded for WASM. |
| HTML language | Kept intermediate zh-Hans anchor; localization still changes it to zh-Hant. |
| Error reporting visibility | New: app/commands.rs `alert` becomes crate-visible so the retained Backstage/save polling hooks can report errors after upstream's module split. |

The replaced web shell was reviewed against both pristine tags. New WebGPU limit handling, WebGL selection, chrome query controls, stored preferences, raw-input context forwarding, noopener/noreferrer links, and iframe/blob/afterprint cleanup are preserved. The new .slk import capability is retained through the Studio runtime picker (see below).

### prepare-file-access.py (GridCraft only)

| Hunk | Disposition and reason |
|---|---|
| Bind/discard service fields | Re-anchored: lib.rs Services → services.rs Services. |
| Password-dialog completion/cancel | Re-anchored: dialogs.rs final `if open` → dialogs/show.rs before `app.ui_window() != home`. Cleanup now also runs before the new early window-return path. |
| Programmatic password cancellation | New: control.rs dialog_cancel discards the pending source only after upstream cancellation succeeds. A refused cancellation keeps its source. |
| Successful-open binding | Re-anchored: lib.rs session.run → app/commands.rs session.run. Same new-document identity check. Callbacks are platform-independent so native tests exercise the same wiring; ordinary native Services have no callbacks. |
| Save intent | Re-anchored both replacements to app/commands.rs; Save As remains distinct from ordinary Save, copies never clean/rebind the source. |
| Bridge/save/source copies | Kept unchanged copy destinations; regenerated the exact save harness from the ported queue. |

### Save source and shared runtime

- grid-web.rs remains unchanged: open cancellation/error discards pending tokens; host save receipts feed the existing document/snapshot queue.
- grid-save.rs uses upstream `settle_drafts` instead of cell-only commit, preserving the new text-box/draft protection before serialization. Ticket identity/snapshot, cancellation/permission failures, copies, VBA-preserving names, and acknowledgement handling remain unchanged.
- VBA test inputs/assertions now use upstream's `Arc<Vec<u8>>` representation. The same byte-preservation and data-loss assertions remain.
- runtime.mjs: new, GridCraft-only spreadsheet extension `slk`; all other editor filters are unchanged. A runnable runtime-routing test verifies that the actual Studio entry point offers SYLK with document identity enabled.
- grid-check.py now inherits Cargo paths from the pipeline instead of using machine-path defaults; all seven checks and all three mutation assertions are retained.

### prepare-localization.py and zh-Hant patch

- Re-pinned GridCraft 0.9.0 → 0.17.0; DeckCraft's pin and preparation are unchanged.
- Kept the custom zh-Hant catalog, locale routing, serialization aliases, language name/code and English formula locale. Language::ALL is re-anchored from upstream's 19 entries to 20.
- Re-anchored web default-language patch around the retained preference restoration. A saved explicit language still wins on later visits.
- Dropped the old AutoSave-label translation hunk: upstream now translates that label itself. Kept the Studio-specific translated tooltip/explanation at their new locations.
- Dropped whitespace-only web patch hunks.
- New: cover all 1,197 keys across upstream interface catalogs, plus newly introduced uncatalogued controls, macro editor/status/validation, equations/gallery, analysis settings, multi-window controls, tooltips and accessible names. The custom catalog has 1,609 unique keys, including 1,208 additions.
- New: trusted interface-template formatting substitutes arguments once; workbook/user text is never searched or translated. English formatting stays on upstream's original format! path. English plural suffixes are omitted only in translated step/cell counters. The source NOTE(ceiling) limits that rule to reviewed templates; extension requires explicit counter metadata.
- New: translate the default code-editor accessible name at the drawing site; a real AccessKit test verifies it. New UI callbacks read the language before entering egui callbacks. A real upstream accessibility/capture test exposed the nested context-lock problem during the port; the final complete suite passes after the fix.
- The existing catalog test now reads `ja::CORE`, `ja::DIALOGS`, and `ja::EXTRA` instead of removed `JAPANESE`. Added placeholder/user-text and rendered-equation checks. The independent Python checker covers the union of every upstream interface catalog and rejects duplicates/missing keys.
- GridCraft localization mutation mode takes the supplied patched root and inherited Cargo environment, uses --locked, restores source in finally, and retains the original strict failure assertions. DeckCraft mutations were not run for this GridCraft task.

The following is the complete hunk index of the localization patch. UI-only hunks are new label/tooltip/accessibility lookups at existing drawing sites; i18n/web/html hunks re-anchor the existing Traditional Chinese integration.

| File | Disposition | Every hunk (old line → new line) |
|---|---|---|
| `apps/gridcraft-web/index.html` | Re-anchored | 1 → 1 |
| `apps/gridcraft-web/src/web.rs` | Re-anchored | 70 → 70 |
| `crates/ui-egui/src/backstage/options.rs` | New | 29 → 29 |
| `crates/ui-egui/src/code_editor.rs` | New | 716 → 716 |
| `crates/ui-egui/src/control_ui.rs` | New | 45 → 45; 96 → 97; 163 → 164; 190 → 191; 219 → 221; 272 → 274; 296 → 302; 326 → 332; 358 → 365; 392 → 399; 422 → 429; 455 → 462; 466 → 473; 479 → 486; 504 → 511; 512 → 520; 531 → 539; 541 → 549; 563 → 571 |
| `crates/ui-egui/src/dialogs/analysis.rs` | New | 323 → 323; 336 → 337; 427 → 428; 442 → 443; 488 → 490; 503 → 505; 558 → 560; 586 → 588; 595 → 597; 610 → 612; 629 → 631; 664 → 666; 686 → 689 |
| `crates/ui-egui/src/dialogs/insert_function.rs` | New | 5 → 5; 33 → 34; 78 → 79 |
| `crates/ui-egui/src/dialogs/ref_edit.rs` | New | 344 → 344; 382 → 383 |
| `crates/ui-egui/src/dialogs/show.rs` | New | 528 → 528; 594 → 595 |
| `crates/ui-egui/src/dialogs.rs` | New | 292 → 292; 326 → 326; 375 → 375; 581 → 581; 634 → 634; 661 → 661; 675 → 675; 790 → 790; 850 → 850; 999 → 999 |
| `crates/ui-egui/src/equation.rs` | New | 75 → 75; 132 → 132; 139 → 140; 165 → 166; 186 → 187; 194 → 195; 215 → 216; 222 → 224 |
| `crates/ui-egui/src/function_library.rs` | New | 154 → 154 |
| `crates/ui-egui/src/grid/menus.rs` | New | 123 → 123; 162 → 163; 286 → 287; 309 → 311; 354 → 356; 361 → 364; 388 → 391; 396 → 400; 441 → 445; 456 → 461; 484 → 489; 496 → 502; 513 → 519; 529 → 535 |
| `crates/ui-egui/src/i18n.rs` | Re-anchored | 28 → 28; 37 → 39; 56 → 60; 94 → 99; 119 → 125; 148 → 155; 200 → 212; 517 → 530 |
| `crates/ui-egui/src/macro_editor.rs` | New | 291 → 291; 306 → 310; 316 → 320; 357 → 361; 535 → 543; 576 → 584; 688 → 696; 740 → 748; 750 → 758; 780 → 788; 824 → 832; 837 → 845; 863 → 871; 872 → 880; 893 → 901; 919 → 927; 933 → 941; 1013 → 1021; 1071 → 1079; 1089 → 1098; 1106 → 1115; 1144 → 1153; 1185 → 1194; 1202 → 1212; 1232 → 1242; 1289 → 1300; 1297 → 1309; 1316 → 1328; 1324 → 1336; 1356 → 1368; 1390 → 1403; 1407 → 1420; 1417 → 1430; 1435 → 1448; 1578 → 1591; 1592 → 1606; 1614 → 1628; 1642 → 1656; 1717 → 1732; 1732 → 1748; 1744 → 1760; 1753 → 1769; 1779 → 1795; 1787 → 1803; 1809 → 1826; 1824 → 1841; 1834 → 1851; 1851 → 1868; 1862 → 1879; 1907 → 1924; 1920 → 1937; 1947 → 1964; 1995 → 2013; 2020 → 2038; 2041 → 2059; 2063 → 2082; 2146 → 2165; 2267 → 2286; 2292 → 2312 |
| `crates/ui-egui/src/macro_ui.rs` | New | 89 → 89; 134 → 134; 175 → 175; 209 → 209; 229 → 229; 248 → 248; 269 → 270; 371 → 372; 396 → 398; 411 → 413; 419 → 421; 447 → 449; 495 → 497; 519 → 521; 543 → 546; 578 → 581; 593 → 596; 610 → 613; 623 → 626; 631 → 634 |
| `crates/ui-egui/src/panes.rs` | New | 169 → 169; 178 → 179; 198 → 199; 259 → 260 |
| `crates/ui-egui/src/ribbon/automate.rs` | New | 5 → 5; 13 → 14; 55 → 56; 85 → 86 |
| `crates/ui-egui/src/ribbon/contextual.rs` | New | 4 → 4; 20 → 21; 75 → 76; 102 → 104; 126 → 129 |
| `crates/ui-egui/src/ribbon/data.rs` | New | 2 → 2; 41 → 42; 124 → 125 |
| `crates/ui-egui/src/ribbon/home.rs` | New | 25 → 25; 92 → 93; 607 → 608; 657 → 659 |
| `crates/ui-egui/src/ribbon/insert.rs` | New | 5 → 5; 98 → 99; 173 → 174; 192 → 193; 216 → 217; 245 → 246 |
| `crates/ui-egui/src/ribbon/page_layout.rs` | New | 2 → 2; 62 → 63; 95 → 96 |
| `crates/ui-egui/src/ribbon/view.rs` | New | 3 → 3; 70 → 71; 166 → 167 |
| `crates/ui-egui/src/ribbon.rs` | New | 205 → 205; 233 → 234 |
| `crates/ui-egui/src/tabs.rs` | New | 345 → 345; 378 → 379; 487 → 488; 503 → 504 |

## Re-pinned inputs

Computed as `hashlib.sha256((NEW_BASE / relative_path).read_bytes()).hexdigest()` from the pristine tag, then independently verified after testing. The web pin changed from `9afd607079d4aad3d4a5f8c9639cebbdb2ed9814a75bbd154ab9ef1f146a341c` to the value below.

| Relative path | v0.17.0 SHA-256 |
|---|---|
| `crates/ui-egui/src/control.rs` | `707e845170b50eddbfde2b8bc3eb996a6e4bc294c44b887e172bc7266168ce38` |
| `apps/gridcraft-web/src/web.rs` | `4a6411a7380055f5a03682917316729f763088ca25d3357032f785e80972e6d1` |
| `crates/ui-egui/src/lib.rs` | `3e8244639d4d4575c2d44547338c10f92ba09375bc1f36e4f6274d71bb11e9ce` |
| `crates/ui-egui/src/backstage.rs` | `1eaf0c15a8b387dd0e659de62f5f8f3ca718fb0e159cbc9aedb742f7fa59da65` |
| `crates/ui-egui/src/dialogs.rs` | `e4eb60333fb4d5f4f26c4295c78c636d1eef511a0a4b332c9abc300bcbaa57e1` |
| `crates/ui-egui/src/ribbon.rs` | `10670d745f0c4bacbb7e5a273ace8df5a02d1fe182b66c62e313f34dd64072a0` |
| `crates/ui-egui/src/theme.rs` | `9e888c32e57e82baaf680fda02b619f600e81a9c4374c3ec7e16fb2ebab0ed01` |
| `apps/gridcraft-web/index.html` | `b92b0a676c6b6e98b1a61f48024e007eb9045f8298cb9c9e8c1b0116cdfaeb13` |
| `crates/ui-egui/src/services.rs` | `b2853b65102c1b67c7ef41fe2ffe515e97960f5faf7b448df4b4d644500551a1` |
| `crates/ui-egui/src/app.rs` | `d98863561e3bb561683fa029fc44abf4469bbce19f41fbf152062fe017353190` |
| `crates/ui-egui/src/app/commands.rs` | `d43d48f24a65c29efa39ba36d20a3225332a21c2fc8850d7fc98eeb64a7da818` |
| `crates/ui-egui/src/app/files.rs` | `4f3f3dbb6ac2fcd5fe93a1ff3072f02192b80bad99c682fa6e4be257cd42345d` |
| `crates/ui-egui/src/app/quit.rs` | `f8bbd4727501101a36c82ef94ef8d22bccecf76153bfe2558855d091c09df54f` |
| `crates/ui-egui/src/dialogs/show.rs` | `1b5eb08223c3d9c5e18a5a2daaab4d51eef19ea8050fb3e2612db9ac6c1455bd` |
| `crates/ui-egui/src/backstage/options.rs` | `7460a5ac545c813e6bc876c50a7ae3ed6b6dab09db7fbfee8041529416847906` |
| `crates/ui-egui/src/ribbon/title_bar.rs` | `adae16c2446caf8656aec607a980168ce2bfb8d0155ab0d92c5bdaba8bb9f6dd` |
| `crates/ui-egui/src/theme/font_fallback.rs` | `3c27ae87637711b58b17877d54e66c47d0007ce15488a381e851d312841fcecc` |

Kept font SHA-256: `fonts/NotoSansCJKtc-Regular.otf` = `dce08bd4fd91aa8aa76ed8fea4b694c2dfb8550f67871e326843212ddbeb88b4`; `OFL.txt` = `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2`. All 16 original text.index guards remain (16 → 16); unique-anchor checks and version checks remain. A modified pristine web file was rejected with exit 1 before any pinned source write.

## Validation (executed locally)

All commands used the final fresh patched source. Cargo environment: CARGO_HOME=/Volumes/Vibe-Temp/Studio5/cache/cargo; CARGO_TARGET_DIR=/Volumes/Vibe-Temp/Craft/targets/port-gridcraft; CRAFT_FONTS_DIR=/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts; TMPDIR=/Volumes/Vibe-Temp/Craft/tmp; RUSTC was the output of `rustup which rustc`. No toolchain or target was installed.

| Gate | Command / result | Exit |
|---|---|---|
| A | Fresh copy of NEW_BASE; prepare-gridcraft.py, prepare-file-access.py gridcraft, prepare-localization.py gridcraft in that order | 0 / 0 / 0 |
| B | cargo test --locked -p gridcraft-ui-egui --lib: 319 passed, 0 failed, 0 ignored | 0 |
| C | cargo check --locked -p gridcraft-web --target wasm32-unknown-unknown | 0 |
| D | src/grid-check.py: 7 passed, all 3 save mutations rejected | 0 |
| D | scripts/check-grid-localization.py: all 1,197 upstream keys covered, 1,609 unique zh-Hant keys | 0 |
| D | scripts/check-localization-mutations.py <patched-root>: all 5 GridCraft mutations detected, original source restored | 0 |
| Supporting | Node document/local-file/runtime tests: 23 passed, 0 skipped; document-storage mutations: 12/12 detected | 0 / 0 |
| Negative safety | Altered pristine web.rs is rejected before writes (expected failure) | 1 |

A output:

```text
GridCraft Studio adapter applied
Prepared gridcraft file identity and save intent
Applied Traditional Chinese interface to gridcraft 0.17.0
```

B tail:

```text
test floating_pictures::tests::pictures_are_decoded_at_about_the_size_drawn ... ok
test floating_pictures::tests::the_cache_stays_within_its_budget_but_keeps_what_is_on_screen ... ok

test result: ok. 319 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.03s
```

C tail:

```text
warning: `gridcraft-web` (bin "gridcraft-web") generated 8 warnings
    Finished `dev` profile [optimized + debuginfo] target(s) in 3.01s
```

D save-check tail:

```text
GridCraft save checks: 7 passed
Mutation check: removing the failed-save guard was rejected; source restored
Mutation check: forcing .xlsx instead of the source format was rejected; source restored
Mutation check: serializing macro workbooks as macro-free bytes was rejected; source restored
```

D catalog and localization-mutation tails:

```text
GridCraft interface catalogs: 1197 upstream keys covered; 1609 Traditional Chinese keys; no duplicates
Mutation 1: detected (gridcraft, traditional_chinese_locales)
Mutation 2: detected (gridcraft, traditional_chinese_locales)
Mutation 3: detected (gridcraft, traditional_chinese_equation_controls)
Mutation 4: detected (gridcraft, traditional_chinese_format)
Mutation 5: detected (gridcraft, traditional_chinese_code_editor_accessible)
All 5 mutations detected; original sources restored
```

Supporting test tails:

```text
✔ GridCraft Studio picker retains upstream SYLK import and document identity (1.025875ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 111.119334
Detected 12/12 document-storage mutations
```

Negative hash-pin tail:

```text
RuntimeError: Expected unmodified GridCraft v0.17.0: apps/gridcraft-web/src/web.rs
```

The four new Rust Studio UI checks exercise save-before-close with acknowledgement/rejection/later edits, draft commit and persisted AutoSave bypass protection, New/Open retaining dirty workbooks and successful identity binding, and programmatic password-cancel cleanup. Six localization checks include a real AccessKit name check, live egui text-shape assertions for the equation controls and single-pass substitution of user text containing braces. Save mutations exercise acknowledgement, retained source extension and preserved VBA bytes. No tests were ignored; no “No adapter found” failure occurred.

## Warnings and acceptance limits

- The first WASM attempt used Homebrew rustc, whose sysroot lacked the WASM standard library. The installed rustup toolchain already had wasm32-unknown-unknown; explicitly selecting it resolved the failure. The final C result above is successful.
- The supplied legacy font directory's optional craft-fonts manifest contains `pinned-source` rather than a 64-digit hash. Upstream warns and disables its optional craft-fonts set. This check was not changed or weakened. The existing Studio TC font still passes its separate SHA-256 check and is embedded in the web fallback. A complete new-format craft-fonts input was not supplied/tested.
- Cargo also reports upstream unused egui patches and unused upstream/shared helper code after the Studio host replacement. These are warnings, not failed checks.
- No unresolved adapter/test/compile failure remains. These results do not claim an authenticated Studio browser save/reopen or a published plugin; no such acceptance was run.

## Complete added translation list

All 1,208 additions below are copied from the actual catalog diff against this branch's original catalog; this includes missing legacy labels reused by the new dialogs. Existing translations stay. Formula/command identifiers, code tokens, platform/font/product names and workbook/user content remain unchanged. Terminology for iteration and Solver was checked against [Microsoft Support](https://support.microsoft.com/zh-tw/excel/change-formula-recalculation-iteration-or-precision-in-excel). English plural suffix placeholders are retained in the catalog contract and omitted by the translated counter formatter.

| English | zh-Hant |
|---|---|
| `` Header Menu\|Insert `` | `` 插入 `` |
| `` Equation `` | `` 方程式 `` |
| `` Insert New Equation... `` | `` 插入新方程式... `` |
| `` Button `` | `` 按鈕 `` |
| `` Slider `` | `` 滑桿 `` |
| `` Spin Button `` | `` 微調按鈕 `` |
| `` Draw a button that runs a macro or a command `` | `` 繪製可執行巨集或命令的按鈕 `` |
| `` Draw a slider that sets a whole number in a linked cell `` | `` 繪製可設定連結儲存格整數值的滑桿 `` |
| `` Draw a spin button that steps a whole number in a linked cell `` | `` 繪製可逐步調整連結儲存格整數值的微調按鈕 `` |
| `` Edit Text `` | `` 編輯文字 `` |
| `` Assign Action… `` | `` 指定動作… `` |
| `` Format Control… `` | `` 控制項格式… `` |
| `` Trace Error `` | `` 追蹤錯誤 `` |
| `` Circular References `` | `` 循環參照 `` |
| `` Python Mode `` | `` Python 模式 `` |
| `` Name Box `` | `` 名稱方塊 `` |
| `` Cell Editor `` | `` 儲存格編輯器 `` |
| `` Font Size `` | `` 字型大小 `` |
| `` First slice angle `` | `` 第一扇區角度 `` |
| `` Doughnut hole size `` | `` 環圈圖內徑大小 `` |
| `` Recently Used `` | `` 最近使用 `` |
| `` More Functions `` | `` 其他函數 `` |
| `` Print What `` | `` 列印內容 `` |
| `` Scale with Document `` | `` 隨文件縮放 `` |
| `` Align with Page Margins `` | `` 對齊頁面邊界 `` |
| `` Maximum Iterations: `` | `` 最多反覆運算次數： `` |
| `` Maximum Change: `` | `` 最大誤差： `` |
| `` Maximum Iterations must be a whole number from 1 to 32767. `` | `` 最多反覆運算次數必須是 1 到 32767 的整數。 `` |
| `` Maximum Change must be a number of 0 or more. `` | `` 最大誤差必須是大於或等於 0 的數字。 `` |
| `` Record Macro `` | `` 錄製巨集 `` |
| `` Stop Recording `` | `` 停止錄製 `` |
| `` Use Relative References `` | `` 使用相對參照 `` |
| `` Run\nMacro `` | `` 執行\n巨集 `` |
| `` Macros… `` | `` 巨集… `` |
| `` Recording `` | `` 錄製中 `` |
| `` New Macro `` | `` 新增巨集 `` |
| `` Show `` | `` 顯示 `` |
| `` OK `` | `` 確定 `` |
| `` Cancel `` | `` 取消 `` |
| `` Don't Save `` | `` 不要儲存 `` |
| `` Open… `` | `` 開啟… `` |
| `` Show password `` | `` 顯示密碼 `` |
| `` Start a new workbook `` | `` 建立新活頁簿 `` |
| `` Household Budget `` | `` 家庭預算 `` |
| `` Quarterly Sales Dashboard `` | `` 季度銷售儀表板 `` |
| `` Gradebook `` | `` 成績簿 `` |
| `` this workbook `` | `` 此活頁簿 `` |
| `` This workbook `` | `` 此活頁簿 `` |
| `` Do you want to save the changes you made to {title}? `` | `` 您要儲存對 {title} 所做的變更嗎？ `` |
| `` Save a copy as .{format} `` | `` 另存複本為 .{format} `` |
| `` Select a chart first. `` | `` 請先選取圖表。 `` |
| `` Text Box `` | `` 文字方塊 `` |
| `` Select Data `` | `` 選取資料 `` |
| `` Row Height `` | `` 列高 `` |
| `` Column Width `` | `` 欄寬 `` |
| `` Standard Width `` | `` 標準欄寬 `` |
| `` Rename Sheet `` | `` 重新命名工作表 `` |
| `` Move or Copy `` | `` 移動或複製 `` |
| `` Protect Sheet `` | `` 保護工作表 `` |
| `` Protect Structure and Windows `` | `` 保護結構及視窗 `` |
| `` Unprotect Workbook `` | `` 取消保護活頁簿 `` |
| `` Unprotect Sheet `` | `` 取消保護工作表 `` |
| `` Password `` | `` 密碼 `` |
| `` Unhide `` | `` 取消隱藏 `` |
| `` Paste Special `` | `` 選擇性貼上 `` |
| `` Series `` | `` 數列 `` |
| `` New Comment `` | `` 新增註解 `` |
| `` Insert Hyperlink `` | `` 插入超連結 `` |
| `` Create Sparklines `` | `` 建立走勢圖 `` |
| `` Page Setup `` | `` 版面設定 `` |
| `` Convert Text to Columns `` | `` 資料剖析 `` |
| `` Remove Duplicates `` | `` 移除重複項 `` |
| `` Goal Seek `` | `` 目標搜尋 `` |
| `` Create Forecast Worksheet `` | `` 建立預測工作表 `` |
| `` Solver Parameters `` | `` 規劃求解參數 `` |
| `` Solver Results `` | `` 規劃求解結果 `` |
| `` Edit Name `` | `` 編輯名稱 `` |
| `` New Name `` | `` 新增名稱 `` |
| `` Format Cells `` | `` 儲存格格式 `` |
| `` Find and Replace `` | `` 尋找及取代 `` |
| `` Go To `` | `` 到 `` |
| `` Insert Calculated Field `` | `` 插入導出欄位 `` |
| `` Go To Special `` | `` 特殊目標 `` |
| `` Name Manager `` | `` 名稱管理員 `` |
| `` Conditional Formatting Rules Manager `` | `` 條件式格式設定規則管理員 `` |
| `` Search Commands `` | `` 搜尋命令 `` |
| `` Agent Control `` | `` 代理程式控制 `` |
| `` About GridCraft `` | `` 關於 GridCraft `` |
| `` Insert Chart `` | `` 插入圖表 `` |
| `` Select Data Source `` | `` 選取資料來源 `` |
| `` Action Journal `` | `` 動作記錄 `` |
| `` Macros `` | `` 巨集 `` |
| `` Workbook Statistics `` | `` 活頁簿統計資料 `` |
| `` Accessibility `` | `` 協助工具 `` |
| `` Chart Title `` | `` 圖表標題 `` |
| `` Place Picture in Cell `` | `` 將圖片置於儲存格內 `` |
| `` Place Picture over Cells `` | `` 將圖片置於儲存格上方 `` |
| `` Pick From List `` | `` 從清單挑選 `` |
| `` Save a Copy `` | `` 儲存複本 `` |
| `` Save Changes? `` | `` 儲存變更？ `` |
| `` Shift cells right `` | `` 儲存格右移 `` |
| `` Shift cells down `` | `` 儲存格下移 `` |
| `` Shift cells left `` | `` 儲存格左移 `` |
| `` Shift cells up `` | `` 儲存格上移 `` |
| `` Entire row `` | `` 整列 `` |
| `` Entire column `` | `` 整欄 `` |
| `` Row height (pixels): `` | `` 列高（像素）： `` |
| `` Column width (characters): `` | `` 欄寬（字元）： `` |
| `` Standard column width (pixels): `` | `` 標準欄寬（像素）： `` |
| `` Name: `` | `` 名稱： `` |
| `` Before sheet (position, 0 = first): `` | `` 工作表之前（位置，0 為第一張）： `` |
| `` Create a copy `` | `` 建立複本 `` |
| `` Sheets: {sheets} `` | `` 工作表：{sheets} `` |
| `` Password (optional): `` | `` 密碼（選填）： `` |
| `` Password: `` | `` 密碼： `` |
| `` Allow all users of this sheet to: `` | `` 允許此工作表的所有使用者： `` |
| `` Format cells `` | `` 設定儲存格格式 `` |
| `` Format columns `` | `` 設定欄格式 `` |
| `` Format rows `` | `` 設定列格式 `` |
| `` Insert rows `` | `` 插入列 `` |
| `` Delete rows `` | `` 刪除列 `` |
| `` Use AutoFilter `` | `` 使用自動篩選 `` |
| ``  (password, unlocked) `` | ``  （密碼，已解除鎖定） `` |
| ``  (password) `` | ``  （密碼） `` |
| `` No ranges yet. `` | `` 尚無範圍。 `` |
| `` Ranges that stay editable when the sheet is protected: `` | `` 工作表受保護時仍可編輯的範圍： `` |
| `` Action `` | `` 動作 `` |
| `` Modify `` | `` 修改 `` |
| `` Unlock with password `` | `` 以密碼解除鎖定 `` |
| `` Title: `` | `` 標題： `` |
| `` Refers to cells: `` | `` 參照儲存格： `` |
| `` Range password: `` | `` 範圍密碼： `` |
| `` New title (Modify): `` | `` 新標題（修改）： `` |
| `` Remove the password (Modify) `` | `` 移除密碼（修改） `` |
| `` '{file}' is protected. `` | `` 「{file}」受到保護。 `` |
| `` Unhide sheet: `` | `` 取消隱藏工作表： `` |
| `` Hidden: {sheets} `` | `` 已隱藏：{sheets} `` |
| `` All `` | `` 全部 `` |
| `` Formulas (F) `` | `` 公式 (F) `` |
| `` Values (V) `` | `` 值 (V) `` |
| `` Formats (T) `` | `` 格式 (T) `` |
| `` Comments and notes (C) `` | `` 註解和備註 (C) `` |
| `` Validation `` | `` 驗證 `` |
| `` All except borders `` | `` 除框線外全部 `` |
| `` Column widths `` | `` 欄寬 `` |
| `` Formulas and number formats `` | `` 公式與數字格式 `` |
| `` Values and number formats `` | `` 值與數字格式 `` |
| `` Operation `` | `` 運算 `` |
| `` Add `` | `` 加 `` |
| `` Subtract `` | `` 減 `` |
| `` Multiply `` | `` 乘 `` |
| `` Divide `` | `` 除 `` |
| `` Skip blanks `` | `` 略過空白 `` |
| `` Transpose (E) `` | `` 轉置 (E) `` |
| `` Series in `` | `` 數列方向 `` |
| `` Columns `` | `` 欄 `` |
| `` Rows `` | `` 列 `` |
| `` Type `` | `` 類型 `` |
| `` Linear `` | `` 等差 `` |
| `` Growth `` | `` 等比 `` |
| `` Date unit `` | `` 日期單位 `` |
| `` Day `` | `` 日 `` |
| `` Weekday `` | `` 工作日 `` |
| `` Month `` | `` 月 `` |
| `` Year `` | `` 年 `` |
| `` Step value: `` | `` 間距值： `` |
| `` Stop value: `` | `` 終止值： `` |
| `` Start a conversation: `` | `` 開始交談： `` |
| `` Note: `` | `` 備註： `` |
| `` Display: `` | `` 顯示文字： `` |
| `` Link to (web address, e-mail or Sheet!A1): `` | `` 連結至（網址、電子郵件或 Sheet!A1）： `` |
| `` ScreenTip: `` | `` 工具提示： `` |
| `` Data Range: `` | `` 資料範圍： `` |
| `` Location Range: `` | `` 位置範圍： `` |
| `` Markers `` | `` 標記 `` |
| `` Footer: `` | `` 頁尾： `` |
| `` Left margin (in): `` | `` 左邊界（英吋）： `` |
| `` Right margin (in): `` | `` 右邊界（英吋）： `` |
| `` Top margin (in): `` | `` 上邊界（英吋）： `` |
| `` Bottom margin (in): `` | `` 下邊界（英吋）： `` |
| `` Header (in): `` | `` 頁首（英吋）： `` |
| `` Footer (in): `` | `` 頁尾（英吋）： `` |
| `` Page order `` | `` 頁面順序 `` |
| `` Down, then over `` | `` 先列後欄 `` |
| `` Over, then down `` | `` 先欄後列 `` |
| `` Tab `` | `` 定位字元 `` |
| `` Semicolon `` | `` 分號 `` |
| `` Comma `` | `` 逗號 `` |
| `` Space `` | `` 空格 `` |
| `` Other: `` | `` 其他： `` |
| `` Treat consecutive delimiters as one `` | `` 連續分隔符號視為一個 `` |
| `` Destination: `` | `` 目的地： `` |
| `` My data has headers `` | `` 我的資料有標題 `` |
| `` Columns (blank = all, e.g. A,C): `` | `` 欄（留白為全部，例如 A,C）： `` |
| `` Timeline range (blank: first column of the selection): `` | `` 時間表範圍（留白：選取範圍的第一欄）： `` |
| `` Values range (blank: second column of the selection): `` | `` 值範圍（留白：選取範圍的第二欄）： `` |
| `` Confidence interval `` | `` 信賴區間 `` |
| `` Confidence level (%): `` | `` 信賴水準 (%)： `` |
| `` Seasonality (auto, 0 for none, or a season length): `` | `` 季節性（auto、0 表示無，或季節長度）： `` |
| `` Fill missing points using `` | `` 填入遺漏點的方式 `` |
| `` Interpolation `` | `` 插補法 `` |
| `` Zeros `` | `` 零 `` |
| `` Aggregate duplicates using `` | `` 彙總重複項目的方式 `` |
| `` Average `` | `` 平均值 `` |
| `` Count `` | `` 計數 `` |
| `` CountA `` | `` 非空白計數 `` |
| `` Max `` | `` 最大值 `` |
| `` Median `` | `` 中位數 `` |
| `` Min `` | `` 最小值 `` |
| `` Sum `` | `` 加總 `` |
| `` Product `` | `` 乘積 `` |
| `` Include forecast statistics `` | `` 包含預測統計資料 `` |
| `` Chart `` | `` 圖表 `` |
| `` Line chart `` | `` 折線圖 `` |
| `` Column chart `` | `` 直條圖 `` |
| `` At each change in (column letter): `` | `` 每次變更（欄字母）： `` |
| `` Use function `` | `` 使用函數 `` |
| `` Add subtotal to (columns, e.g. C,D): `` | `` 新增小計至（欄，例如 C,D）： `` |
| `` Magnification `` | `` 放大比例 `` |
| `` Custom (%): `` | `` 自訂 (%)： `` |
| `` Scope (Workbook or sheet name): `` | `` 範圍（活頁簿或工作表名稱）： `` |
| `` Comment: `` | `` 註解： `` |
| `` Refers to: `` | `` 參照到： `` |
| `` Allow `` | `` 允許 `` |
| `` Any value `` | `` 任何值 `` |
| `` Whole number `` | `` 整數 `` |
| `` Decimal `` | `` 小數 `` |
| `` List `` | `` 清單 `` |
| `` Text length `` | `` 文字長度 `` |
| `` between `` | `` 介於 `` |
| `` not between `` | `` 不介於 `` |
| `` equal to `` | `` 等於 `` |
| `` not equal to `` | `` 不等於 `` |
| `` greater than `` | `` 大於 `` |
| `` less than `` | `` 小於 `` |
| `` greater than or equal to `` | `` 大於或等於 `` |
| `` less than or equal to `` | `` 小於或等於 `` |
| `` Minimum / Source / Formula: `` | `` 最小值／來源／公式： `` |
| `` Maximum: `` | `` 最大值： `` |
| `` Ignore blank `` | `` 忽略空白 `` |
| `` In-cell dropdown `` | `` 儲存格內下拉式清單 `` |
| `` Input message: `` | `` 輸入訊息： `` |
| `` Error style `` | `` 錯誤樣式 `` |
| `` Stop `` | `` 停止 `` |
| `` Warning `` | `` 警告 `` |
| `` Information `` | `` 資訊 `` |
| `` Error message: `` | `` 錯誤訊息： `` |
| `` Format cells that are (value): `` | `` 設定儲存格格式的條件（值）： `` |
| `` and: `` | `` 且： `` |
| `` Format cells that contain the text: `` | `` 設定包含此文字的儲存格格式： `` |
| `` Format cells that contain a date occurring: `` | `` 設定包含此日期的儲存格格式： `` |
| `` Today `` | `` 今天 `` |
| `` Tomorrow `` | `` 明天 `` |
| `` In the last 7 days `` | `` 過去 7 天 `` |
| `` Last week `` | `` 上週 `` |
| `` This week `` | `` 本週 `` |
| `` Next week `` | `` 下週 `` |
| `` Last month `` | `` 上個月 `` |
| `` This month `` | `` 這個月 `` |
| `` Next month `` | `` 下個月 `` |
| `` Format values where this formula is true: `` | `` 在此公式為 True 時設定值的格式： `` |
| `` with `` | `` 套用 `` |
| `` Light Red Fill with Dark Red Text `` | `` 淺紅色填滿深紅色文字 `` |
| `` Yellow Fill with Dark Yellow Text `` | `` 黃色填滿深黃色文字 `` |
| `` Green Fill with Dark Green Text `` | `` 綠色填滿深綠色文字 `` |
| `` Light Red Fill `` | `` 淺紅色填滿 `` |
| `` Red Text `` | `` 紅色文字 `` |
| `` Red Border `` | `` 紅色框線 `` |
| `` Formula: `` | `` 公式： `` |
| `` Select `` | `` 選取 `` |
| `` Blanks `` | `` 空格 `` |
| `` Errors `` | `` 錯誤 `` |
| `` Numbers `` | `` 數字 `` |
| `` Current region `` | `` 目前區域 `` |
| `` Last cell `` | `` 最後一個儲存格 `` |
| `` Visible cells only `` | `` 可見儲存格 `` |
| `` Conditional formats `` | `` 條件式格式 `` |
| `` Data validation `` | `` 資料驗證 `` |
| `` Horizontal axis title: `` | `` 水平座標軸標題： `` |
| `` Vertical axis title: `` | `` 垂直座標軸標題： `` |
| `` No picture selected `` | `` 未選取圖片 `` |
| `` Picture file path (PNG or JPEG): `` | `` 圖片檔案路徑（PNG 或 JPEG）： `` |
| `` Description (optional): `` | `` 描述（選填）： `` |
| `` Fits inside the selected cell and moves with its content. `` | `` 配合選取的儲存格大小，並隨內容移動。 `` |
| `` Choose a PNG or JPEG no larger than 16 MB. `` | `` 請選擇不超過 16 MB 的 PNG 或 JPEG。 `` |
| `` About `` | `` 關於 `` |
| `` Contributors `` | `` 參與者 `` |
| `` Models `` | `` 模型 `` |
| `` Version {version} `` | `` 版本 {version} `` |
| `` Join the ArtCraft Discord `` | `` 加入 ArtCraft Discord `` |
| `` This workbook has no scripts or macros. `` | `` 此活頁簿沒有指令碼或巨集。 `` |
| `` (unnamed) `` | `` （未命名） `` |
| `` — VBA project (preserved, not run) `` | `` — VBA 專案（保留但不執行） `` |
| `` — 1 step `` | `` — 1 個步驟 `` |
| `` — {steps} steps `` | `` — {steps} 個步驟 `` |
| `` Alignment `` | `` 對齊方式 `` |
| `` Font `` | `` 字型 `` |
| `` Border `` | `` 框線 `` |
| `` Format Cells\|Fill `` | `` 填滿 `` |
| `` Protection `` | `` 保護 `` |
| `` Category: `` | `` 類別： `` |
| `` Sample `` | `` 範例 `` |
| `` Type (custom format code): `` | `` 類型（自訂格式代碼）： `` |
| `` Vertical `` | `` 垂直 `` |
| `` Justify `` | `` 左右對齊 `` |
| `` Center Across Selection `` | `` 跨欄置中 `` |
| `` Distributed `` | `` 分散對齊 `` |
| `` Top `` | `` 靠上 `` |
| `` Bottom `` | `` 靠下 `` |
| `` Indent `` | `` 縮排 `` |
| `` Orientation (degrees) `` | `` 方向（度） `` |
| `` Wrap text `` | `` 自動換列 `` |
| `` Shrink to fit `` | `` 縮小字型以適合欄寬 `` |
| `` Bold `` | `` 粗體 `` |
| `` Italic `` | `` 斜體 `` |
| `` None `` | `` 無 `` |
| `` Single `` | `` 單線 `` |
| `` Double `` | `` 雙線 `` |
| `` Single Accounting `` | `` 會計用單線 `` |
| `` Double Accounting `` | `` 會計用雙線 `` |
| `` Superscript `` | `` 上標 `` |
| `` Subscript `` | `` 下標 `` |
| `` Color: `` | `` 色彩： `` |
| `` Outline `` | `` 外框 `` |
| `` Diagonal ↘ `` | `` 對角線 ↘ `` |
| `` Diagonal ↗ `` | `` 對角線 ↗ `` |
| `` none `` | `` 無 `` |
| `` thin `` | `` 細 `` |
| `` medium `` | `` 中 `` |
| `` thick `` | `` 粗 `` |
| `` dashed `` | `` 虛線 `` |
| `` dotted `` | `` 點線 `` |
| `` double `` | `` 雙線 `` |
| `` Background Color: `` | `` 背景色彩： `` |
| `` Locked `` | `` 鎖定 `` |
| `` Hidden `` | `` 隱藏 `` |
| `` Search: `` | `` 搜尋： `` |
| `` e.g. lookup, average, date `` | `` 例如查閱、平均、日期 `` |
| `` Date & Time `` | `` 日期與時間 `` |
| `` Lookup & Reference `` | `` 查閱與參照 `` |
| `` Math & Trig `` | `` 數學與三角函數 `` |
| `` Statistical `` | `` 統計 `` |
| `` Engineering `` | `` 工程 `` |
| `` Database `` | `` 資料庫 `` |
| `` Compatibility `` | `` 相容性 `` |
| `` Web `` | `` 網頁 `` |
| `` Cube `` | `` Cube `` |
| `` Add-in and Automation `` | `` 增益集與自動化 `` |
| `` Find `` | `` 尋找 `` |
| `` Replace `` | `` 取代 `` |
| `` Find what: `` | `` 尋找目標： `` |
| `` Replace with: `` | `` 取代為： `` |
| `` Match case `` | `` 區分大小寫 `` |
| `` Match entire cell contents `` | `` 儲存格內容完全相符 `` |
| `` Within workbook `` | `` 活頁簿內 `` |
| `` Replace All `` | `` 全部取代 `` |
| `` Find All `` | `` 全部尋找 `` |
| `` Find Next `` | `` 找下一個 `` |
| `` All done. We made {count} replacements. `` | `` 已完成，共取代 {count} 處。 `` |
| `` {count} cell(s) found `` | `` 找到 {count} 個儲存格 `` |
| `` Reference: `` | `` 參照： `` |
| `` Special… `` | `` 特殊… `` |
| `` My list has headers `` | `` 清單有標題 `` |
| `` Sort by `` | `` 排序方式 `` |
| `` Then by `` | `` 次要排序方式 `` |
| `` Cell Values `` | `` 儲存格值 `` |
| `` Cell Color `` | `` 儲存格色彩 `` |
| `` A to Z `` | `` A 到 Z `` |
| `` Z to A `` | `` Z 到 A `` |
| `` + Add Level `` | `` + 新增層級 `` |
| `` New… `` | `` 新增… `` |
| `` Edit… `` | `` 編輯… `` |
| `` Name `` | `` 名稱 `` |
| `` Value `` | `` 值 `` |
| `` Refers To `` | `` 參照到 `` |
| `` Scope `` | `` 範圍 `` |
| `` Workbook `` | `` 活頁簿 `` |
| `` No names defined `` | `` 未定義名稱 `` |
| `` Recommended Charts `` | `` 建議圖表 `` |
| `` All Charts `` | `` 所有圖表 `` |
| `` Clustered Column `` | `` 群組直條圖 `` |
| `` Stacked Column `` | `` 堆疊直條圖 `` |
| `` 100% Stacked Column `` | `` 百分比堆疊直條圖 `` |
| `` Clustered Bar `` | `` 群組橫條圖 `` |
| `` Stacked Bar `` | `` 堆疊橫條圖 `` |
| `` 100% Stacked Bar `` | `` 百分比堆疊橫條圖 `` |
| `` Line `` | `` 折線圖 `` |
| `` Line with Markers `` | `` 含資料標記的折線圖 `` |
| `` Stacked Line `` | `` 堆疊折線圖 `` |
| `` Pie `` | `` 圓形圖 `` |
| `` Doughnut `` | `` 環圈圖 `` |
| `` Area `` | `` 區域圖 `` |
| `` Stacked Area `` | `` 堆疊區域圖 `` |
| `` 100% Stacked Area `` | `` 百分比堆疊區域圖 `` |
| `` Scatter `` | `` 散佈圖 `` |
| `` Scatter with Lines `` | `` 含直線的散佈圖 `` |
| `` Radar `` | `` 雷達圖 `` |
| `` Histogram `` | `` 直方圖 `` |
| `` Waterfall `` | `` 瀑布圖 `` |
| `` Funnel `` | `` 漏斗圖 `` |
| `` Combo `` | `` 組合圖 `` |
| `` Chart data range: `` | `` 圖表資料範圍： `` |
| `` Legend Entries (Series) `` | `` 圖例項目（數列） `` |
| `` Series{n} `` | `` 數列{n} `` |
| `` Keep `` | `` 保留 `` |
| `` Remove `` | `` 移除 `` |
| `` Horizontal (Category) Axis Labels: `` | `` 水平（類別）座標軸標籤： `` |
| `` There are no conditional formatting rules on this sheet. `` | `` 此工作表沒有條件式格式設定規則。 `` |
| `` applies to `` | `` 套用到 `` |
| `` Type a command, e.g. freeze, chart, bold… `` | `` 輸入命令，例如凍結、圖表、粗體… `` |
| `` Set cell: `` | `` 目標儲存格： `` |
| `` To value: `` | `` 目標值： `` |
| `` By changing cell: `` | `` 變數儲存格： `` |
| `` Goal Seeking found a solution: {value} `` | `` 目標搜尋已找到解答：{value} `` |
| `` Analysis Tools `` | `` 分析工具 `` |
| `` Anova: Single Factor `` | `` 單因子變異數分析 `` |
| `` Correlation `` | `` 相關係數 `` |
| `` Covariance `` | `` 共變異數 `` |
| `` Descriptive Statistics `` | `` 敘述統計 `` |
| `` Exponential Smoothing `` | `` 指數平滑法 `` |
| `` F-Test Two-Sample for Variances `` | `` F 檢定：兩個常態母體變異數的比較 `` |
| `` Moving Average `` | `` 移動平均 `` |
| `` Rank and Percentile `` | `` 等級及百分位數 `` |
| `` Regression `` | `` 迴歸 `` |
| `` t-Test: Paired Two Sample for Means `` | `` t 檢定：成對母體平均數差異檢定 `` |
| `` t-Test: Two-Sample Assuming Equal Variances `` | `` t 檢定：兩個母體平均數差異檢定，假設變異數相等 `` |
| `` t-Test: Two-Sample Assuming Unequal Variances `` | `` t 檢定：兩個母體平均數差異檢定，假設變異數不相等 `` |
| `` Output options `` | `` 輸出選項 `` |
| `` Output Range: `` | `` 輸出範圍： `` |
| `` New Worksheet Ply: `` | `` 新工作表： `` |
| `` Grouped By: `` | `` 分組方式： `` |
| `` Labels in first row `` | `` 首列有標籤 `` |
| `` Input Range: `` | `` 輸入範圍： `` |
| `` Variable 1 Range: `` | `` 變數 1 範圍： `` |
| `` Variable 2 Range: `` | `` 變數 2 範圍： `` |
| `` Summary statistics `` | `` 摘要統計 `` |
| `` Confidence Level for Mean (%), blank for none: `` | `` 平均數的信賴水準 (%)，留白表示不使用： `` |
| `` Kth Largest (blank for none): `` | `` 第 K 大值（留白表示不使用）： `` |
| `` Kth Smallest (blank for none): `` | `` 第 K 小值（留白表示不使用）： `` |
| `` Bin Range (blank for automatic bins): `` | `` 組界範圍（留白表示自動分組）： `` |
| `` Pareto (sorted histogram) `` | `` 柏拉圖（排序直方圖） `` |
| `` Cumulative Percentage `` | `` 累加百分比 `` |
| `` Alpha: `` | `` Alpha： `` |
| `` Input Y Range: `` | `` Y 值輸入範圍： `` |
| `` Input X Range: `` | `` X 值輸入範圍： `` |
| `` Constant is Zero `` | `` 常數為零 `` |
| `` Confidence Level (%): `` | `` 信賴水準 (%)： `` |
| `` Residuals `` | `` 殘差 `` |
| `` Standardized Residuals `` | `` 標準化殘差 `` |
| `` Normal Probability `` | `` 常態機率 `` |
| `` Interval: `` | `` 間距： `` |
| `` Standard Errors `` | `` 標準誤 `` |
| `` Damping factor: `` | `` 阻尼係數： `` |
| `` Hypothesized Mean Difference: `` | `` 假設的平均差： `` |
| `` Set Objective: `` | `` 設定目標： `` |
| `` To: `` | `` 等於： `` |
| `` Value Of: `` | `` 目標值： `` |
| `` By Changing Variable Cells: `` | `` 變更變數儲存格： `` |
| `` Subject to the Constraints: `` | `` 限制式： `` |
| `` Make Unconstrained Variables Non-Negative `` | `` 使無限制式的變數為非負數 `` |
| `` Select a Solving Method: `` | `` 選取求解方法： `` |
| `` GRG Nonlinear `` | `` GRG 非線性 `` |
| `` Solve `` | `` 求解 `` |
| `` Keep Solver Solution `` | `` 保留規劃求解結果 `` |
| `` Restore Original Values `` | `` 還原原始值 `` |
| `` The spelling check is complete for the entire sheet. `` | `` 已完成整張工作表的拼字檢查。 `` |
| `` Not in Dictionary ({cell}): `` | `` 字典中找不到 ({cell})： `` |
| `` Suggestions: `` | `` 建議： `` |
| `` (No suggestions) `` | `` （無建議） `` |
| `` Ignore Once `` | `` 忽略一次 `` |
| `` Add to Dictionary `` | `` 新增至字典 `` |
| `` Change `` | `` 變更 `` |
| `` Change All `` | `` 全部變更 `` |
| `` $ English (United States) `` | `` $ 英文（美國） `` |
| `` Add Chart Element `` | `` 新增圖表項目 `` |
| `` Align Left `` | `` 靠左對齊 `` |
| `` Align Right `` | `` 靠右對齊 `` |
| `` Bottom Align `` | `` 靠下對齊 `` |
| `` Calculate Now (F9) `` | `` 立即計算 (F9) `` |
| `` Calculate Sheet (⇧F9) `` | `` 計算工作表 (⇧F9) `` |
| `` Calculation Options `` | `` 計算選項 `` |
| `` Cell Styles `` | `` 儲存格樣式 `` |
| `` Change Chart Type `` | `` 變更圖表類型 `` |
| `` Check Accessibility `` | `` 檢查協助工具 `` |
| `` Clear Filter `` | `` 清除篩選 `` |
| `` Column or Bar `` | `` 直條圖或橫條圖 `` |
| `` Comments pane `` | `` 註解窗格 `` |
| `` Convert the last ink stroke to a shape `` | `` 將最後一筆筆跡轉換為圖案 `` |
| `` Convert to Range `` | `` 轉換為範圍 `` |
| `` Copy `` | `` 複製 `` |
| `` Custom Sort `` | `` 自訂排序 `` |
| `` Cut `` | `` 剪下 `` |
| `` Define Name… `` | `` 定義名稱… `` |
| `` Delete Comment `` | `` 刪除註解 `` |
| `` Delete Sheet `` | `` 刪除工作表 `` |
| `` Delete chart `` | `` 刪除圖表 `` |
| `` Delete… `` | `` 刪除… `` |
| `` Dismiss `` | `` 關閉 `` |
| `` Down `` | `` 向下 `` |
| `` Edit chart title `` | `` 編輯圖表標題 `` |
| `` Erase ink strokes `` | `` 擦除筆跡 `` |
| `` Every command run in this session (replayable) `` | `` 此工作階段執行的每個命令（可重播） `` |
| `` Expand formula bar `` | `` 展開資料編輯列 `` |
| `` Filter by Selected Cell's Value `` | `` 依選取儲存格的值篩選 `` |
| `` Find & Select `` | `` 尋找與選取 `` |
| `` Forecast Sheet `` | `` 預測工作表 `` |
| `` Forecast end (date or number; blank: a third of the history): `` | `` 預測結束（日期或數字；留白：歷史資料的三分之一）： `` |
| `` Format Chart pane `` | `` 圖表格式窗格 `` |
| `` Format as Table `` | `` 格式化為表格 `` |
| `` Hide `` | `` 隱藏 `` |
| `` Hide Sheet `` | `` 隱藏工作表 `` |
| `` Hierarchy & more `` | `` 階層圖及其他 `` |
| `` Highlighter `` | `` 螢光筆 `` |
| `` How agents drive GridCraft (MCP / control channel) `` | `` 代理程式如何操作 GridCraft（MCP／控制通道） `` |
| `` Import a text or CSV file `` | `` 匯入文字檔或 CSV 檔案 `` |
| `` Insert Function `` | `` 插入函數 `` |
| `` Insert Function (⇧F3) `` | `` 插入函數 (⇧F3) `` |
| `` Insert Link `` | `` 插入連結 `` |
| `` Insert Sheet `` | `` 插入工作表 `` |
| `` Insert Slicer `` | `` 插入交叉分析篩選器 `` |
| `` Insert a picture `` | `` 插入圖片 `` |
| `` Insert a slicer to filter a table `` | `` 插入交叉分析篩選器以篩選表格 `` |
| `` Insert an icon `` | `` 插入圖示 `` |
| `` Insert… `` | `` 插入… `` |
| `` Line or Area `` | `` 折線圖或區域圖 `` |
| `` Link… `` | `` 連結… `` |
| `` Macros and scripts in this workbook (Alt+F8) `` | `` 此活頁簿的巨集與指令碼 (Alt+F8) `` |
| `` Middle Align `` | `` 垂直置中 `` |
| `` More commands `` | `` 其他命令 `` |
| `` Move or Copy Sheet… `` | `` 移動或複製工作表… `` |
| `` New sheet (⇧F11) `` | `` 新增工作表 (⇧F11) `` |
| `` Next sheet `` | `` 下一張工作表 `` |
| `` Page Breaks `` | `` 分頁符號 `` |
| `` Paper Size `` | `` 紙張大小 `` |
| `` Pick From Drop-down List… `` | `` 從下拉式清單挑選… `` |
| `` Pie or Doughnut `` | `` 圓形圖或環圈圖 `` |
| `` Previous sheet `` | `` 上一張工作表 `` |
| `` Print Area `` | `` 列印範圍 `` |
| `` Print Titles `` | `` 列印標題 `` |
| `` Protect Workbook structure `` | `` 保護活頁簿結構 `` |
| `` Redo `` | `` 取消復原 `` |
| `` Scatter or Bubble `` | `` 散佈圖或泡泡圖 `` |
| `` Search and run any command `` | `` 搜尋並執行任何命令 `` |
| `` Search commands `` | `` 搜尋命令 `` |
| `` Select and move ink and shapes `` | `` 選取並移動筆跡與圖案 `` |
| `` Series… `` | `` 數列… `` |
| `` Share: export or save a copy `` | `` 共用：匯出或儲存複本 `` |
| `` Show Formulas (⌃`) `` | `` 顯示公式 (⌃`) `` |
| `` Slicer `` | `` 交叉分析篩選器 `` |
| `` Sort & Filter `` | `` 排序與篩選 `` |
| `` Spelling (F7) `` | `` 拼字檢查 (F7) `` |
| `` Statistic `` | `` 統計圖 `` |
| `` Switch Row/Column `` | `` 切換列／欄 `` |
| `` Table Styles `` | `` 表格樣式 `` |
| `` Text to Columns `` | `` 資料剖析 `` |
| `` The output range already holds data. Replace it with the report? `` | `` 輸出範圍已有資料，是否以報表取代？ `` |
| `` Top Align `` | `` 靠上對齊 `` |
| `` Undo `` | `` 復原 `` |
| `` Undo list `` | `` 復原清單 `` |
| `` Unhide Sheet… `` | `` 取消隱藏工作表… `` |
| `` Up `` | `` 向上 `` |
| `` Version, contributors and the AI models that helped `` | `` 版本、參與者及協助開發的 AI 模型 `` |
| `` What-If Analysis `` | `` 模擬分析 `` |
| `` Zoom In `` | `` 放大 `` |
| `` Zoom Out `` | `` 縮小 `` |
| `` Zoom to 100% `` | `` 縮放至 100% `` |
| `` Zoom to Selection `` | `` 縮放至選取範圍 `` |
| `` Zoom… `` | `` 縮放… `` |
| `` £ English (United Kingdom) `` | `` £ 英文（英國） `` |
| `` ¥ Japanese `` | `` ¥ 日文 `` |
| `` € Euro `` | `` € 歐元 `` |
| `` Tab\|Insert `` | `` 插入 `` |
| `` Insert\nSlicer `` | `` 插入\n交叉分析篩選器 `` |
| `` Pen\nBlack `` | `` 畫筆\n黑色 `` |
| `` Pen\nBlue `` | `` 畫筆\n藍色 `` |
| `` Pen\nRed `` | `` 畫筆\n紅色 `` |
| `` Protect\nSheet `` | `` 保護\n工作表 `` |
| `` Watch\nWindow `` | `` 監看\n視窗 `` |
| `` Workbook\nStatistics `` | `` 活頁簿\n統計資料 `` |
| `` Account `` | `` 帳戶 `` |
| `` Product Information `` | `` 產品資訊 `` |
| `` Version `` | `` 版本 `` |
| `` Platform `` | `` 平台 `` |
| `` Licence `` | `` 授權 `` |
| `` Fit selection `` | `` 配合選取範圍 `` |
| `` All sheets `` | `` 所有工作表 `` |
| `` Convert to Number `` | `` 轉換成數字 `` |
| `` Duplicate `` | `` 建立複本 `` |
| `` Error checking options `` | `` 錯誤檢查選項 `` |
| `` Format Chart Area… `` | `` 圖表區格式… `` |
| `` Move or Copy… `` | `` 移動或複製… `` |
| `` No Color `` | `` 無色彩 `` |
| `` Number Stored as Text `` | `` 以文字儲存的數字 `` |
| `` Paste formulas that refer to the copied cells `` | `` 貼上參照已複製儲存格的公式 `` |
| `` Rename `` | `` 重新命名 `` |
| `` Select All Sheets `` | `` 選取所有工作表 `` |
| `` Select Data… `` | `` 選取資料… `` |
| `` Tab Color `` | `` 索引標籤色彩 `` |
| `` Unhide… `` | `` 取消隱藏… `` |
| `` Unprotect Sheet… `` | `` 取消保護工作表… `` |
| `` Collapse dialog `` | `` 摺疊對話方塊 `` |
| `` Expand dialog `` | `` 展開對話方塊 `` |
| `` Filter (⌘⇧F) `` | `` 篩選 (⌘⇧F) `` |
| `` Flash Fill (⌘E) `` | `` 快速填入 (⌘E) `` |
| `` Insert Link (⌘K) `` | `` 插入連結 (⌘K) `` |
| `` Paste (⌘V) `` | `` 貼上 (⌘V) `` |
| `` Redo (⌘Y) `` | `` 取消復原 (⌘Y) `` |
| `` Save (⌘S) `` | `` 儲存 (⌘S) `` |
| `` Search commands (⌘⇧Space) `` | `` 搜尋命令 (⌘⇧Space) `` |
| `` Table (⌘T) `` | `` 表格 (⌘T) `` |
| `` Undo (⌘Z) `` | `` 復原 (⌘Z) `` |
| `` New Workbook `` | `` 新增活頁簿 `` |
| `` Save As… `` | `` 另存新檔… `` |
| `` Print… `` | `` 列印… `` |
| `` Export as PDF… `` | `` 匯出為 PDF… `` |
| `` Save a Copy as Excel Workbook (.xlsx)… `` | `` 儲存複本為 Excel 活頁簿 (.xlsx)… `` |
| `` Export as CSV… `` | `` 匯出為 CSV… `` |
| `` Export as Web Page (.html)… `` | `` 匯出為網頁 (.html)… `` |
| `` Bottom Border `` | `` 下框線 `` |
| `` Top Border `` | `` 上框線 `` |
| `` Left Border `` | `` 左框線 `` |
| `` Right Border `` | `` 右框線 `` |
| `` No Border `` | `` 無框線 `` |
| `` All Borders `` | `` 所有框線 `` |
| `` Outside Borders `` | `` 外框線 `` |
| `` Thick Outside Borders `` | `` 粗外框線 `` |
| `` Bottom Double Border `` | `` 雙下框線 `` |
| `` Thick Bottom Border `` | `` 粗下框線 `` |
| `` Top and Bottom Border `` | `` 上下框線 `` |
| `` Top and Thick Bottom Border `` | `` 上框線及粗下框線 `` |
| `` Top and Double Bottom Border `` | `` 上框線及雙下框線 `` |
| `` Inside Borders `` | `` 內框線 `` |
| `` More Borders… `` | `` 其他框線… `` |
| `` More Functions… `` | `` 其他函數… `` |
| `` No Fill `` | `` 無填滿 `` |
| `` Theme Colors `` | `` 佈景主題色彩 `` |
| `` Standard Colors `` | `` 標準色彩 `` |
| `` Highlight Cells Rules `` | `` 醒目提示儲存格規則 `` |
| `` Greater Than… `` | `` 大於… `` |
| `` Less Than… `` | `` 小於… `` |
| `` Between… `` | `` 介於… `` |
| `` Equal To… `` | `` 等於… `` |
| `` Text that Contains… `` | `` 包含文字… `` |
| `` A Date Occurring… `` | `` 發生的日期… `` |
| `` Duplicate Values… `` | `` 重複的值… `` |
| `` Top/Bottom Rules `` | `` 前段／後段項目規則 `` |
| `` Blue `` | `` 藍色 `` |
| `` Green `` | `` 綠色 `` |
| `` Red `` | `` 紅色 `` |
| `` Orange `` | `` 橙色 `` |
| `` Light Blue `` | `` 淺藍色 `` |
| `` Purple `` | `` 紫色 `` |
| `` Green - Yellow - Red `` | `` 綠 - 黃 - 紅 `` |
| `` Red - Yellow - Green `` | `` 紅 - 黃 - 綠 `` |
| `` Green - White - Red `` | `` 綠 - 白 - 紅 `` |
| `` Blue - White - Red `` | `` 藍 - 白 - 紅 `` |
| `` White - Green `` | `` 白 - 綠 `` |
| `` White - Red `` | `` 白 - 紅 `` |
| `` 3 Arrows `` | `` 3 個箭號 `` |
| `` 3 Traffic Lights `` | `` 3 個交通號誌 `` |
| `` 3 Symbols `` | `` 3 個符號 `` |
| `` 4 Ratings `` | `` 4 個評等 `` |
| `` 5 Arrows `` | `` 5 個箭號 `` |
| `` 5 Quarters `` | `` 5 個四分位數 `` |
| `` New Rule… `` | `` 新增規則… `` |
| `` Clear Rules `` | `` 清除規則 `` |
| `` Manage Rules… `` | `` 管理規則… `` |
| `` Good, Bad and Neutral `` | `` 好、壞及適中 `` |
| `` Bad `` | `` 壞 `` |
| `` Good `` | `` 好 `` |
| `` Neutral `` | `` 適中 `` |
| `` Data and Model `` | `` 資料及模型 `` |
| `` Calculation `` | `` 計算 `` |
| `` Check Cell `` | `` 檢查儲存格 `` |
| `` Explanatory Text `` | `` 說明文字 `` |
| `` Input `` | `` 輸入 `` |
| `` Linked Cell `` | `` 連結的儲存格 `` |
| `` Note `` | `` 備註 `` |
| `` Output `` | `` 輸出 `` |
| `` Warning Text `` | `` 警告文字 `` |
| `` Titles and Headings `` | `` 標題及標頭 `` |
| `` Heading 1 `` | `` 標題 1 `` |
| `` Heading 2 `` | `` 標題 2 `` |
| `` Heading 3 `` | `` 標題 3 `` |
| `` Heading 4 `` | `` 標題 4 `` |
| `` Total `` | `` 總計 `` |
| `` Themed Cell Styles `` | `` 佈景主題儲存格樣式 `` |
| `` Number Format `` | `` 數字格式 `` |
| `` Comma [0] `` | `` 千分位 [0] `` |
| `` Currency [0] `` | `` 貨幣 [0] `` |
| `` Percent `` | `` 百分比 `` |
| `` Place in Cell `` | `` 置於儲存格內 `` |
| `` Place over Cells `` | `` 置於儲存格上方 `` |
| `` Rectangle `` | `` 矩形 `` |
| `` Rounded Rectangle `` | `` 圓角矩形 `` |
| `` Oval `` | `` 橢圓形 `` |
| `` Triangle `` | `` 三角形 `` |
| `` Arrow `` | `` 箭號 `` |
| `` Column `` | `` 直條圖 `` |
| `` Win/Loss `` | `` 盈虧 `` |
| `` Type to filter… `` | `` 輸入以篩選… `` |
| `` Sort Ascending `` | `` 遞增排序 `` |
| `` Sort Descending `` | `` 遞減排序 `` |
| `` Search `` | `` 搜尋 `` |
| `` Apply `` | `` 套用 `` |
| `` 20% - Accent1 `` | `` 20% - 輔色1 `` |
| `` 20% - Accent2 `` | `` 20% - 輔色2 `` |
| `` 20% - Accent3 `` | `` 20% - 輔色3 `` |
| `` 20% - Accent4 `` | `` 20% - 輔色4 `` |
| `` 20% - Accent5 `` | `` 20% - 輔色5 `` |
| `` 20% - Accent6 `` | `` 20% - 輔色6 `` |
| `` 40% - Accent1 `` | `` 40% - 輔色1 `` |
| `` 40% - Accent2 `` | `` 40% - 輔色2 `` |
| `` 40% - Accent3 `` | `` 40% - 輔色3 `` |
| `` 40% - Accent4 `` | `` 40% - 輔色4 `` |
| `` 40% - Accent5 `` | `` 40% - 輔色5 `` |
| `` 40% - Accent6 `` | `` 40% - 輔色6 `` |
| `` 60% - Accent1 `` | `` 60% - 輔色1 `` |
| `` 60% - Accent2 `` | `` 60% - 輔色2 `` |
| `` 60% - Accent3 `` | `` 60% - 輔色3 `` |
| `` 60% - Accent4 `` | `` 60% - 輔色4 `` |
| `` 60% - Accent5 `` | `` 60% - 輔色5 `` |
| `` 60% - Accent6 `` | `` 60% - 輔色6 `` |
| `` Accent1 `` | `` 輔色1 `` |
| `` Accent2 `` | `` 輔色2 `` |
| `` Accent3 `` | `` 輔色3 `` |
| `` Accent4 `` | `` 輔色4 `` |
| `` Accent5 `` | `` 輔色5 `` |
| `` Accent6 `` | `` 輔色6 `` |
| `` Recent Colors `` | `` 最近使用的色彩 `` |
| `` More Colors… `` | `` 其他色彩… `` |
| `` Hex `` | `` 十六進位 `` |
| `` Page Break Preview `` | `` 分頁預覽 `` |
| `` Bubble `` | `` 泡泡圖 `` |
| `` Box & Whisker `` | `` 盒鬚圖 `` |
| `` Treemap `` | `` 矩形式樹狀結構圖 `` |
| `` Sunburst `` | `` 旭日圖 `` |
| `` Stock `` | `` 股票圖 `` |
| `` Bar `` | `` 橫條圖 `` |
| `` Drag to fill cells. Drag from inside a cell to select a range. `` | `` 拖曳以填滿儲存格。從儲存格內拖曳可選取範圍。 `` |
| `` Highlight the active cell's row `` | `` 醒目提示作用中儲存格所在列 `` |
| `` Display options for this workbook `` | `` 此活頁簿的顯示選項 `` |
| `` Show horizontal scroll bar `` | `` 顯示水平捲軸 `` |
| `` Show vertical scroll bar `` | `` 顯示垂直捲軸 `` |
| `` Show sheet tabs `` | `` 顯示工作表索引標籤 `` |
| `` Edit Hyperlink… `` | `` 編輯超連結… `` |
| `` Edit Hyperlink `` | `` 編輯超連結 `` |
| `` Open Hyperlink `` | `` 開啟超連結 `` |
| `` Remove Hyperlink `` | `` 移除超連結 `` |
| `` Resize formula bar `` | `` 調整資料編輯列大小 `` |
| `` Options\|Editing `` | `` 編輯 `` |
| `` PivotTable Fields `` | `` 樞紐分析表欄位 `` |
| `` Choose fields to add to report: `` | `` 選擇要新增至報表的欄位： `` |
| `` Use a field's menu to move it between areas: `` | `` 使用欄位功能表在區域之間移動： `` |
| `` Filters `` | `` 篩選 `` |
| `` Values `` | `` 值 `` |
| `` Move to Row Labels `` | `` 移至列標籤 `` |
| `` Move to Column Labels `` | `` 移至欄標籤 `` |
| `` Move to Report Filter `` | `` 移至報表篩選 `` |
| `` Move to Values `` | `` 移至值 `` |
| `` Summarize by Sum `` | `` 以加總彙總 `` |
| `` Summarize by Count `` | `` 以計數彙總 `` |
| `` Summarize by Average `` | `` 以平均值彙總 `` |
| `` Summarize by Max `` | `` 以最大值彙總 `` |
| `` Summarize by Min `` | `` 以最小值彙總 `` |
| `` Show as No Calculation `` | `` 不執行計算 `` |
| `` Show as % of Grand Total `` | `` 以總計百分比顯示 `` |
| `` Show as Running Total `` | `` 以累加總計顯示 `` |
| `` Show as Rank `` | `` 以排名顯示 `` |
| `` Group by Years `` | `` 依年分組 `` |
| `` Group by Quarters `` | `` 依季分組 `` |
| `` Group by Months `` | `` 依月分組 `` |
| `` Remove Field `` | `` 移除欄位 `` |
| `` Refresh `` | `` 重新整理 `` |
| `` Calculated Field… `` | `` 導出欄位… `` |
| `` Report Layout `` | `` 報表版面配置 `` |
| `` Compact `` | `` 壓縮式 `` |
| `` Tabular `` | `` 表格式 `` |
| `` Header (&L left, &C center, &R right; &P page, &N pages, &D date, &A sheet): `` | `` 頁首（&L 靠左，&C 置中，&R 靠右；&P 頁碼，&N 總頁數，&D 日期，&A 工作表）： `` |
| `` Forecast start (a date or number in the history; blank: after the last point): `` | `` 預測起點（歷史資料中的日期或數字；留白：最後一點之後）： `` |
| `` Source: `` | `` 來源： `` |
| `` End date: `` | `` 結束日期： `` |
| `` Protect workbook for: Structure (sheets can't be added, moved, renamed, hidden or deleted). `` | `` 保護活頁簿：結構（無法新增、移動、重新命名、隱藏或刪除工作表）。 `` |
| `` Printer `` | `` 印表機 `` |
| `` Select a printer `` | `` 選取印表機 `` |
| `` Refresh printers `` | `` 重新整理印表機 `` |
| `` Copies `` | `` 份數 `` |
| `` Two-sided printing `` | `` 雙面列印 `` |
| `` Printer default `` | `` 印表機預設值 `` |
| `` One-sided `` | `` 單面 `` |
| `` Two-sided: long edge `` | `` 雙面：長邊翻轉 `` |
| `` Two-sided: short edge `` | `` 雙面：短邊翻轉 `` |
| `` Grayscale `` | `` 灰階 `` |
| `` Finding printers… `` | `` 正在尋找印表機… `` |
| `` No printers found. Configure a system printer or export a PDF. `` | `` 找不到印表機。請設定系統印表機或匯出 PDF。 `` |
| `` Printer discovery failed. `` | `` 無法探索印表機。 `` |
| `` Submitting print job… `` | `` 正在提交列印工作… `` |
| `` Print job submitted. `` | `` 已提交列印工作。 `` |
| `` Print job submitted: {receipt} `` | `` 已提交列印工作：{receipt} `` |
| `` Print failed: {error} `` | `` 列印失敗：{error} `` |
| `` Print failed: the printing worker stopped. `` | `` 列印失敗：列印背景工作已停止。 `` |
| `` The picture on the clipboard can't be read. `` | `` 無法讀取剪貼簿中的圖片。 `` |
| `` The picture on the clipboard is empty. `` | `` 剪貼簿中的圖片是空的。 `` |
| `` The picture on the clipboard is too large to paste. `` | `` 剪貼簿中的圖片太大，無法貼上。 `` |
| `` The picture on the clipboard can't be pasted: {e} `` | `` 無法貼上剪貼簿中的圖片：{e} `` |
| `` Macro `` | `` 巨集 `` |
| `` Close the macro step editor first: it keeps its window until it closes itself, so its steps and debug run are not lost. `` | `` 請先關閉巨集步驟編輯器，以保留其步驟與偵錯執行狀態。 `` |
| `` The sheet of the cell being edited was deleted, so the entry was discarded. `` | `` 正在編輯的儲存格所屬工作表已刪除，輸入內容已捨棄。 `` |
| `` Sheet protection now hides the code of the cell being edited, so the entry was discarded. `` | `` 工作表保護已隱藏正在編輯儲存格的程式碼，輸入內容已捨棄。 `` |
| `` The cell being edited can't be entered. `` | `` 無法輸入正在編輯的儲存格。 `` |
| `` Python mode doesn't start on a cell inside another cell's spill. `` | `` 無法在其他儲存格的溢出範圍內啟用 Python 模式。 `` |
| `` Python mode can't start on this cell: its code is hidden on a protected sheet. `` | `` 無法在此儲存格啟用 Python 模式：受保護的工作表已隱藏其程式碼。 `` |
| `` This workbook's VBA macros could not be loaded and were dropped, so they will not be in the saved file. Keep the original file. `` | `` 無法載入此活頁簿的 VBA 巨集，巨集已捨棄且不會儲存至檔案。請保留原始檔案。 `` |
| `` This workbook contains VBA macros. GridCraft keeps them when you save as .xlsm, but does not run them. `` | `` 此活頁簿包含 VBA 巨集。GridCraft 會在儲存為 .xlsm 時保留巨集，但不會執行。 `` |
| `` The web version is always the latest release. `` | `` 網頁版一律為最新版本。 `` |
| `` Insert Control `` | `` 插入控制項 `` |
| `` Run `` | `` 執行 `` |
| `` Overwrite `` | `` 覆寫 `` |
| `` Shift Down `` | `` 下移 `` |
| `` Shift Right `` | `` 右移 `` |
| `` The button is gone, so nothing ran. `` | `` 按鈕已移除，未執行任何動作。 `` |
| `` The button changed while the question was open, so nothing ran. Press it again to see what it runs now. `` | `` 提問期間按鈕已變更，未執行任何動作。請再次按下以查看目前的動作。 `` |
| `` Assign Action: {} `` | `` 指定動作：{} `` |
| `` Choose a command. `` | `` 請選擇命令。 `` |
| `` The parameters aren't valid JSON: {e} `` | `` 參數不是有效的 JSON：{e} `` |
| `` Type or choose a macro name. `` | `` 請輸入或選擇巨集名稱。 `` |
| `` Type the range the macro always runs on. `` | `` 請輸入巨集固定執行的範圍。 `` |
| `` Run a macro `` | `` 執行巨集 `` |
| `` Run a command `` | `` 執行命令 `` |
| `` Macro name: `` | `` 巨集名稱： `` |
| `` This workbook has no macros yet. `` | `` 此活頁簿尚無巨集。 `` |
| `` Run it on: `` | `` 執行範圍： `` |
| `` The selection when the button is pressed `` | `` 按下按鈕時的選取範圍 `` |
| `` Always this range: `` | `` 固定使用此範圍： `` |
| `` Output to (optional): `` | `` 輸出至（選填）： `` |
| `` Command: `` | `` 命令： `` |
| `` Parameters (JSON): `` | `` 參數（JSON）： `` |
| `` Assign Action `` | `` 指定動作 `` |
| `` Format Control: {} `` | `` 控制項格式：{} `` |
| `` The control is gone. `` | `` 控制項已移除。 `` |
| `` Minimum value `` | `` 最小值 `` |
| `` Maximum value `` | `` 最大值 `` |
| `` Incremental change `` | `` 遞增變更 `` |
| `` Page change `` | `` 頁面變更 `` |
| `` Current value must be a whole number from 0 to {CONTROL_MAX}. `` | `` 目前值必須是 0 到 {CONTROL_MAX} 的整數。 `` |
| `` Current value must be between {} and {}. `` | `` 目前值必須介於 {} 與 {} 之間。 `` |
| `` Text: `` | `` 文字： `` |
| `` Current value: `` | `` 目前值： `` |
| `` Minimum value: `` | `` 最小值： `` |
| `` Maximum value: `` | `` 最大值： `` |
| `` Incremental change: `` | `` 遞增變更： `` |
| `` Page change: `` | `` 頁面變更： `` |
| `` Cell link: `` | `` 儲存格連結： `` |
| `` Orientation: `` | `` 方向： `` |
| `` Locked (when the sheet is protected) `` | `` 鎖定（工作表受保護時） `` |
| `` Print object `` | `` 列印物件 `` |
| `` Format Control `` | `` 控制項格式 `` |
| `` Labels in first row and first column `` | `` 首列及首欄有標籤 `` |
| `` The input range holds column labels in its first row and sample labels in its first column. `` | `` 輸入範圍的首列包含欄標籤，首欄包含樣本標籤。 `` |
| `` Rows per sample: `` | `` 每個樣本的列數： `` |
| `` Number of Variables: `` | `` 變數個數： `` |
| `` Number of Random Numbers: `` | `` 隨機數個數： `` |
| `` Distribution: `` | `` 分配： `` |
| `` Uniform `` | `` 均等分配 `` |
| `` Bernoulli `` | `` 伯努利分配 `` |
| `` Binomial `` | `` 二項分配 `` |
| `` Poisson `` | `` 卜瓦松分配 `` |
| `` Patterned `` | `` 模式 `` |
| `` Discrete `` | `` 離散分配 `` |
| `` Mean: `` | `` 平均數： `` |
| `` Standard deviation: `` | `` 標準差： `` |
| `` Number of trials: `` | `` 試驗次數： `` |
| `` Lambda: `` | `` Lambda： `` |
| `` Each number is repeated, then the whole sequence; together they set how many values are written. `` | `` 先重複每個數字，再重複整個數列；兩者共同決定寫入的值數量。 `` |
| `` From: `` | `` 從： `` |
| `` In steps of: `` | `` 間距： `` |
| `` Repeating each number (times): `` | `` 每個數字重複次數： `` |
| `` Repeating each sequence (times): `` | `` 每個數列重複次數： `` |
| `` Value and Probability Input Range: `` | `` 值與機率輸入範圍： `` |
| `` Between: `` | `` 介於： `` |
| `` And: `` | `` 與： `` |
| `` Random Seed (blank for a new sequence): `` | `` 隨機種子（留白以產生新數列）： `` |
| `` Sampling Method: `` | `` 抽樣方法： `` |
| `` Periodic `` | `` 週期性 `` |
| `` Random `` | `` 隨機 `` |
| `` Number of Samples: `` | `` 樣本數： `` |
| `` Period: `` | `` 週期： `` |
| `` Inverse `` | `` 反轉 `` |
| `` Variable 1 Variance (known): `` | `` 變數 1 變異數（已知）： `` |
| `` Variable 2 Variance (known): `` | `` 變數 2 變異數（已知）： `` |
| `` Max Evaluations: `` | `` 最大評估次數： `` |
| `` Integer Optimality (%): `` | `` 整數最適性 (%)： `` |
| `` Convergence: `` | `` 收斂： `` |
| `` Mutation Rate: `` | `` 突變率： `` |
| `` Population Size: `` | `` 母體大小： `` |
| `` Random Seed: `` | `` 隨機種子： `` |
| `` Maximum Generations without Improvement: `` | `` 無改善的最大世代數： `` |
| `` All Methods `` | `` 所有方法 `` |
| `` Require Bounds on Variables `` | `` 要求變數有界限 `` |
| `` Solver Options `` | `` 規劃求解選項 `` |
| `` The model was saved to {}. `` | `` 模型已儲存至 {}。 `` |
| `` Constraint Cell Reference `` | `` 限制式儲存格參照 `` |
| `` Constraint Operator `` | `` 限制式運算子 `` |
| `` Constraint Value `` | `` 限制式值 `` |
| `` Reset All `` | `` 全部重設 `` |
| `` Load/Save `` | `` 載入／儲存 `` |
| `` Model Range: `` | `` 模型範圍： `` |
| `` Load `` | `` 載入 `` |
| `` The model was loaded. `` | `` 模型已載入。 `` |
| `` Don't Replace `` | `` 不要取代 `` |
| `` Needs an optimal or converged solution: Solver stopped before reaching one. `` | `` 需要最佳解或收斂解：規劃求解在達成前已停止。 `` |
| `` Needs Simplex LP or GRG Nonlinear, a Max or Min objective and no integer constraints. `` | `` 需要 Simplex LP 或 GRG 非線性、極大值或極小值目標，且不含整數限制式。 `` |
| `` Sensitivity `` | `` 敏感度 `` |
| `` Or select a category: `` | `` 或選取類別： `` |
| `` No functions match. `` | `` 沒有相符的函數。 `` |
| `` Paste name `` | `` 貼上名稱 `` |
| `` Paste List `` | `` 貼上清單 `` |
| `` The sheet this dialog was opened on was deleted. Cancel, then open the dialog again on the sheet it should use. `` | `` 開啟此對話方塊的工作表已刪除。請取消，並在要使用的工作表重新開啟。 `` |
| `` Synthetic input from the control channel can't open a link: press OK yourself to open it. `` | `` 控制通道的模擬輸入無法開啟連結：請親自按下「確定」。 `` |
| `` Arrange Windows `` | `` 重排視窗 `` |
| `` Arrange `` | `` 重排 `` |
| `` Tiled `` | `` 並排 `` |
| `` Cascade `` | `` 重疊顯示 `` |
| `` Windows of active workbook `` | `` 作用中活頁簿的視窗 `` |
| `` Row height (points): `` | `` 列高（點）： `` |
| `` Select locked cells `` | `` 選取鎖定的儲存格 `` |
| `` Select unlocked cells `` | `` 選取未鎖定的儲存格 `` |
| `` Insert columns `` | `` 插入欄 `` |
| `` Delete columns `` | `` 刪除欄 `` |
| `` Square root `` | `` 平方根 `` |
| `` Summation `` | `` 加總 `` |
| `` Integral `` | `` 積分 `` |
| `` Limit `` | `` 極限 `` |
| `` Brackets that grow `` | `` 可調整大小的括號 `` |
| `` Matrix `` | `` 矩陣 `` |
| `` Delta `` | `` Delta `` |
| `` Plus or minus `` | `` 正負 `` |
| `` Times `` | `` 乘以 `` |
| `` Divided by `` | `` 除以 `` |
| `` Less than or equal to `` | `` 小於或等於 `` |
| `` Greater than or equal to `` | `` 大於或等於 `` |
| `` Not equal to `` | `` 不等於 `` |
| `` Infinity `` | `` 無限大 `` |
| `` Tends to `` | `` 趨近於 `` |
| `` Edit Equation `` | `` 編輯方程式 `` |
| `` Insert Equation `` | `` 插入方程式 `` |
| `` LaTeX: `` | `` LaTeX： `` |
| `` Error at character {p}: {} `` | `` 字元 {p} 發生錯誤：{} `` |
| `` Type an equation in LaTeX, such as x^2 + y^2 = r^2 `` | `` 以 LaTeX 輸入方程式，例如 x^2 + y^2 = r^2 `` |
| `` Form Control `` | `` 表單控制項 `` |
| `` Insert Function… `` | `` 插入函數… `` |
| `` Count Numbers `` | `` 計算數字個數 `` |
| `` Show Details `` | `` 顯示詳細資料 `` |
| `` Copy Cells `` | `` 複製儲存格 `` |
| `` Fill Series `` | `` 填滿數列 `` |
| `` Fill Formatting Only `` | `` 僅填滿格式 `` |
| `` Fill Without Formatting `` | `` 填滿但不含格式 `` |
| `` Fill Days `` | `` 填滿日 `` |
| `` Fill Weekdays `` | `` 填滿工作日 `` |
| `` Fill Months `` | `` 填滿月 `` |
| `` Fill Years `` | `` 填滿年 `` |
| `` Auto Fill Options `` | `` 自動填滿選項 `` |
| `` Then `` | `` 則 `` |
| `` Else `` | `` 否則 `` |
| `` Set {c} to {i} `` | `` 將 {c} 設為 {i} `` |
| `` Select {r} `` | `` 選取 {r} `` |
| `` Repeat for each {} of {} `` | `` 針對每個{}重複，範圍：{} `` |
| `` If {cell} is empty `` | `` 若 {cell} 為空白 `` |
| `` If {cell} isn't empty `` | `` 若 {cell} 非空白 `` |
| `` If {cell} {op} {} `` | `` 若 {cell} {op} {} `` |
| `` Stop: {message} `` | `` 停止：{message} `` |
| `` There is no command “{id}”. `` | `` 找不到命令「{id}」。 `` |
| `` Choose the range to repeat over. `` | `` 請選擇要重複處理的範圍。 `` |
| `` Choose the cell to test. `` | `` 請選擇要測試的儲存格。 `` |
| `` The macro step editor has unsaved steps: save them or close the editor in its window. `` | `` 巨集步驟編輯器有未儲存的步驟：請儲存，或在其視窗關閉編輯器。 `` |
| `` Expand the editor `` | `` 展開編輯器 `` |
| `` Collapse the editor to this box `` | `` 將編輯器摺疊至此方塊 `` |
| `` Stop debugging `` | `` 停止偵錯 `` |
| `` Keep the changes the macro has made so far? They are one undo step either way. `` | `` 要保留巨集目前所做的變更嗎？無論保留與否，都視為一個復原步驟。 `` |
| `` Undo Changes `` | `` 復原變更 `` |
| `` Keep Changes `` | `` 保留變更 `` |
| `` Save changes to macro “{}”? `` | `` 儲存巨集「{}」的變更？ `` |
| `` Description: `` | `` 描述： `` |
| `` Add Step `` | `` 新增步驟 `` |
| `` Add a step after the selected one `` | `` 在選取的步驟後新增步驟 `` |
| `` Duplicate the selected step `` | `` 複製選取的步驟 `` |
| `` Delete the selected step `` | `` 刪除選取的步驟 `` |
| `` Check `` | `` 檢查 `` |
| `` Check the inputs and show on the grid what the macro would change `` | `` 檢查輸入，並在格線上顯示巨集將變更的內容 `` |
| `` Run the macro as one undo step `` | `` 以一個復原步驟執行巨集 `` |
| `` Step `` | `` 步驟 `` |
| `` Run the current step `` | `` 執行目前步驟 `` |
| `` Start debugging: stop before the first step `` | `` 開始偵錯：在第一個步驟前停止 `` |
| `` Continue `` | `` 繼續 `` |
| `` Run to the next breakpoint or the end `` | `` 執行至下一個中斷點或結束 `` |
| `` Run to Here `` | `` 執行至此處 `` |
| `` Run until the selected step `` | `` 執行至選取的步驟 `` |
| `` Paused before step {step} · {what} `` | `` 已在步驟 {step} 前暫停 · {what} `` |
| `` Runs with: `` | `` 執行時使用： `` |
| `` Changed so far: {} `` | `` 目前已變更：{} `` |
| `` Check shows on the grid what the macro reads and writes. Click a step's gutter to set a breakpoint. `` | `` 檢查會在格線上顯示巨集讀取與寫入的內容。按一下步驟左側可設定中斷點。 `` |
| `` Inputs `` | `` 輸入 `` |
| `` Writes `` | `` 寫入 `` |
| `` Writes over data `` | `` 覆寫資料 `` |
| `` Current step `` | `` 目前步驟 `` |
| `` No steps yet. Add Step picks a command, or record one with Automate › Record Macro. `` | `` 尚無步驟。請以「新增步驟」選擇命令，或使用「自動化」›「錄製巨集」。 `` |
| `` Breakpoint {} `` | `` 中斷點 {} `` |
| `` Breakpoint: the debugger stops before this step `` | `` 中斷點：偵錯工具會在此步驟前停止 `` |
| `` Step {}: {text} `` | `` 步驟 {}：{text} `` |
| `` Run this step (a disabled step is skipped) `` | `` 執行此步驟（已停用的步驟會略過） `` |
| `` Repeat for each row `` | `` 針對每列重複 `` |
| `` Control: run steps once per row of a range `` | `` 控制：針對範圍中的每列執行步驟 `` |
| `` If `` | `` 若 `` |
| `` Control: run steps when a cell meets a condition `` | `` 控制：儲存格符合條件時執行步驟 `` |
| `` Stop with message `` | `` 停止並顯示訊息 `` |
| `` Control: end the run with a message `` | `` 控制：以訊息結束執行 `` |
| `` Change the command `` | `` 變更命令 `` |
| `` Add a step `` | `` 新增步驟 `` |
| `` Search commands, e.g. bold, sort, set… `` | `` 搜尋命令，例如粗體、排序、設定… `` |
| `` No command matches. `` | `` 沒有相符的命令。 `` |
| `` Details `` | `` 詳細資料 `` |
| `` Rel `` | `` 相對 `` |
| `` Relative: a token that follows the input the macro runs on `` | `` 相對：隨巨集輸入範圍變動的符記 `` |
| `` Abs `` | `` 絕對 `` |
| `` Absolute: always these cells `` | `` 絕對：固定使用這些儲存格 `` |
| `` Tokens `` | `` 符記 `` |
| `` Row `` | `` 列 `` |
| `` Select a step to see its settings. `` | `` 請選取步驟以查看設定。 `` |
| `` Steps here run when the If is {}. Add Step puts a step in this branch. `` | `` 當條件為 {} 時執行此處步驟。「新增步驟」會新增至此分支。 `` |
| `` Repeat `` | `` 重複 `` |
| `` Step {path} · {title} `` | `` 步驟 {path} · {title} `` |
| `` Change… `` | `` 變更… `` |
| `` Enabled `` | `` 啟用 `` |
| `` Breakpoint `` | `` 中斷點 `` |
| `` For each `` | `` 針對每個 `` |
| `` At most `` | `` 最多 `` |
| `` Inside, Row (or Column) stands for the current one, e.g. Row.right. `` | `` 在其中，Row（或 Column）代表目前的列（或欄），例如 Row.right。 `` |
| `` If cell `` | `` 若儲存格 `` |
| `` Message: `` | `` 訊息： `` |
| `` Undo what the macro did before stopping `` | `` 停止前復原巨集所做的變更 `` |
| `` Remove this parameter `` | `` 移除此參數 `` |
| `` The ranges the macro works on. Each is checked before the macro runs. `` | `` 巨集使用的範圍。執行前會檢查每個範圍。 `` |
| `` No inputs: the macro works on fixed cells only. `` | `` 無輸入：巨集只使用固定儲存格。 `` |
| `` Shape: `` | `` 形狀： `` |
| `` Data rows: `` | `` 資料列： `` |
| `` Columns: `` | `` 欄： `` |
| `` First row holds column names `` | `` 首列包含欄名稱 `` |
| `` Every cell must hold something `` | `` 每個儲存格都必須有內容 `` |
| `` Each column must hold: `` | `` 每欄必須包含： `` |
| `` Column {} `` | `` 欄 {} `` |
| `` Example (what Check, Run and Debug use here): `` | `` 範例（供此處的檢查、執行及偵錯使用）： `` |
| `` Use current selection as example `` | `` 以目前選取範圍作為範例 `` |
| `` Always run on this range `` | `` 固定在此範圍執行 `` |
| `` Otherwise the macro runs on the selection `` | `` 否則巨集將在選取範圍執行 `` |
| `` Output anchor (what the Output token stands for): `` | `` 輸出錨點（Output 符記所代表的位置）： `` |
| `` Leave it empty when no step uses Output. A token such as Input.right keeps it beside the data. `` | `` 沒有步驟使用 Output 時請留白。Input.right 等符記會將其置於資料旁。 `` |
| `` When results would land on cells that hold data: `` | `` 結果將寫入已有資料的儲存格時： `` |
| `` Ask (overwrite, shift down or shift right) `` | `` 詢問（覆寫、下移或右移） `` |
| `` Don't run `` | `` 不要執行 `` |
| `` Overwrite the data `` | `` 覆寫資料 `` |
| `` Shift the data down `` | `` 將資料下移 `` |
| `` Shift the data right `` | `` 將資料右移 `` |
| `` Agents and other programs that run the macro get an error instead of the question. `` | `` 代理程式與其他程式執行此巨集時，會收到錯誤而非詢問。 `` |
| `` May use files through: {} `` | `` 可透過以下方式使用檔案：{} `` |
| `` Saved macro “{name}” ({steps} step{}) `` | `` 已儲存巨集「{name}」（{steps} 個步驟{}） `` |
| `` Recording stopped `` | `` 已停止錄製 `` |
| `` Run Macro `` | `` 執行巨集 `` |
| `` Macro “{name}” stopped: {msg} `` | `` 巨集「{name}」已停止：{msg} `` |
| `` Ran macro “{name}” ({ran} step{}) `` | `` 已執行巨集「{name}」（{ran} 個步驟{}） `` |
| `` The question was about “{book}”, which is no longer the active workbook, so nothing was done. `` | `` 此問題針對的「{book}」已不是作用中的活頁簿，未執行任何動作。 `` |
| `` Debugging “{name}” `` | `` 正在偵錯「{name}」 `` |
| `` Open the macro in the step editor `` | `` 在步驟編輯器開啟巨集 `` |
| `` Stop recording and save the macro `` | `` 停止錄製並儲存巨集 `` |
| `` Scripts in this workbook came from a file and are disabled. `` | `` 此活頁簿的指令碼來自檔案，已停用。 `` |
| `` Trust Scripts `` | `` 信任指令碼 `` |
| `` Let this workbook's scripts run for the rest of this session `` | `` 允許此活頁簿的指令碼在本工作階段剩餘期間執行 `` |
| `` Step Into `` | `` 逐步執行 `` |
| `` Open the macro in the step editor and stop before its first step `` | `` 在步驟編輯器開啟巨集，並在第一個步驟前停止 `` |
| `` Create `` | `` 建立 `` |
| `` Write a new macro with this name `` | `` 使用此名稱撰寫新巨集 `` |
| `` Delete Macro `` | `` 刪除巨集 `` |
| `` Delete Script `` | `` 刪除指令碼 `` |
| `` Do you want to delete {what} “{}”? `` | `` 要刪除{what}「{}」嗎？ `` |
| `` Options… `` | `` 選項… `` |
| `` This workbook also has a VBA project. GridCraft keeps it when you save but does not run it. `` | `` 此活頁簿也包含 VBA 專案。GridCraft 會在儲存時保留，但不會執行。 `` |
| `` Run Script `` | `` 執行指令碼 `` |
| `` Macro name: {name} `` | `` 巨集名稱：{name} `` |
| `` Shortcut key: `` | `` 快速鍵： `` |
| `` Use a letter from A to Z. `` | `` 請使用 A 到 Z 的字母。 `` |
| `` Macro Options `` | `` 巨集選項 `` |
| `` Use a letter from A to Z for the shortcut. `` | `` 請使用 A 到 Z 的字母作為快速鍵。 `` |
| `` Data Table `` | `` 資料表 `` |
| `` Show Data Table `` | `` 顯示資料表 `` |
| `` Available for column, bar, line, area and compatible combo charts. `` | `` 適用於直條圖、橫條圖、折線圖、區域圖及相容的組合圖。 `` |
| `` Show Legend Keys `` | `` 顯示圖例符號 `` |
| `` Horizontal Borders `` | `` 水平框線 `` |
| `` Vertical Borders `` | `` 垂直框線 `` |
| `` Record your actions as a macro `` | `` 將您的操作錄製為巨集 `` |
| `` Record steps relative to the cells selected when recording starts, so the macro works on other data `` | `` 以錄製開始時選取的儲存格為相對位置錄製步驟，讓巨集可用於其他資料 `` |
| `` Write a macro step by step `` | `` 逐步撰寫巨集 `` |
| `` Run a macro on the selection `` | `` 在選取範圍執行巨集 `` |
| `` No macros in this workbook `` | `` 此活頁簿沒有巨集 `` |
| `` Check for\nUpdates… `` | `` 檢查\n更新… `` |
| `` Look for a newer GridCraft release `` | `` 尋找較新的 GridCraft 版本 `` |
| `` Resize\nTable `` | `` 調整\n表格大小 `` |
| `` Resize Table `` | `` 調整表格大小 `` |
| `` More Table Styles `` | `` 其他表格樣式 `` |
| `` Data Table: With Legend Keys `` | `` 資料表：含圖例符號 `` |
| `` Data Table: No Legend Keys `` | `` 資料表：不含圖例符號 `` |
| `` Data Table: None `` | `` 資料表：無 `` |
| `` Advanced `` | `` 進階 `` |
| `` Advanced Filter `` | `` 進階篩選 `` |
| `` Settings `` | `` 設定 `` |
| `` Outline Settings `` | `` 大綱設定 `` |
| `` Paste Names… `` | `` 貼上名稱… `` |
| `` CHF German (Switzerland) `` | `` CHF 德文（瑞士） `` |
| `` Rp Indonesian `` | `` Rp 印尼文 `` |
| `` Format Painter `` | `` 複製格式 `` |
| `` Insert an equation, or pick one from the gallery `` | `` 插入方程式，或從圖庫挑選 `` |
| `` Insert {ch} `` | `` 插入 {ch} `` |
| `` Japanese Postcard `` | `` 日本明信片 `` |
| `` Japanese Double Postcard `` | `` 日本雙面明信片 `` |
| `` Japanese Envelope #3 `` | `` 日本信封 #3 `` |
| `` Japanese Envelope #4 `` | `` 日本信封 #4 `` |
| `` Japanese Envelope Kaku #2 `` | `` 日本角形信封 #2 `` |
| `` Japanese Envelope Kaku #3 `` | `` 日本角形信封 #3 `` |
| `` New\nWindow `` | `` 新增\n視窗 `` |
| `` New Window `` | `` 新增視窗 `` |
| `` Arrange\nAll `` | `` 全部\n重排 `` |
| `` Arrange All `` | `` 全部重排 `` |
| `` Switch\nWindows `` | `` 切換\n視窗 `` |
| `` Switch Windows `` | `` 切換視窗 `` |
| `` Scroll ribbon left `` | `` 向左捲動功能區 `` |
| `` Scroll ribbon right `` | `` 向右捲動功能區 `` |
| `` Split tabs `` | `` 分割索引標籤 `` |
| `` Circular References: {} `` | `` 循環參照：{} `` |
| `` Click to copy `` | `` 按一下以複製 `` |
| `` Numerical Count: {} `` | `` 數值計數：{} `` |
| `` Minimum: {} `` | `` 最小值：{} `` |
| `` Maximum: {} `` | `` 最大值：{} `` |
| `` Numerical Count `` | `` 數值計數 `` |
| `` Minimum `` | `` 最小值 `` |
| `` Maximum `` | `` 最大值 `` |
| `` Preview `` | `` 預覽 `` |
| `` Quadratic formula `` | `` 二次方程式公式 `` |
| `` Pythagoras `` | `` 畢氏定理 `` |
| `` Binomial theorem `` | `` 二項式定理 `` |
| `` Area of a circle `` | `` 圓面積 `` |
| `` Euler's identity `` | `` 歐拉恆等式 `` |
| `` 2×2 matrix `` | `` 2×2 矩陣 `` |
| `` row `` | `` 列 `` |
| `` column `` | `` 欄 `` |
| `` contains `` | `` 包含 `` |
| `` Code Editor `` | `` 程式碼編輯器 `` |
| `` The parameters must be a JSON object, such as {"range": "A1:B2"}. `` | `` 參數必須是 JSON 物件，例如 {"range": "A1:B2"}。 `` |
| `` Range: `` | `` 範圍： `` |
| `` Summary rows below detail `` | `` 摘要列在詳細資料下方 `` |
| `` Summary columns to right of detail `` | `` 摘要欄在詳細資料右側 `` |
| `` New range for the table: `` | `` 表格的新範圍： `` |
| `` Paste Name `` | `` 貼上名稱 `` |
| `` Macro: {} `` | `` 巨集：{} `` |
| `` The macro “{}” is in “{book}”. Switch back to it to save, check or run the macro. `` | `` 巨集「{}」位於「{book}」。請切換回該活頁簿以儲存、檢查或執行巨集。 `` |
| `` Save Macro `` | `` 儲存巨集 `` |
| `` the workbook `` | `` 活頁簿 `` |
| `` its window `` | `` 其視窗 `` |
| `` The macro step editor is asking whether to save its draft before {} closes. Answer that first, then close {}. `` | `` 巨集步驟編輯器正在詢問是否要在{}關閉前儲存草稿。請先回答，再關閉{}。 `` |
| `` Step  `` | `` 步驟  `` |
| `` Check Macro `` | `` 檢查巨集 `` |
| `` Needs approval before it can run: it {}. `` | `` 執行前需要核准：其動作為{}。 `` |
| `` Check passed: writes {cells} cell{} `` | `` 檢查通過：寫入 {cells} 個儲存格{} `` |
| `` Ran {} step{}. `` | `` 已執行 {} 個步驟{}。 `` |
| `` Debug Macro `` | `` 偵錯巨集 `` |
| `` Finished: {executed} step{} ran, one undo step. `` | `` 已完成：執行 {executed} 個步驟{}，視為一個復原步驟。 `` |
| `` The macro failed; nothing was changed. `` | `` 巨集執行失敗，未變更任何內容。 `` |
| `` Stopped after {executed} step{}; the changes were kept. `` | `` 已在 {executed} 個步驟{}後停止；變更已保留。 `` |
| `` Stopped: {msg} `` | `` 已停止：{msg} `` |
| `` Stopped; the changes were undone. `` | `` 已停止；變更已復原。 `` |
| `` Macro: {}{dirty_mark} `` | `` 巨集：{}{dirty_mark} `` |
| `` This macro is in “{home_title}”. Switch back to it to edit, check or run the macro. `` | `` 此巨集位於「{home_title}」。請切換回該活頁簿以編輯、檢查或執行巨集。 `` |
| `` The window that was closing has closed already; nothing else was closed. `` | `` 正在關閉的視窗已關閉，未關閉其他視窗。 `` |
| `` A macro is being debugged: stop it first (macro.debug {"action": "stop"}). `` | `` 巨集正在偵錯：請先停止（macro.debug {"action": "stop"}）。 `` |
| `` is greater than `` | `` 大於 `` |
| `` is at least `` | `` 大於或等於 `` |
| `` is less than `` | `` 小於 `` |
| `` is at most `` | `` 小於或等於 `` |
| `` is empty `` | `` 為空白 `` |
| `` single cell `` | `` 單一儲存格 `` |
| `` at least  `` | `` 至少  `` |
| `` at most  `` | `` 最多  `` |
| `` , {conflicts} of them hold data (red) `` | `` ，其中 {conflicts} 個已有資料（紅色） `` |
| `` , over no data `` | `` ，不會覆寫資料 `` |
| `` . Later steps can't be previewed. `` | `` 。無法預覽後續步驟。 `` |
| `` ⌘/Ctrl+Enter to {verb} `` | `` ⌘/Ctrl+Enter 以{verb} `` |
| `` apply `` | `` 套用 `` |
| `` insert `` | `` 插入 `` |
| `` {what}. Overwrite them, or move the data out of the way? `` | `` {what}。要覆寫，還是將資料移開？ `` |
| `` {label} must be a whole number from 0 to {CONTROL_MAX}. `` | `` {label}必須是 0 到 {CONTROL_MAX} 的整數。 `` |
| `` {id} can't run in a macro: {why}. `` | `` {id} 無法在巨集中執行：{why}。 `` |
| `` {id} {what}: the macro must list it in its permissions. `` | `` {id} {what}：巨集必須在權限清單中列出此動作。 `` |
| ``  · pass {at} of {of} `` | ``  · 第 {at} 次，共 {of} 次 `` |
| ``  · at a breakpoint `` | ``  · 位於中斷點 `` |
| `` {label} branch {} `` | `` {label}分支 {} `` |
| `` = {} on the example `` | `` = 範例中的 {} `` |
| `` doesn't equal `` | `` 不等於 `` |
| `` isn't empty `` | `` 非空白 `` |
| ``  without {k}: another macro took it while recording `` | `` ，未使用 {k}：錄製期間已有其他巨集使用此快速鍵 `` |
| `` p Value: `` | `` P-value： `` |
| `` {asked} already holds data. Replace it with the model? `` | `` {asked} 已有資料，要以模型取代嗎？ `` |

## Cleanup

Retained exactly one patched working copy: `/Volumes/Vibe-Temp/Craft/tmp/grid-accept`. Deleted all four porting/backup directories and the negative-test copy. Removed the temporary `targets/port-gridcraft` build outputs and `logs/port-grid` raw logs after copying the output tails above. Shared Cargo/download and font inputs were retained. The pristine OLD/NEW_BASE trees were not modified. The final copied adapter payloads match craft-suite; localization patch reverse-check passes. The final source-only change after tests was the formatter ceiling comment; executable logic is unchanged.
