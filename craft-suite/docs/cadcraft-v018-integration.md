# CADCraft v0.18.0 Studio integration

## Status and scope

This is an unsigned, unpublished integration candidate. The specified pristine
upstream commit is `32238e83c2c8bf643994132883e94bc96961f649`.
The internal editor key is `cadcraft`; the Studio plugin is `cad-viewer`, titled
`CADCraft`, version `0.5.8`, kind `app`, with `studio-docs` write access and no
backend. Neither the live `scripts/upgrade.py` nor `upstream.json` was edited.

**Blocking discovery:** this upstream version does not provide DWG in WASM.
`crates/dwg/build.rs` sets `no_dwg_bridge` for `wasm32`, and
`crates/dwg/Cargo.toml` excludes `acadrust` on that target. The corresponding
functions in `crates/dwg/src/lib.rs` return errors saying that DWG cannot be
opened or written in the web build. A successful WASM compilation therefore
does not establish DWG functionality. No backend was added, and those guards
were not bypassed. Extending the DWG engine to WASM requires a separate scope
decision; the user's question about authorizing that work is pending.

## Implementation and review decisions

- Reuse ladder: stop at existing upstream engine/UI flows and the suite's shared
  Studio bridge. No new package download mechanism or file-host abstraction.
- `prepare-cadcraft.py` validates the exact commit, workspace version and pinned
  TC font/license hashes. Every replacement requires one matching anchor.
- Capture saves at the engine's real `save_as` entrance, before `commit_save` or
  native saved-version mutations. This covers menu, keyboard, command-line and
  engine callers. Queue the serialized bytes, document UID, revision and drawing
  snapshot. Duplicate saves of the same document are refused while pending.
- Save As carries destination intent; ordinary Save reuses its source. Exports
  use copies and do not clean or rename the source. Engine results report pending
  delivery instead of claiming a browser download.
- The shared `studio.rs` verifies `status == saved` and a nonempty acknowledged
  filename. Settlement checks UID, revision and snapshot identity before setting
  the saved baseline. Later edits stay dirty. Cancellation, denied permission or
  an unconfirmed receipt cannot clean the drawing or continue Close.
- Keep the native Close queue and modal; suspend its continuation while the
  receipt is pending. A confirmed matching save resumes the same queued close.
  Native New/Open already retain other drawings, so no replacement/discard guard
  was duplicated. Dirty reporting includes background drawings and pending saves.
- Replace the browser uploader with Studio admission. Successful drawing opens
  bind the source token to the new UID; failed/oversized opens discard it. SHX
  admission registers the font and discards the document token. Picker
  cancellation creates no pending source. Browser drops are cleared.
- Remove the compiled upstream `host` module and its host detection, listeners,
  delivery and readiness callbacks. Studio is the sole active file host.
- The Studio writer requests upstream R2000 for DWG; DXF stays DXF. Upstream's
  content-loss confirmation is retained and uses the R2000 loss model in Studio.
  This does not supply the missing WASM DWG implementation described above.
- Add `zh-hant` through upstream's preference enum and catalog registry, including
  locale resolution. Set it after restoring profile/preferences at web startup.
- Reuse the existing pinned Noto Sans CJK TC and OFL inputs from
  `CRAFT_FONTS_DIR`. Make this exact family the sole exception to upstream's
  font-family exclusion, preserving exclusions for the other families. Include
  it in the WASM font list. Extend the existing glyph test's font-loading list
  to include `zh-hant`; retain its glyph assertions.
- Add only a direct `js-sys` dependency already present at the lockfile's pinned
  version, for the unchanged shared bridge. Other dependency versions stay fixed.
- `assemble.py` maps `cadcraft` to `cad-viewer`. Until the registry entry is added,
  its explicitly checked bootstrap pin only accepts v0.18.0 / 0.5.8. Its ceiling
  is recorded next to that fallback; later releases must use registry pins.
- Assembly retains upstream LICENSE-MIT, LICENSE-APACHE, NOTICE, ATTRIBUTION.md,
  asset notices and the TC font license. Dependency license collection is a
  separate required packaging step.

## Files

Modified:

- `README.md`
- `scripts/assemble.py`
- `scripts/prepare-file-access.py`
- `scripts/prepare-localization.py`
- `src/runtime.mjs` (DWG/DXF/SHX picker filter)

Added:

- `scripts/prepare-cadcraft.py`
- `scripts/convert-cad-catalog.py`
- `scripts/check-cad-localization.py`
- `scripts/check-cad-save.py`
- `scripts/check-cad-upgrade-patch.py`
- `patches/cadcraft-zh-hant.patch`
- `src/cad-save.rs`, `src/cad-save-poll.rs`, `src/cad-web.rs`
- `src/cad-save-tests.rs`, `src/cad-web-tests.rs`
- `src/cad-zh-hant.tsv`
- `docs/cad-upgrade-py.patch`
- `docs/cadcraft-v018-integration.md`

