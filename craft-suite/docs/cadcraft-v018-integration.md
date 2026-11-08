# CADCraft v0.18.0 Studio integration

The original acceptance record below is retained as history. The DWG follow-up
at the end supersedes its DWG-blocked status: unmodified acadrust now executes
real DWG read/edit/write in WASM, with the documented process-isolation ceiling.

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

## DWG WASM follow-up — Phase 1 feasibility (after c01559b)

The owner authorized a feasibility spike followed by integration only if
acadrust 0.6.6 builds without modification. **That gate passed.** This section
supersedes the earlier pending-authorization statement; browser read/write
acceptance is still required before calling the original DWG blocker resolved.

Two disposable experiments used `RUSTC=$(rustup which rustc)`, the existing
external Cargo cache and target directory, and `--locked --offline`:

```text
scratch crate: cargo build -p acadrust --lib --target wasm32-unknown-unknown
   Compiling acadrust v0.6.6
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 24.96s

copy of cad-accept, only wasm32 exclusion removed from build.rs and Cargo.toml:
cargo build -p cadcraft-dwg --target wasm32-unknown-unknown
   Compiling acadrust v0.6.6
    Finished `dev` profile [optimized + debuginfo] target(s) in 44.23s
```

Both commands exited 0. The registry dependency and its default features were
unchanged. The CADCraft copy kept its FreeBSD/aarch64 exclusion. These library
builds establish compilation, not execution or UI acceptance.

Source references below use the pristine CADCraft commit and the registry
`acadrust-0.6.6` source. No acadrust changes are proposed.

| Finding / blocker | File:line | Solvable without modifying acadrust? |
| --- | --- | --- |
| Explicit WASM disable flag | CADCraft `crates/dwg/build.rs:9` | Yes: remove only the wasm32 condition through an anchored adapter hunk. Keep the FreeBSD/aarch64 exclusion. |
| Dependency excluded on WASM | CADCraft `crates/dwg/Cargo.toml:17` | Yes: include the already locked 0.6.6 dependency for WASM. Do not change its version or checksum. |
| Native process worker | CADCraft `crates/dwg/src/worker.rs:19`, `:59`, `:67`, `:152-172` | Not available as an OS process in browsers. The existing unconfigured-worker path at `:154-155` returns `None`; `decode` at `:77-80` and encode at `:103-106` use the existing in-process byte fallback. A Web Worker wrapper would restore a separate execution context. |
| Threads, pipes, timeout and kill | CADCraft `crates/dwg/src/worker.rs:179-201` | Native APIs cannot provide browser isolation. They are not reached with the worker unconfigured. Browser equivalent: transferable buffers, a parent timer, `Worker.terminate()` and worker recreation. |
| Panic / damaged-file isolation | CADCraft `crates/dwg/src/lib.rs:99-102`, `:115-121`, `:389`, `:975`; `worker.rs:3-11` | Keep all guards, but the target reports `panic="abort"`: `catch_unwind` cannot recover a WASM trap, allocation abort or stack overflow. A dedicated Web Worker is needed to keep those failures away from the editor instance. |
| mmap | acadrust `Cargo.toml:682`, `src/io/dwg/dwg_reader.rs:935-944` | Already excluded for wasm32 by acadrust. CADCraft uses `Cursor<&[u8]>`, not `from_mmap`. The upstream CADCraft module comment still says native-only/mmap; that does not describe the portable stream path now present in this dependency. |
| Rayon | acadrust `Cargo.toml:42-44`, `:685`; `src/io/dwg/parallel.rs:2-7`, `:18-25` | Already target-gated; WASM uses serial implementations even with default features. No dependency edit or feature workaround needed. |
| Filesystem | acadrust `src/io/dwg/dwg_reader.rs:30`, `src/io/dwg/dwg_writer.rs:22`; CADCraft `lib.rs:100`, `:975` | File-based APIs are unsuitable in browsers, but the bridge reads and writes byte streams. Sheet-set external-file lookups are already disabled on WASM (`sheet_set.rs:1475-1477`, `:1495-1496`, `:1543-1545`). |
| libc / physical-memory probes | acadrust `src/io/dwg/mesh_budget.rs:103-136`, `:197-246` | OS-specific `/proc` and `sysctlbyname` code is target-gated. WASM returns no host-memory counters and uses its existing baseline mesh cap. No active libc dependency is required on this path. |

The source establishes the exclusions and the old native/mmap rationale, but
does not establish the author's complete historical motivation. The actual
build results show mmap/Rayon are not current compilation blockers.

