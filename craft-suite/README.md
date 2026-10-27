# Craft editors for Studio

Four independent project plugins adapt the upstream WordCraft, DeckCraft,
GridCraft and PdfCraft web editors to Studio's document center and local files. They are modified
distributions, with no endorsement implied by the upstream authors.

## File access

Open and Save As offer this computer or Studio documents. Local file access uses
`studio.files` in the host; it does not require a selected project. The browser
must support the File System Access API in a secure context (desktop Chromium).
Unsupported browsers report that local access is unavailable; downloads are not
substituted for confirmed writes. Local Open selects one file per operation.

Document-center access is initialized only when selected. It pins the project
and selected file version. Save retains the original folder, filename and serial
number; changing projects invalidates that source. Save As chooses a destination,
with the existing plugin folder as its document-center default. The file-access
module does not invalidate local bindings on project change, but the Studio shell
remounts the iframe when its project changes. Select the project before opening
a local file when transferring it to the document center.

Each engine document ID owns its source token and opaque local handle. Save
reuses that source only when its extension matches the serialized format. New
or converted documents ask where to save. Save As replaces a binding only after
a confirmed write. Exports always save copies and leave the source dirty state
unchanged. A local receipt requires the host writer to finish and close; an
upload receipt requires document-center acknowledgement. Cancellation, write
failure, or an unconfirmed receipt never authorize a pending close or destructive
continuation. Later edits remain unsaved. Batch outputs acknowledge every file;
a partial batch reports the exact completed count and keeps its continuation
blocked. The iframe sandbox is unchanged; dropped files remain disabled.

WordCraft, PdfCraft, GridCraft and DeckCraft default to Traditional Chinese.
GridCraft retains its Simplified Chinese option. DeckCraft's display translation
boundaries are adapted from upstream PR 34; its engine stays at the pinned version.
The licensed Noto Sans CJK TC font is bundled for Chinese rendering.

## Source and rebuilding

`upstream.json` pins the four upstream releases and complete Git commits. Obtain
each repository from `https://github.com/storytold/<editor>`, check out its exact
commit, and use a clean checkout for each preparation. Preparation scripts
validate the upstream code fragments before modifying them; they intentionally
refuse to reapply over already modified files.

1. Provision Rust with `wasm32-unknown-unknown`, Trunk 0.22.0, and Python 3.
2. Prepare a `CRAFT_FONTS_DIR` containing `fonts/manifest.txt`,
   `fonts/NotoSansCJKtc-Regular.otf` and its `OFL.txt`. The manifest template is
   `docs/fonts-manifest.txt`. Its source revision is pinned in that file.
3. Run `scripts/prepare-<editor>.py <clean-upstream-checkout>` with Python
   (GridCraft also takes the font directory), then run
   `scripts/prepare-file-access.py <editor> <prepared-checkout>`. The second pass
   copies the current shared Rust and editor save/web adapters. Both passes require their
   expected pinned input and refuse to reapply over modified files.
   For GridCraft and DeckCraft, also run `scripts/prepare-localization.py <editor>
   <prepared-checkout>` after those two passes. This preserves the existing Studio
   save adapters and adds only the reviewed interface localization patch/catalogs.
4. In the upstream `apps/<editor>-web` directory, run Trunk's release build with
   `CRAFT_FONTS_DIR` set and an explicit external output directory. Keep Cargo
   caches, targets and temporary files outside the system disk.
5. Run `scripts/assemble.py <editor> <checkout> <web-build> <new-plugin-output>
   <font-directory>`. The output must not already exist. WASM is compressed
   deterministically and decoded by the browser's native `DecompressionStream`.
6. Capture Cargo metadata with the lockfile enforced, then run
   `scripts/collect-licenses.py <metadata.json> <editor>-web
   <plugin-output>/licenses/rust`. License collection must complete without any
   missing license texts before distribution.
7. Run the shared tests, the editor's save-state checks and Studio's strict
   plugin lint. Verify the packaged result inside Studio with real document
   uploads and reads before signing and publication.

The assembly retains the complete upstream MIT and Apache-2.0 texts, NOTICE,
ATTRIBUTION and bundled asset/font notices. Dependency license texts are retained
under `licenses/rust`; their inventory records exact source revisions. Restricted
ArtCraft brand artwork is not included as integration branding.

## Verification

Shared document access checks run with Node's built-in test runner against
`tests/documents.test.mjs` and `tests/files.test.mjs`. `tests/mutations.mjs` verifies that removing the
version pin, project guard or dirty-state safeguards causes those checks to fail.
Editor-specific checks exercise the actual engine or production save polling
code. These checks complement actual Studio browser verification; they do not
replace it. See `docs/design.md` for the recorded evidence and remaining gates.

Publishing uses Studio's existing owner signing and marketplace channel tools.
The source repository does not contain signing keys or deployment credentials.

PdfCraft Save includes pending page text, paragraph text and formatting, comment
and reply drafts, form/fill text, and bookmark titles on their original document.
Browser "Create PDF from clipboard" is disabled with an explanation because the
upstream Web editor does not implement clipboard import. Open a text or image
file instead.