## Catalog conversion and terminology

The catalog has 1,468 upstream context/key pairs. Conversion uses
`/opt/homebrew/bin/opencc -c s2twp.json`; only translation columns are retained
from conversion, so English/context keys remain byte-for-byte upstream keys.
Headers identify upstream `zh.tsv`, conversion and the unchanged
`MIT OR Apache-2.0` license.

Reviewed corrections after OpenCC: `函式` → `函數`, `專案` → `項目`,
`畫素` → `像素`, `引數` → `參數`, `多段線` → `聚合線`,
`標注` → `標註`. CAD block labels use `圖塊`, with `圖塊參考`, `圖塊定義`,
`圖塊編輯器` and `圖塊屬性`. `圖層` and `標註` remain the CAD terms.
The converter records these decisions for regeneration. The checker rejects
missing/duplicate keys, empty translations, changed placeholders and plural
form counts, printing every missing key on upstream updates.

## Proposed upgrade.py migration

`docs/cad-upgrade-py.patch` is a unified diff against a disposable copy of the
actual `/Volumes/AI-Model/Craft/scripts/upgrade.py`. It has not been applied there.
The proposal passes patch dry-run, Python syntax parsing, and real success/
injected-failure adoption checks. The original script's SHA-256 was
`3f189767d6dbe1acd99b1b7ddaa54748d40c113d7448fd6672e99b0a82b47919`;
the live script still matched that disposable original after testing.

- Route `cad-viewer` through `editor_candidate`, mapping only the internal key to
  `cadcraft`; use `cadcraft-ui-egui`, `apps/cadcraft-web` and `cadcraft-web` for
  tests/build/license collection. Include CAD in the localization pass.
- Remove `cad_candidate`, the old `CAD_REPO`/drawings wrapper, its translation
  fetch, IBM Plex font path, backend wrapper packaging and old v0.6.2 pin.
  The replacement adapter pins the new v0.18.0 commit instead.
- Discovery reads CAD from the same suite registry as the other editors.
  Replace the obsolete canonical-wrapper comparison with exact current-pin
  comparisons against that registry. Keep suite revision, dirty worktree,
  repository, complete-SHA, moved-tag, reviewed-diff and artifact checks.
- Candidate preparation updates only its temporary suite registry. Adoption
  stages `plugin/cad-viewer` and records the `cadcraft` pin, preserving the
  existing source-worktree guards. It no longer clones or adopts a drawings repo.
- Regenerate old plans after migration; their old wrapper provenance is obsolete.
- Allow first adoption to create the new `plugin/cad-viewer` directory; a later
  failure removes the new directory and restores every original target/pin.
  `check-cad-upgrade-patch.py` exercises success and injected-failure rollback
  against the disposable proposed script, never the live workspace.

The release owner must add this entry to `upstream.json` before using the migrated
pipeline (the working registry was deliberately left unchanged):

```json
"cadcraft": {
  "tag": "v0.18.0",
  "commit": "32238e83c2c8bf643994132883e94bc96961f649",
  "plugin_version": "0.5.8"
}
```

## Acceptance evidence

Environment: `CARGO_HOME=/Volumes/Vibe-Temp/Studio5/cache/cargo`,
`CARGO_TARGET_DIR=/Volumes/Vibe-Temp/Craft/targets/port-cadcraft`,
`TMPDIR=/Volumes/Vibe-Temp/Craft/tmp`, the existing `CRAFT_FONTS_DIR`, and
`RUSTC=$(rustup which rustc)`. No new fonts or WASM tools were downloaded.

### A. Fresh source preparation — exit 0

All three adapters ran in pipeline order on a fresh `cp -R` of NEW_BASE. A complete
content comparison (excluding `.git`) found no difference between that fresh
prepared tree and the retained `cad-accept` tree used for validation/build.

```text
CADCraft v0.18.0 Studio source adapter applied
Prepared cadcraft file identity and save intent
CAD Traditional Chinese catalog: 1468 upstream keys covered
Applied Traditional Chinese interface to cadcraft 0.18.0
```

### B. Locked UI library tests — exit 0, one upstream ignored report

Command: `cargo test --locked -p cadcraft-ui-egui --lib`.

```text
test i18n::tests::dialogs_render_in_every_language_and_keep_their_source_ids ... ok

test result: ok. 230 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 7.74s
```

