# WordCraft v0.16.0 adapter port

Scope: the two adapters in pipeline order, their save checks, and regression tests.
No commit, publication, upstream pin update, or edit to either pristine checkout.
The shared file-access helper and every non-WordCraft branch are unchanged.

## Hunk inventory

Paths below are relative to the disposable upstream checkout.
Every retained/re-anchored replacement still requires its unique anchor or
`text.index` boundary; the async-save and test insertions retain their assertions.

### prepare-wordcraft.py

| Hunk | Status | Anchor / reason |
| --- | --- | --- |
| Studio open | Kept | `let dialog = if purpose == "picture"` through the callback end; Studio still supplies bytes. |
| Studio download | Kept | `fn download(saves: &AsyncSaves,` through the print iframe comment; completion still records a ticket, filename, and outcome. |
| Studio module/import | Kept | `use std::cell::{Cell, RefCell};`; copy the existing `studio.rs` unchanged. |
| Dirty callback | Kept | `on_dirty: Some(...)`; notify both the browser guard and Studio. |
| Extra dirty report after logic | Dropped | Upstream now calls `report_dirty()` in both logic and UI. The old extra active-document report would overwrite the all-document result. |
| Forced interface locale | Re-anchored | `app.autosave = false` -> `crate::prefs::restore(...)`; set `app.ui.language = "zh-hant"` after stored preferences can no longer override startup language. Upstream already disables autosave. |
| Browser drops | Re-anchored | `let dropped ...` ending before `let msgs` -> `WebShell::ui`'s first-pass block ending at `self.app.ui(ui)`; clear drops instead of bypassing Studio. |
| Pasted-picture service | Kept | `app.services.pasted = Some(pasted)` -> `None`. |
| Pasted-picture initialization | Kept | `let pasted: Inbox` through browser-locale comment; remove direct clipboard listener initialization. |
| Pasted-picture listener | Kept | `Largest picture pasted` through the dirty-flag comment; remove the unused listener. |
| System-font service | Kept | `load_system_fonts: Some(...)` -> `None`. |
| System-font capture variables | Kept | Remove the exact `font_ctx` / `font_messages` pair. |
| Unused font/picker helpers | Re-anchored | `Most local fonts ...` -> `Most files one multi-select pick ...`, ending at animation preferences; also remove the newly orphaned native picker limits. Studio owns these picks. |
| Native MIME helper | Kept | `fn mime_for(` remains the final, now unused helper. |
| Native extension constants | Re-anchored | Single-line filtering -> `const DOC_EXTS:` through `mod font_store;`; upstream made DOC_EXTS multiline. The span now has checked boundaries. |
| Message queue initialization | Kept | Remove the exact `let messages = Rc::new(RefCell...)`. |
| Service construction | Re-anchored | Keep `inbox.clone()` for the new host setup's ownership requirements; remove only the unused messages argument. |
| WebShell construction | Re-anchored | `WebShell { app, inbox, messages }` -> `{ app, inbox, messages, prefs }`; preserve `prefs`. |
| WebShell inbox/message fields | Kept | Remove the exact field pair; preserve the new preferences field. |
| Message draining | Kept | `let msgs = std::mem::take(...)` through `self.app.logic(ctx)`. |
| Service signature | Kept | Remove the exact `messages: Rc<RefCell<Vec<String>>>` argument. |
| Async receipt filenames | Kept | `async_saves.rs`: retain pending-ticket validation, filename storage, and one-time consumption. |
| Receipt settlement | Re-anchored | `lib.rs` -> `app/files.rs`; retain the exact loop and saved-outcome checks, document identity, and export exclusion. |
| Save regression injection | Re-anchored | `lib.rs`'s indented `const UNSAVED` -> `tests.rs`'s unindented constant. |
| WASM CJK embedding | Re-anchored | Old BIZ-only filter -> `if wasm && !small_ui_face`; retain upstream Arabic/Georgian faces and include regular BIZ UDPGothic / Noto Sans CJK TC. |
| Upstream host bridge | New | `Bridge::detect(&canvas)` -> typed `None`. The upstream host posts bytes without the Studio receipt, permission, and source-token contract; it must not override Studio services. |

### prepare-file-access.py: WordCraft branch only

