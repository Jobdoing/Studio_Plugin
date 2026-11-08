# PdfCraft adapter port: v0.9.0 to v0.19.0

Review copy: `/Volumes/Vibe-Temp/Craft/tmp/pdf-accept`.
Only `craft-suite/` was edited; no commit, push, pin update or publication.

## Hunk disposition

Paths below are relative to `crates/ui-egui/src/` unless stated otherwise.
Every replacement still requires exactly one match; section/index boundaries remain explicit.

| Adapter hunk | Disposition and reason |
| --- | --- |
| Studio pending save/write/read fields and bookmark owner | Kept in `lib.rs`; initialization moved from `lib.rs` to `app.rs`. |
| Save polling and forced `zh-hant` default | Re-anchored from `lib.rs` to `app.rs`, at the same `dialog_epoch()` and `language: i18n::AUTO.to_string()` statements. Uses the official catalog. |
| Default-language and organizer tests | New test adaptation: retain all assertions in `i18n/tests.rs`, expecting `zh-hant` for a fresh app/legacy settings while still checking explicit AUTO and persistence. The organizer's English accessibility-label fixture explicitly selects English; all geometry assertions remain. |
| Document picker and attachment output | Re-anchored from `lib.rs` to `app/files.rs`; same Studio picker/error inbox and acknowledged output. |
| Dropped-file ingress suppression | Re-anchored from `lib.rs` to `app.rs`; clear raw drops before upstream reads them. |
| Main Save and Save As | Re-anchored from `editing.rs` to `editing/save.rs`, at the embedding-save branch. Studio still owns receipts, revision validation and continuation. |
| Browser download helper removal | Re-anchored to `editing/save.rs`, ending at that function's `Ok(())`; remove its new re-export in `editing.rs` too. |
| Dirty notification | Re-anchored from `editing.rs` to `editing/close.rs`, after the unchanged `unsaved_flag.store(...)`. |
| Inactive-tab draft activation | Re-anchored to the expanded `let typing` expression in `editing.rs`. Upstream already includes content/changed paragraph drafts; add only comment/bookmark ownership. |
| Paragraph/content draft submission | Dropped the two Studio helpers and their call hunks. Upstream `commit_open_text_edits(id)` now commits both and restores rejected drafts. Real PDF roundtrip tests and mutations exercise these native operations. |
| Unsaved content/comment/bookmark/style guards | Kept in `editing.rs`; narrow `has_unsaved_text()` replacement to `has_unsaved_work`, since Undo now has independent uses. |
| Bookmark creation/rename ownership and lookup | Kept in `editing.rs`. |
| Real draft test access | `staging_dir` moved to `editing/tests.rs`; paragraph test helper moved to `tools/edit_text_ui.rs`. Populate new `TextDraft.selection` and `typing_from` fields. |
| Draft close-protection mutation | Strengthened the existing test to cover both new text and edits to already-saved editable text. Upstream's new-text guard otherwise masked removal of Studio's additional guard. No original assertion or scenario was removed. |
| Generic file picker, batch output, export/CSV/XFDF, data import/merge | Re-anchored from `files.rs` to `workflows/files.rs`; behavior retained. |
| Create/image import and separate PDF creation | Re-anchored to `workflows/create_ui.rs` and `workflows/create_multiple_ui.rs`; same Studio read/write helpers. |
| Measurement CSV and print outputs | Re-anchored to `tools/measure_ui.rs` and `workflows/print_ui.rs`; same acknowledged output. |
| Export worker | Re-anchored to `workflows/export_ui.rs`; old positional `run(src, ...)` became `run(ExportTask { ... }, sink)`. Collect outputs and notify only after delivery. |
| Action worker/picker | Re-anchored to `workflows/actions_ui.rs`; same async Studio saves and per-file acknowledgement accounting. |
| OCR batch worker | Re-anchored from the old inline result closure to `workflows/ocr_ui.rs::run_batch_files`. Derive an async copy of the upstream loop; retain skip/cancel/failure/note buckets, guard each recognizer call and await receipts before counting success. The sink remains testable with controlled futures. |
| Editable OCR review output | New: `workflows/ocr_verify.rs` added a download bypass. Route through Studio; keep Saving while pending, finish on receipt, restore ReviewReady on cancellation/error. `write_or_else` adds the failure continuation without changing existing write callers. |
| Image mutations and custom stamp picker | Re-anchored to `tools/content_ui.rs` and `tools/stamps_ui.rs`; reuse existing generation-guarded image mutations. |
| Signature photo/image picker | Re-anchored to `tools/fill_sign.rs`; upstream `add_filter` became `add_filter_any_case`. Preserve the size bound and cancel/error handling. |
| Plain branding | Kept in `widgets.rs`. |
| Font-family exclusion exception and corresponding test rewrite | Dropped: upstream removed `BARRED_FAMILIES` and now already permits OFL fonts. No upstream exclusion assertion is removed by this adapter. |
| Traditional Chinese web font allowlist | Kept in `crates/fonts/build.rs`; re-anchor on the BIZ family/style predicate now followed by a multiline language list. |
| URL file ingress | Kept in `apps/pdfcraft-web/src/main.rs`; remove the explicit `?file=` branch. |
| Upstream parent/page host bridge | Re-anchored: old parent-setup section became two `Bridge::connect` callers. Replace the exact `Bridge::connect` implementation with `None`, disabling both callers and both host modes. Studio retains all file permissions and receipts. |
| Shared comment creation/composer submission | Re-anchored to `tools/comments/paint.rs` and `composer.rs`, with an explicit re-export in `tools/comments.rs`. Preserve upstream typewriter whitespace handling; use the draft's page without requiring visible page geometry. |
| Comment panel submission | Re-anchored to `panels/comments_panel.rs`; inline Save moved into `inline_editor`, so replace that exact condition/body. Existing add/reply semantics retained. |
| Clipboard availability message | Keep command disablement in `commands.rs`; old menu-button tooltip anchor vanished with upstream's menu rewrite. Re-anchor the same existing text to the central `disabled_reason` function. |
| File-access Save As intent | Re-anchor both `editing.rs` hunks to `editing/save.rs`; preserve `SaveTarget::As` forwarding. |
| File-access open identity/inbox | Keep field in `lib.rs`; initialization/drain moved to `app.rs`, picker to `app/files.rs`. Same Studio source tokens. |
| Password cancel, conversion/error discard, successful source bind | Re-anchor from `lib.rs` to `app/files.rs`, keeping all original checks and cleanup. Other editors' branches are unchanged. |