All eight injected Studio receipt/catalog tests executed. The unexecuted test is
`i18n::tests::translation_gaps`, marked ignored upstream because it prints a
translation-gap report normally run by `cargo xtask i18n`. It was not silently
counted as passing. No GPU `No adapter found` failures occurred.

Additional real serialization check:
`cargo test --locked -p cadcraft-web studio_format_tests`.
It runs the actual menu/engine save entrance and upstream writer/reader, verifies
DWG magic `AC1015`, the reported R2000 version, reopened entity geometry, DXF
content, Save As/Save intent and dirty state before acknowledgement.

```text
test studio_format_tests::real_save_entrance_serializes_r2000_dwg_and_dxf_without_cleaning_before_receipt ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 7 filtered out; finished in 0.01s
```

This native test is not evidence of WASM DWG support.

Save mutation check output (each mutant failed the intended assertion with exit
101, and original files were restored):

```text
baseline: test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 223 filtered out; finished in 0.03s
identity: test result: FAILED. 7 passed; 1 failed; 0 ignored; 0 measured; 223 filtered out; finished in 0.02s
revision: test result: FAILED. 7 passed; 1 failed; 0 ignored; 0 measured; 223 filtered out; finished in 0.00s
close: test result: FAILED. 7 passed; 1 failed; 0 ignored; 0 measured; 223 filtered out; finished in 0.00s
restored: test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 223 filtered out; finished in 0.00s
```

The catalog's missing-key guard was also mutated by deleting one translation;
it exited 1 and reported:

```text
Missing CAD translation: '' '  Cancel  '
AssertionError: 1 missing CAD translations
```

### C. Locked WASM check — exit 0

Command: `cargo check --locked -p cadcraft-web --target wasm32-unknown-unknown`.

```text
warning: `cadcraft-ui-egui` (lib) generated 3 warnings
    Checking cadcraft-web v0.18.0 (/Volumes/Vibe-Temp/Craft/tmp/cad-accept/apps/cadcraft-web)
    Finished `dev` profile [optimized + debuginfo] target(s) in 2.86s
```

The warnings concern upstream native-only opening/canvas rebuild code unused in
the WASM build; no warning suppression was added for them.

### D. Release build and assembly — exit 0

From `apps/cadcraft-web`, with the documented tool directories on PATH:
`trunk build --release --locked --offline --dist /Volumes/Vibe-Temp/Craft/tmp/cad-dist`.
Installed Trunk was 0.22.0, wasm-bindgen was 0.2.129 (matching Cargo.lock), and
wasm-opt was 131. No replacement tool download was needed.

```text
   Compiling cadcraft-web v0.18.0 (/Volumes/Vibe-Temp/Craft/tmp/cad-accept/apps/cadcraft-web)
    Finished `release` profile [optimized] target(s) in 1m 08s
2026-11-07T17:25:17.882915Z  INFO applying new distribution
2026-11-07T17:25:17.883385Z  INFO ✅ success
Assembled /Volumes/Vibe-Temp/Craft/tmp/cad-plugin; not signed or published
Retained license texts for 255 web dependency packages
```

Manifest values were asserted after assembly:

```json
{
  "id": "cad-viewer",
  "title": "CADCraft",
  "kind": "app",
  "scope": "project",
  "desktop_only": true,
  "version": "0.5.8",
  "uses": { "studio-docs": { "access": "write" } }
}
```

The `backend` key is absent. Licenses were collected using locked WASM-platform
Cargo metadata. This Mac's Python lacked its default CA bundle; retrying with
`SSL_CERT_FILE=/etc/ssl/cert.pem` succeeded with certificate verification enabled.
Original upstream and font license texts were retained.

### E. Shared Node tests — exit 0

Command: `node --test craft-suite/tests/*.test.mjs`.

```text
✔ document-center Save preserves original folder, name and serial while local survives project changes (0.183333ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 144.818291
```

Python syntax parsing and `git diff --check` also completed successfully.
The retained outputs are `/Volumes/Vibe-Temp/Craft/tmp/cad-accept` and
`/Volumes/Vibe-Temp/Craft/tmp/cad-plugin`. Disposable comparison trees, raw build
outputs, test logs and this task's Cargo target directory were removed after
capturing the evidence above; shared dependency/font/tool caches were preserved.

## Unverified / release gates

- DWG open/save in WASM is demonstrably unavailable in this upstream snapshot.
- Real authenticated Studio document-center/local-file open/save, project and
  permission changes, receipt timing and browser close/reopen were not exercised.
- No installation, signing, marketplace publication or pipeline adoption occurred.
- The external `scripts/release.mjs` still maps CAD to `cad-source`; its publication
  source mapping and marketplace source metadata require review before release.
  They were outside the permitted edit scope and were not changed.
