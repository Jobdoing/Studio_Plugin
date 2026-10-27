# Studio Craft editors

## Confirmed requirements

- Publish four adjacent entries on the jobdoing.cc Studio marketplace: WordCraft,
  DeckCraft, GridCraft and PdfCraft.
- All five Craft editors (including CadCraft, maintained separately) must open,
  save and Save As to both Studio documents and the browser user's local computer.
  Local access must not require a selected project. Document-center access remains
  project-scoped. A browser download dispatch is never a confirmed disk write.
- Default all four Studio editor interfaces to Traditional Chinese. GridCraft and
  DeckCraft use maintained, version-pinned localization patches; document content
  and command identifiers retain their original values.
- Preserve upstream copyright, full licenses, NOTICE and third-party attribution.
  Modified distributions must remove restricted ArtCraft brand marks. Plain-text
  attribution remains in the credits and marketplace description.
- Reuse Studio's sandbox, document API, project permission checks, signing and
  publication channel. Do not add a separate backend or bypass the document API.

## Source versions under investigation

| Editor | Upstream tag |
|---|---|
| WordCraft | v0.8.0 |
| DeckCraft | v0.8.0 |
| GridCraft | v0.9.0 |
| PdfCraft | v0.9.0 |

The official web ZIP SHA-256 checks all match their published SHA256SUMS.txt.
They are reference artifacts, not the final modified Studio packages.

## Verified integration constraints

- WordCraft has an asynchronous save ticket and Saved/Cancelled/Failed outcomes.
  Adapt its Web Services layer to await the document-center upload result.
- DeckCraft's web write callback is synchronous. A browser download is not a
  confirmed document-center save. Trace the engine's save/new/open continuation
  before changing this contract.
- GridCraft's parent bridge marks a workbook saved when posting bytes, without an
  upload acknowledgement. That bridge cannot be used unchanged.
- PdfCraft marks saved and executes the close/new/open continuation immediately
  after the synchronous host callback returns. It requires an asynchronous
  acknowledgement path; wrapping postMessage alone would risk data loss.
- Studio's sandbox has an opaque origin. The same-origin parent bridges in
  GridCraft/PdfCraft cannot be assumed compatible with it.
- GridCraft's web shell explicitly avoids CJK languages because of missing fonts.
  Enabling Chinese also requires a licensed, bundled font and a rendering check.
- The marketplace source repo stores catalog references only. Editor integration
  sources belong here in Studio_Plugin; catalog refs must point to a published,
  reproducible commit containing the actual installable assets.

## Delivery and acceptance

1. Prove one editor end-to-end with the existing Studio document SDK.
2. Add the remaining editor-specific asynchronous adapters.
3. Verify existing/new document save, save-as, export, cancellation, denied access,
   failed upload, changed project and unsaved navigation. A failed save must not
   mark a document saved or execute a pending destructive continuation.
4. Render Chinese in a real browser and inspect for missing-glyph boxes.
5. Include the exact upstream source revision, modification notice and every
   applicable third-party license in each package; remove restricted brand art.
6. Run strict plugin lint plus actual Studio iframe checks for all four editors.
7. Sign through the existing publisher, preserve all other catalog entries,
   publish the four consecutively and verify the public jobdoing.cc listing and
   actual channel installation.

## Verified progress (2026-10-21)

### File-source clarification

The binding requirement is bidirectional Open / Save / Save As for both Studio
documents and local files. The common chooser supports both. Local operations use
host `studio.files.open/save/saveAs/release`: handles stay opaque, live only for
the plugin frame, and are keyed by engine document identity. The browser must
support File System Access in a secure context; desktop Chromium is the supported
local-write route. Unsupported browsers fail explicitly. The sandbox remains
opaque and does not gain downloads or same-origin permission.

The host asks through its real user button before opening a native file picker
or requesting expired handle permission. Only `createWritable` write and close
success yields `{id, filename, status: "saved"}`. Cancellation or failed close
never clears dirty state. Save As keeps the old binding until a valid receipt;
exports do not rebind. Document-center sessions are lazy, project-pinned and
version-pinned. Same-format Save preserves source folder, filename and serial.
Converted formats require a fresh destination. Multi-file output uses individual
confirmed receipts and never runs a destructive continuation after partial save.

Canonical package assembly and isolated real-browser file acceptance are verified.
Owner signing, publication, channel installation and live deployment remain pending.
The shared local/document-center tests pass 22/22, with no skipped tests. The
coordinator reran all 12 storage mutations against this latest source and detected
all 12; the runner cleaned its temporary workspace. The production PdfCraft save adapter passes 13/13 controlled-session
checks. All four latest source-preparation passes succeed against the pinned
prepared sources. The coordinator built all four final WASM releases successfully.
All four canonical packages have been reassembled; their decompressed WASM bytes
match those build outputs and their three common JavaScript modules match source.
Strict Studio lint succeeds for all four with no errors or warnings (one imported
code inventory notice each). Dependency license inventories contain complete texts
for WordCraft 248, GridCraft 179, DeckCraft 251 and PdfCraft 444 packages, with
unchanged locked dependencies. Native editor checks and real Studio acceptance
remain separate gates.
The historical checks below do not establish that this latest local-file route
has completed acceptance.