## Pins and test inputs

Neither PDF adapter nor its checks had an old version/hash pin to update. `upstream.json` is untouched.
The pristine workspace manifest says `0.19.0`. The official catalog revision is
`575cfdef63227b14daf173b8cc87928bfdfa325e`, read from `craft-i18n.rev` and matched against
`git -C /Volumes/Vibe-Temp/Craft/tmp/breakmap2/i18n-pdf rev-parse HEAD`.
No translation catalog or new product message was added.

The draft checker keeps `CRAFT_FONTS_REQUIRED=1` and now honors a caller's `CRAFT_FONTS_DIR`.
The existing Studio font input was copied into disposable test storage and supplemented with the
new required native Hans manifest/font from upstream release's craft-fonts revision
`b076417b5880bd4154bd22f00695b1d28c6bea83`.
The downloaded font's SHA-256 was computed with `shasum -a 256` and matches its manifest:
`f799a538a3355877e597a0ae04050e897932c9ae7689eb9227c2953c5dd549ea`.
This supplies the required input rather than bypassing upstream font validation.

## Verification

All commands ran locally. Cargo used:

```text
CARGO_HOME=/Volumes/Vibe-Temp/Studio5/cache/cargo
CARGO_TARGET_DIR=/Volumes/Vibe-Temp/Craft/targets/port-pdf
CRAFT_I18N_DIR=/Volumes/Vibe-Temp/Craft/tmp/breakmap2/i18n-pdf
RUSTC=/Users/scott/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc
TMPDIR=/Volumes/Vibe-Temp/Craft/tmp/rust-pdf
```

The default Homebrew compiler lacked WASM libraries. The existing rustup compiler has the
target installed; no toolchain or target was installed.

**A: exit 0 for each adapter, in order, on a fresh v0.19.0 copy.**

```text
PdfCraft document storage, acknowledged saves, Chinese default and plain branding applied
Prepared pdfcraft file identity and save intent
```

**B: exit 101; environmental GPU failure remains.**
Command: `cargo test --locked -p pdfcraft-ui-egui --lib`.

```text
---- canvas::tests::a_moved_picture_is_drawn_from_the_fresh_raster_while_a_tile_is_still_stale stdout ----
Failed to create render state: CustomNativeAdapterSelectionError("No adapter found")
test result: FAILED. 814 passed; 1 failed; 1 ignored; 0 measured; 0 filtered out; finished in 6.77s
error: test failed, to rerun pass `-p pdfcraft-ui-egui --lib`
```

The only failing test is the GPU test above; it was not disabled or changed.
The upstream-ignored test is
`theme::tests::windows_hinting_improves_low_dpi_mono_raster_without_changing_layout_or_coverage`,
an existing rasterization measurement probe. No new ignore or test exclusion was added.
B is therefore **not a passing full-suite result**.

**C: exit 0.** Command:
`cargo check --locked -p pdfcraft-web --target wasm32-unknown-unknown`.

```text
warning: `pdfcraft-web` (bin "pdfcraft-web") generated 1 warning
    Finished `dev` profile [optimized + debuginfo] target(s) in 27.34s
```

**D: all PDF checks exit 0, including mutations.**
`check-pdf-prepare.py` used an archive created from NEW_BASE, reran both adapters in order,
and verified the complete changed/generated file list against the final review copy.

```text
PdfCraft preparation reproduced all 33 modified/generated source files
PdfCraft save adapter: 15 checks passed; 8 unsafe mutations rejected
PdfCraft real UI draft/save checks: 9 passed
Mutation rejected: draft close protection; original source restored
Mutation rejected: draft serialization; original source restored
Mutation rejected: paragraph text/style serialization; original source restored
Mutation rejected: comment serialization; original source restored
Mutation rejected: bookmark title serialization; original source restored
PdfCraft real OCR receipt check: 1 passed
Mutation rejected: OCR receipt bypass; original source restored
```

The latter checks ran with `CRAFT_FONTS_DIR` pointing to the disposable, supplemented font input
described above. They require zero ignored baseline tests. All mutated production sources were
restored before the final B/C runs and the 33-file reproduction check.
The shared file-access adapter's non-PDF branches were compared with HEAD and are unchanged.
`git diff --check` and syntax parsing of the five involved Python entry points also passed.

## Remaining evidence and cleanup

No known storage/receipt/permission behavior gap remains in the exercised paths. Real Studio
browser document-center/local-file interactions were not run; neither build success nor the
controlled receipt tests establish that runtime acceptance. GPU rendering and the upstream-ignored
measurement probe remain unverified.

The review directory contains the fresh upstream source plus both adapters, with mutations restored.
Disposable trial trees, test archive/font inputs, raw logs and this task's Cargo target/temp outputs
are removed after recording these tails. Shared Cargo downloads and the pristine inputs are retained.