Native isolation protects other open drawings when a decoder aborts and kills
overlong conversions after 30 minutes (`worker.rs:34`). The synchronous browser
fallback has neither that termination guarantee nor a responsive UI during a
long conversion. A Web Worker with its own WASM instance would isolate traps and
allow termination; it would still share browser/process memory pressure and
would not be an OS-enforced memory quota. Phase 2 will explicitly mark this
ceiling rather than claim equivalent isolation.

All existing limits remain required: 512 MiB DWG input / 1 GiB DXF input/output
at `crates/dwg/src/lib.rs:55`, pre-decode input rejection at `:94`, capped DXF
output at `:115`, and encoder input checks at `:955-968`. The UI's smaller
256 MiB open cap also remains in force. No version, limit, damaged-file report,
panic guard or receipt check may be removed to enable WASM.

## DWG WASM follow-up — Phase 2 results

**Implemented and verified:** DWG read/edit/write works in `wasm32-unknown-unknown`
with **unmodified acadrust 0.6.6**. The registry archive SHA-256 is
`8923c99ea1f151cb7fc17ce2fc14f8b1e330fa22611e535602d985c0cc3c89a2`;
all 470 archived files were compared byte-for-byte with the extracted dependency
before the runtime check. No acadrust patch, version upgrade, backend or new font
download was introduced. The normal WASM dependency tree has no mmap, Rayon or
libc dependency; its platform-dependent clock uses `web-time`.

### Changes and preserved checks

- `scripts/prepare-cadcraft.py`: assert acadrust's existing version and checksum;
  add exactly anchored WASM enablement in `crates/dwg/build.rs` and
  `crates/dwg/Cargo.toml`. Keep the FreeBSD/aarch64 exclusion. Add an English
  `NOTE(ceiling)` next to the conversion module identifying the in-process
  fallback and the Web Worker upgrade path.
- The generated `crates/dwg/src/lib.rs` differs from pristine upstream by that
  comment only. The decoder/encoder, input/output limits, record-loss reporting,
  panic guards and native worker implementation are unchanged.
- `scripts/check-cad-dwg-wasm.py`: verify unmodified dependency files, create a
  disposable workspace check member, generate a native DWG, build and execute
  real WASM, and reopen its result natively. It checks that registering the test
  member changes no existing locked package, then restores the original lockfile
  and removes the temporary member in `finally`.
- `tests/cad-dwg-wasm/{Cargo.toml,src/lib.rs,src/main.rs,check.cjs,index.html}`:
  runnable native/WASM check and browser page. The rectangle is derived from
  upstream `crates/io/tests/dwg_required_dictionaries.rs::rectangle`; the DWG is
  generated at check time with native `dxf_to_dwg_as`, as upstream's tests do.
  No binary fixture was added to the repository.
- `README.md`: document the runnable check and isolation ceiling.
- `docs/cadcraft-v018-integration.md`: this appended feasibility/results report.

All existing adapter anchors, version/font pins, shared Studio bridge, source
tokens, permission handling and same-revision save receipts remain intact.
`upstream.json` and the external upgrade/release scripts were not edited.

### Actual WASM execution and negative checks

Run:
`python3 craft-suite/scripts/check-cad-dwg-wasm.py <prepared-checkout> <fresh-output-under-/Volumes/Vibe-Temp/Craft>`.

The check reads a **7,236-byte native-generated DWG** through the real
`cadcraft_io::read` WASM path. It verifies the complete polyline geometry and
closed flag, changes its second vertex from `(4, 0)` to `(7, 9)`, writes a
**7,314-byte R2000 DWG**, and verifies the edited geometry after both WASM and
independent native reopen. It asserts `AC1015` output, no skipped-record notes,
rejection of an input over a deliberately small DWG limit, rejection when DXF
output exceeds a deliberately small cap, and rejection of malformed DWG input.

```text
Unmodified acadrust 0.6.6 verified: 470 archive files
{"status":"passed","runtime":"Node WASM","inputBytes":7236,"outputBytes":7314}
Native reopen of WASM-written DWG: passed
```

The same compiled WASM check ran successfully in an isolated **Chrome 156**
context with no console messages. This is browser codec execution, not an
authenticated Studio document-center acceptance test.

```json
{"status":"passed","runtime":"Chrome/156.0.0.0","inputBytes":7236,"outputBytes":7314}
```

A stale-output mutation replaced the saved result with the original native DWG,
simulating a writer that echoes the input. The native geometry assertion failed
with exit 101 (`(4, 0)` versus the required `(7, 9)`). The genuine WASM output was
then restored and native verification exited 0. No production check was weakened.

### Repeated acceptance A–E