### Latest real-editor acceptance and remaining gates

All results below use the real editor canvas and Studio SDK in the unchanged
opaque iframe. Actual stored bytes and full-page reload/reopen are separate
checks from adapter tests. Evidence is under
`/Volumes/Vibe-Temp/Studio5/craft-plugins/final-browser-acceptance`.

WordCraft's Save As intent defect is fixed in the preparation pipeline, rebuilt
and assembled into the canonical package. The coordinator ran all nine targeted
native Studio checks successfully, with no ignored tests. The rebuilt WASM SHA-256
is `58985c9739918fb5bdc6742ae2ba902bda2b4a9421e5289810396a0356bb5e70`.
A real document-center Save As created `craft-final-word-copy.docx` under a new
file ID; editing and ordinary Save advanced only that copy to version 2. The old
source ID, version and hash stayed unchanged. DOCX XML contains the new text.
Cancelling Save As retained the visible unsaved edits and did not advance the
stored version.

WordCraft also passed a headed native Save As, ordinary Save to the same local
file, full-page reload, native Open and visible content verification. The actual
local DOCX is 6551 bytes, SHA-256
`1144cefa36b96fee2114462241a0e79d626eec4f57025bd82a4d1aea75f34d43`;
its text is `Craft local Word verification local overwrite verified`. This flow
worked without a selected project. Selecting a project remounts the editor, so
cross-source acceptance must open the local file after selecting the project.
Both cross-source directions passed Save As followed by editing and ordinary
Save. Local-to-documents created `915f6a98-2a17-42ad-bb79-2ee145bc408d`
(version 2, 6569 bytes); documents-to-local produced a distinct 6576-byte DOCX.
Each old source retained its version/hash. Native Save As cancellation retained
`Word native cancel stays dirty`, the edited title and unchanged local bytes.
`word-local-matrix.json` records the complete local and cross-source checks.

GridCraft's real document-center source reached version 3 with verified cell text.
Save As created `craft-final-grid-copy.xlsx`; editing another cell and ordinary
Save advanced only the copy to version 2. Both stored XLSX XML and full-page
reload/reopen show the two expected cell values. Initial empty-sheet attempts
were not counted as successful content checks. Native Save As, editing and ordinary
Save produced a 4118-byte local XLSX; full reload/native Open displayed all three
saved cell values. Local-to-documents Save As and another ordinary Save created
`205f2090-1e33-442a-b30d-dd67a9e538db` version 2 (4136 bytes) with a fourth
verified cell. Both old sources retained their versions/hashes. Native cancellation
kept `Grid native cancel stays dirty` and the dirty marker without changing stored
bytes or the remote version. `grid-local-matrix.json` records these checks.

PdfCraft created, edited and saved `craft-final-pdf.pdf` through version 2.
Actual PDF text and full-page reload/reopen confirm both text additions. Save As
created `craft-final-pdf-copy.pdf` under a new ID without changing the original
version/hash. Ordinary Save after that copy advanced the copy alone to version 2
with a third verified text addition; actual PDF bytes and a full reload/reopen
show all three additions. Native Save As and ordinary Save produced a 4069-byte
local PDF with a fourth text addition; full reload/native Open displayed all four.
The file remained at 3168 bytes while Chrome's native write permission was pending;
only confirming that permission committed the verified 4069-byte file. This was a
pending permission, not a failed save. Local-to-documents Save As and ordinary Save
created `66dfea89-04b6-4cbd-8cfd-afe4bee20305` version 2 (4986 bytes) with a
fifth verified text addition. The old local file and original document-center copy
kept their versions/hashes. Native Save As cancellation retained the sixth unsaved
addition `PDF native cancel stays dirty` and the dirty marker, without changing
saved bytes or the remote version. `pdf-local-matrix.json` records these checks.
One intermittent UI timeout recovered after bounded focus/rAF diagnosis and reload;
its cause was not established, and no unverified edits were counted as saved.