| Hunk | Status | Anchor / reason |
| --- | --- | --- |
| Studio service fields | Re-anchored | `lib.rs` -> `services.rs`, same `pub inbox: Option<Inbox>` anchor. |
| Capture opened source | Re-anchored | `lib.rs` -> `app/commands.rs`; `let document` + `let old_path` -> `let document` + `let body_epoch`. |
| Bind successful open | Re-anchored | `When the document has been replaced` -> `Another document is shown`; same success, command, and document-ID guards. |
| Studio save dispatch | Re-anchored | Old direct-download block -> new `let delivered = match (&host_save, &download)`; Studio receives document ID, Save As intent, and copy intent first. Preserve the upstream fallback when Studio is absent. |
| Drain Studio sources | Re-anchored | `lib.rs` -> `app/files.rs`, `fn drain_inbox` -> `pub(crate) fn drain_inbox`; still calls guarded `run`. |
| Save revision field | Kept | `SaveInFlight` remains in `lib.rs`; retain `marked_saved` anchor. |
| Defer clean state | Re-anchored | `app/commands.rs` contains additional host-path handling inside `if marked_saved`; guard the block with `studio_save.is_none()` instead of matching its obsolete closing brace. |
| Record serialized revision | Re-anchored | Same struct-construction anchor, now in `app/commands.rs`. |
| Apply acknowledged clean state | Re-anchored | Same filename assignment anchor, now in `app/files.rs`; require the recorded revision to equal the current revision. |
| Await prompt's receipt | Re-anchored | Same `if !self.safely_saved(saved)` anchor, now in `app/files.rs`. |
| Prompt cancellation | Re-anchored | Same `if !go` anchor, now in `app/files.rs`; discard a pending Studio source. |
| Retain retry source | Re-anchored | Same `let retry = ...` anchor, now in `app/commands.rs`. |
| Failed-open discard | Re-anchored | `r` before `Save before New/Open/Close` -> `r` before the `execute_held_back` documentation, inside `execute_user`. Password-required opens still return pending before discard. |
| Dialog cancellation | Re-anchored | `dialogs.rs`'s old `else` / `!open` -> `dialogs/chrome.rs`'s `window_close::show` and `if close`; retain password-close and Save Changes window-dismissal cleanup. |
| Password accessible name | New, approved | Exact two-line password label/TextEdit anchor in `dialogs/dispatch.rs`; keep the label response and call `.labelled_by(label.id)`. The shared patch helper requires exactly one match; accessibility validation stays enabled. |
| Save As destination intent | Kept | Exact filename-picker handoff in `file_dialogs.rs`. |
| Three Studio save tests | Re-anchored | Insert into `tests.rs`; Close now asserts document closure, cancellation preserves it, and neither implies Quit. |
| Source retention | Re-anchored | Extra dirty-report anchor -> `self.app.logic(ctx)`; pass every open document ID to `studio::forget`, since background documents now remain open. |
| Studio service captures | Kept | Exact `let save_ctx` anchor and existing callback captures. |
| Studio service hooks | Kept | Exact `open_async` anchor; bind/discard/save callbacks retain their contracts. |
| Document-open callback | Kept | Exact purpose/spawn anchor; documents retain source tokens while assets use the ordinary inbox. |
| Studio bridge copy | Kept | Existing shared `studio.rs` is copied unchanged. |
| All-document dirty state | New | Exact `f(self.session.dirty || panes::has_comment_drafts(self))` in `app/frame.rs`; Studio uses native `has_unsaved_documents()`, which includes background edits, comment drafts, and unconfirmed saves. |

## Native behavior and regression checks

v0.16.0 New/Open retain existing documents instead of replacing unsaved work.
The adapters preserve that protection, keep every open source binding, and protect
background unsaved documents when leaving Studio. Close still waits for the same
document/revision's confirmed save. Closing the last document returns to Home;
Quit is separate. No new translation strings were introduced.

The existing save checker now reads `app/files.rs` and `tests.rs`, verifies the
injected tests instead of overwriting later tests, and uses the requested target
directory. It retains the identity mutant and adds a revision mutant. Added native
checks cover revisions, retained documents, background dirty reports, failed-open
source cleanup, and password-cancel cleanup. Static checks also guard startup
language order and retention of all open source IDs.

## Pins and environment

Neither WordCraft adapter nor its save checker contained a version/hash pin.
None was removed or changed; `upstream.json` is untouched. The new checkout's
workspace version is `0.16.0`. Its `craft-i18n.rev` and the supplied i18n checkout's
`git rev-parse HEAD` both equal `1e515422afdda2f317af430c1f9d68a5f83935b4`.
The official catalogs are supplied through `CRAFT_I18N_DIR`.