The original environment and pinned tools were reused. Every command below exited
0; the one upstream ignored report is listed explicitly. No GPU `No adapter found`
failure occurred.

**A — Fresh pristine v0.18.0 copy, adapters in pipeline order:**

```text
CADCraft v0.18.0 Studio source adapter applied
Prepared cadcraft file identity and save intent
CAD Traditional Chinese catalog: 1468 upstream keys covered
Applied Traditional Chinese interface to cadcraft 0.18.0
```

**B — `cargo test --locked --offline -p cadcraft-ui-egui --lib`:**

```text
test i18n::tests::dialogs_render_in_every_language_and_keep_their_source_ids ... ok
test result: ok. 230 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 10.22s
```

The ignored test remains upstream `i18n::tests::translation_gaps`, a reporting-only
test. All eight Studio receipt/catalog tests executed. Additional upstream bridge
tests, including native forced-panic guards, were run with
`cargo test --locked --offline -p cadcraft-dwg --lib`:

```text
test tests::reading_a_dwg_survives_a_panic_in_post_processing ... ok
test tests::scale_actions_keep_the_byte_autocad_reads_after_their_connections ... ok
test result: ok. 27 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

**C — `cargo check --locked --offline -p cadcraft-web --target wasm32-unknown-unknown`:**

```text
warning: `cadcraft-ui-egui` (lib) generated 3 warnings
    Checking cadcraft-web v0.18.0 (/Volumes/Vibe-Temp/Craft/tmp/cad-accept/apps/cadcraft-web)
    Finished `dev` profile [optimized + debuginfo] target(s) in 1m 01s
```

**D — Trunk release build, assembly and dependency licenses:**

```text
    Finished `release` profile [optimized] target(s) in 1m 53s
2026-11-07T18:43:55.004519Z  INFO applying new distribution
2026-11-07T18:43:55.005032Z  INFO ✅ success
Assembled /Volumes/Vibe-Temp/Craft/tmp/cad-plugin-dwg; not signed or published
Retained license texts for 262 web dependency packages
```

Build used `trunk build --release --locked --offline`, installed wasm-bindgen
0.2.129 and wasm-opt 131. Assembly's manifest was asserted to have `id=cad-viewer`,
`title=CADCraft`, `version=0.5.8`, `kind=app`, `studio-docs` write access and no
`backend` key. The completed folder replaces the old `cad-plugin` at the requested
final path. acadrust's MPL-2.0 license, third-party/provenance notices and source
archive URL are retained under `licenses/rust/acadrust-0.6.6`; its primary license
text was compared with the unmodified registry source. Original upstream NOTICE,
ATTRIBUTION, MIT/Apache and pinned TC font notices remain included.

**E — `node --test craft-suite/tests/*.test.mjs`:**

```text
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 125.222042
```

### WASM size comparison

Compared with the previous DXF-only `cad-plugin`, using the same release tools,
font input and deterministic assembly compression:

| Artifact | Before | With DWG | Increase |
| --- | ---: | ---: | ---: |
| WASM | 46,933,606 bytes (44.76 MiB) | 54,346,967 bytes (51.83 MiB) | 7,413,361 bytes / 15.80% |
| Packaged `.wasm.gz` | 24,787,554 bytes (23.64 MiB) | 26,984,456 bytes (25.73 MiB) | 2,196,902 bytes / 8.86% |

### Remaining limits and final state

- Conversions use upstream's synchronous in-process fallback. **No Web Worker
  isolation was added.** A large or hostile file can freeze the editor or trap its
  WASM instance, risking unsaved in-memory drawings; the native process timeout
  and crash containment are not available. Existing byte/mesh limits do not cap
  every internal allocation. The Web Worker upgrade path is described in Phase 1
  and marked in the generated source.
- Runtime evidence covers a real upstream-derived R2000 rectangle and an actual
  edit/save, plus rejection checks. It does not certify every DWG version/type or
  a hostile-file corpus. Authenticated Studio open/save/permission/close acceptance
  remains unverified; publication, installation and signing were not performed.
- The HTTP test server was stopped and the browser test page unloaded to
  `about:blank`. Closing that test tab was rejected by the tool's approval policy
  (`never`), so the empty isolated tab remains open.
- Keep `/Volumes/Vibe-Temp/Craft/tmp/cad-accept` and
  `/Volumes/Vibe-Temp/Craft/tmp/cad-plugin`. Scratch crates, comparison copies,
  generated runtime fixtures/assets, dist/metadata/logs and task build targets
  were removed after recording these results. Shared dependency/font/tool caches
  were preserved. No commit was created; branch HEAD remains `c01559b`.