DeckCraft's initialization panic came from document UID generation calling
`std::process::id()` on wasm32. The preparation pipeline now applies the existing
native-only cfg pattern to that call. The source-guard check passes; the rebuilt
and assembled WASM SHA-256 is
`892607686962e595943a7efcf5eba9d577532a127cfb56f7c5b33999431019ad`.
Real Studio startup now passes both the default BrowserWebGpu and existing GL
entry, with loading removed and event handlers installed. On the default GPU
path, real canvas edits saved `craft-final-deck.deckcraft` through version 2 and
full reload/reopen displayed the saved text. Save As created a different ID for
`craft-final-deck-copy.deckcraft`; later ordinary Save advanced that copy alone
to version 3 with distinct text. The original version/hash stayed unchanged;
actual format JSON and a second full reload/reopen verified the copy's content.
The first copy edit missed the title and version 2 held unchanged bytes; it is
not counted as edited-content evidence. Native Save As to PPTX followed by editing
and ordinary Save produced a 37484-byte local file; full reload/native Open showed
`Deck local ordinary save verified`. Local-to-documents Save As and ordinary Save
created `e1c7b63d-7eb4-4c75-92f5-3306ced4481a` version 2 (37472 bytes), with
distinct saved text and unchanged old local bytes. Both document-center chooser
cancellation and native Save As cancellation retained visible edits and dirty state.
The native case kept `Deck native cancel stays dirty` without changing the old local
hash or new document-center version/hash. `deck-local-matrix.json` records the
complete local/cross-source checks; `deck-docs-matrix.json` records the earlier
separate document-center checks.

Document-center in-place Save now re-fetches the bound file ID and verifies its
folder, name and integer version before uploading; its receipt must retain that
same ID. Tests cover moved, renamed, deleted, changed and missing-folder sources,
a mismatched receipt, and identical filenames in independent folders. Upload is
still addressed by folder/name: the preflight is not an atomic compare-and-swap,
and the source marks that ceiling explicitly. The current Web callers do not
reuse live document IDs across lifetimes or call the exported documents dispose
method; those module-level scenarios did not justify extra mechanisms.

### Historical checks from earlier preparation stages

The following records retain earlier evidence and limitations; statements about
pending builds and ownership describe those earlier stages only.

- WordCraft's modified WASM release builds successfully. It defaults to `zh-hant`
  and embeds Noto Sans CJK TC from the pinned Noto CJK source, with OFL retained.
- Six document-session tests pass, covering pinned-version reads, rejected uploads,
  editor-owned dirty acknowledgements, project changes, plugin-folder destinations,
  and filename validation. Five targeted mutations are rejected.
- Strict Studio lint reports no errors or warnings for the initial WordCraft
  package (one imported-code inventory notice).
- Actual Chrome + Studio plugin-dev, fixture admin / Dev Project 1, confirms
  Traditional Chinese rendering and the native Open button opening our
  document-center dialog. No local filesystem picker is used for this flow.
- A real attempted save to the root was rejected with DOCS_ROOT_IMMUTABLE; the
  native editor retained its dirty state. The picker now uses the platform's
  pluginFolder default and keeps the root out of save destinations.
- In the isolated fixture, `studio-craft-roundtrip.docx` was saved, edited, saved
  again under the same name and reopened from the WordCraft document-center
  folder. The visible reopened document contains exactly
  `Studio document-center roundtrip 2026-10-21` and shows saved state.
- 248 reachable WordCraft Web dependency packages have license texts collected;
  crates with missing archive license texts use their exact .cargo_vcs_info.json
  source revision, not an unpinned main. Native-only CLI dependencies are excluded.
- PdfCraft's asynchronous save adapter passes `cargo check` for wasm32. Its
  production save polling code passes 13 controlled-session checks and rejects six
  targeted mutations. The final release build and actual Studio browser check remain.
- GridCraft passes five real engine Session checks and rejects removal of its
  failed-save guard. Its final release build and browser check remain.
- Independent agents own PdfCraft, GridCraft and DeckCraft integrations; the
  coordinator owns the common document bridge, WordCraft and publication.
- The stock `plugin.mjs check` harness cannot reach the iframe before consent:
  it reports NO_IFRAME at all widths. This was not counted as a successful browser
  check; manual fixture browser validation above is separate evidence.

Current status: the four canonical releases include the rebuilt WordCraft Save As
and DeckCraft initialization fixes. All four passed isolated real-editor local
Open/Save/Save As/full-reload reopen, both cross-source Save As/ordinary Save
paths, and native cancellation with retained dirty state and unchanged old sources.
The coordinator independently checked actual stored files and document-center
current rows/blobs, and maintains the runnable evidence assertions. Historical
checks above retain their original scope and do not replace this latest matrix.
No marketplace entry has been signed or published, and these isolated acceptance
results do not claim live deployment or channel-installation acceptance.

## PdfCraft pending text protection

Save commits pending added page text, existing paragraph text and formatting,
floating comment composers, inline comment edits, replies, the comment add box,
form/fill text and bookmark titles. The original document identity is retained
when its tab is inactive. A failed edit restores the corresponding draft;
stale comment targets are refused before any draft is consumed. Modal settings
continue to require their existing confirmation button.

The native UI checks execute Save, write real PDF bytes and reopen them to
inspect text, font style, annotation contents and bookmark titles. They are
separate from the asynchronous upload-adapter checks and actual Studio browser
acceptance. Browser clipboard import remains visibly disabled because upstream
has no implementation; it does not request new clipboard permissions. This
restriction does not remove the configured document-center/local file routes.