Cargo uses `CARGO_HOME=/Volumes/Vibe-Temp/Studio5/cache/cargo`,
`CARGO_TARGET_DIR=/Volumes/Vibe-Temp/Craft/targets/port-wordcraft`, and
`TMPDIR=/Volumes/Vibe-Temp/Craft/tmp`. The font directory is the existing
`/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts`. `RUSTC=$(rustup which rustc)`
selects the already installed Rust 1.96.0 toolchain with its WASM target; PATH's
Homebrew rustc lacks that target. No toolchain was installed.

## Validation

The approved follow-up uses a fresh `cp -R` copy at
`/Volumes/Vibe-Temp/Craft/tmp/word-accept`, patched in pipeline order. The password
label association is included. B/D are restricted to `studio_` tests as requested;
the user will run the full suite outside the sandbox.
Follow-up A, Studio-only B, and D all succeeded. Full-suite acceptance remains
assigned to that external run.

### A: adapters, exit 0 each

```text
WordCraft Studio source adapter applied
Prepared wordcraft file identity and save intent
```

### Previous full-suite result (before the approved label fix)

`cargo test --locked -p wordcraft-ui-egui --lib`, exit 101:

```text
failures:
    objects::tests::a_dragged_shape_leaves_the_text_behind_it
    objects::tests::rotation_drag_turns_picture_pixels_live_and_commits_once_or_cancels
    tests::studio_password_cancel_discards_its_pending_source

test result: FAILED. 1145 passed; 3 failed; 3 ignored; 0 measured; 0 filtered out; finished in 103.87s

error: test failed, to rerun pass `-p wordcraft-ui-egui --lib`
```

The first two unchanged upstream tests, also rerun individually, fail in
`egui_kittest/src/wgpu.rs` before obtaining a render state:

```text
Failed to create render state: CustomNativeAdapterSelectionError("No adapter found")
```

The new password-cancel check stops at the harness's accessibility validation:

```text
1 widget(s) lack accessible name.
PasswordInput at Some(Rect { x0: 301.90625, y0: 264.0, x1: 521.90625, y1: 284.0 }) inside "Password"
```

The approved adapter hunk now retains the `Password:` label response and calls
`.labelled_by(label.id)`, following the existing pattern in that same source file.
No accessibility check was disabled. The full-suite result above is historical;
the follow-up Studio test result is recorded below.

The three default-ignored upstream tests remain unchanged: the mini-toolbar
visible-selection conflict, an offscreen spelling-review preview needing a
graphics adapter, and the large-table performance benchmark. No extra tests
were skipped or marked ignored.

### C: previous WASM check, exit 0

`cargo check --locked -p wordcraft-web --target wasm32-unknown-unknown` succeeded
before the approved label fix. It was not rerun in the follow-up, whose requested
scope is A and Studio-only B/D.

```text
warning: `wordcraft-web` (bin "wordcraft-web") generated 3 warnings
    Finished `dev` profile [optimized + debuginfo] target(s) in 2m 18s
```

Warnings include the now-unused upstream host detection and picker fallback,
plus existing UI imports/variable warnings. They were not suppressed.

### B/D: approved follow-up

`cargo test --locked -p wordcraft-ui-egui --lib studio_`, exit 0:

```text
test tests::studio_password_cancel_discards_its_pending_source ... ok
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 1137 filtered out; finished in 0.03s
```

The password-cancel test retains the harness's accessibility validation and reaches
its source-release assertions.

`check-word-save-mutation.py`, exit 0:

```text
save-review: test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 1137 filtered out; finished in 0.01s
save-identity-mutant: test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1150 filtered out; finished in 0.03s
save-revision-mutant: test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1150 filtered out; finished in 0.02s
save-restored: test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 1137 filtered out; finished in 0.04s
```

Both deliberate mutations were killed by their expected assertions. SHA-256
comparison confirmed `app/files.rs`, `tests.rs`, and `dialogs/dispatch.rs` are
identical before and after the checker. The retained copy contains no mutation.

### Additional checks

`node --test craft-suite/tests/files.test.mjs craft-suite/tests/documents.test.mjs`, exit 0:

```text
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

`git diff --check` succeeded. Direct comparison against HEAD confirmed the shared
file-access helper and every other editor branch are byte-for-byte unchanged.
The approved follow-up retains exactly one patched copy, `word-accept`, for the
user's external full-suite run. Other task-created copies are removed. Raw logs
are removed after their result tails are recorded here. Shared Cargo/font/catalog
caches and the pre-existing Cargo target used by another baseline process are
preserved. No authenticated
Studio browser session or packaged release was tested.
