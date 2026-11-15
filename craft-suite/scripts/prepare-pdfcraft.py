"""Adapt the pinned PdfCraft source to Studio document storage."""
import shutil
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
suite = Path(__file__).resolve().parents[1]
ui = source / "crates/ui-egui/src"


def replace(text, old, new):
    if text.count(old) != 1:
        raise RuntimeError(f"Upstream PdfCraft changed: {old[:100]}")
    return text.replace(old, new)


def section(text, start, end, new):
    if text.count(start) != 1:
        raise RuntimeError(f"Upstream PdfCraft changed: {start[:100]}")
    begin = text.index(start)
    finish = text.index(end, begin)
    return text[:begin] + new + text[finish:]


def patch(name, changes):
    path = ui / name
    text = path.read_text()
    for old, new in changes:
        text = replace(text, old, new)
    path.write_text(text)


lib = ui / "lib.rs"
text = lib.read_text()
for old, new in [
    ('    pub host_save: Option<HostSaveFn>,', '    pub host_save: Option<HostSaveFn>,\n    #[cfg(target_arch = "wasm32")]\n    pub(crate) studio_pending_save: Option<studio_io::PendingSave>,\n    #[cfg(target_arch = "wasm32")]\n    pub(crate) studio_pending_writes: Vec<studio_io::PendingWrite>,'),
    ('    pub bookmark_rename: Option<(Vec<usize>, String)>,', '    pub bookmark_rename: Option<(Vec<usize>, String)>,\n    pub(crate) studio_bookmark_owner: Option<DocId>,'),
]:
    text = replace(text, old, new)
text += '\n#[cfg(target_arch = "wasm32")]\nmod studio;\n#[cfg(target_arch = "wasm32")]\nmod studio_io;\n'
text = replace(text, '    pub(crate) studio_pending_writes: Vec<studio_io::PendingWrite>,', '    pub(crate) studio_pending_writes: Vec<studio_io::PendingWrite>,\n    #[cfg(target_arch = "wasm32")]\n    pub(crate) studio_pending_reads: Vec<studio_io::PendingRead>,')
lib.write_text(text)
patch("app.rs", [
    ('            host_save: None,', '            host_save: None,\n            #[cfg(target_arch = "wasm32")]\n            studio_pending_save: None,\n            #[cfg(target_arch = "wasm32")]\n            studio_pending_writes: Vec::new(),\n            #[cfg(target_arch = "wasm32")]\n            studio_pending_reads: Vec::new(),'),
    ('        self.dialog_epoch();', '        #[cfg(target_arch = "wasm32")]\n        crate::studio_io::poll(self);\n        self.dialog_epoch();'),
    ('            language: i18n::AUTO.to_string(),', '            language: "zh-hant".to_string(),'),
    ('            bookmark_rename: None,', '            bookmark_rename: None,\n            studio_bookmark_owner: None,'),
    ('        let dropped = ctx.input(|i| i.raw.dropped_files.clone());', '        #[cfg(target_arch = "wasm32")]\n        ctx.input_mut(|input| input.raw.dropped_files.clear());\n        let dropped = ctx.input(|i| i.raw.dropped_files.clone());'),
])
# Keep upstream assertions aligned with Studio's default; layout queries use an explicit locale.
patch("i18n/tests.rs", [
    ('''    assert_eq!(app.language, AUTO);
    assert!(app.set_option("language", "xx").is_err());
    // Settings written before the system-locale default (no key) follow the system.
    let mut legacy = crate::PdfCraftApp::default();
    legacy.restore("{}");
    assert_eq!(legacy.language, AUTO);''', '''    assert_eq!(app.language, "zh-hant");
    assert!(app.set_option("language", "xx").is_err());
    // Settings without a language key retain the Studio default.
    let mut legacy = crate::PdfCraftApp::default();
    legacy.restore("{}");
    assert_eq!(legacy.language, "zh-hant");'''),
])
patch("canvas/tests.rs", [
    ('''        let mut app = PdfCraftApp::new();
        let bytes = app.session.create_blank(300.0, 400.0, 100).unwrap();
        app.open_bytes("organize-gaps.pdf", None, bytes.as_ref().clone()).unwrap();''', '''        let mut app = PdfCraftApp::new();
        app.set_option("language", "en").unwrap();
        let bytes = app.session.create_blank(300.0, 400.0, 100).unwrap();
        app.open_bytes("organize-gaps.pdf", None, bytes.as_ref().clone()).unwrap();'''),
])
path = ui / "app/files.rs"
text = path.read_text()
text = replace(text, '                self.notify_fmt("Downloading attachments on the web arrives with M3.10 ({n} bytes ready)", &[("n", &bytes.len().to_string())]);', '                crate::studio_io::write(self, vec![(crate::files::attachment_file_name(&att.name), std::sync::Arc::new(bytes))], |_| {});')
text = section(text, '                if let Some(h) = Self::open_picker().pick_file().await {', '\n            });\n        }\n    }', '''                match crate::studio::open_many("pdf-document").await {
                    Ok(files) => {
                        inbox.lock().unwrap_or_else(std::sync::PoisonError::into_inner).extend(files);
                    }
                    Err(error) => {
                        failed.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(("document".into(), error));
                    }
                }
                if let Some(ctx) = ctx { ctx.request_repaint(); }''')
text = replace(text, '            let inbox = self.inbox.clone();\n            let ctx = self.ctx.clone();', '            let inbox = self.inbox.clone();\n            let failed = self.failed_inbox.clone();\n            let ctx = self.ctx.clone();')
path.write_text(text)

editing = ui / "editing/save.rs"
text = editing.read_text()
text = section(text, '            // An embedding page that asked for saves', '\n        }\n    }', '            crate::studio_io::start_save(self, index, id, &name, bytes, Box::new(after))')
text = replace(text, '            let _ = path;', '            let _ = (path, target);')
# Save As writes a clean copy without earlier revisions, as the native save does (#2165); a signed or read-only document stays incremental.
text = replace(text, '            let bytes = match self.session.save_bytes(id) {', '            let full = target == SaveTarget::As && self.session.get(id).is_some_and(|d| d.read_only_reason.is_none() && !d.is_signed());\n            let bytes = match if full { self.session.save_full_bytes(id) } else { self.session.save_bytes(id) } {')
begin = text.index('/// Offer bytes as a browser download.')
finish = text.index('\n    Ok(())\n}', begin) + len('\n    Ok(())\n}')
text = replace(text, text[begin:finish], '')
editing.write_text(text)
patch("editing.rs", [('#[cfg(target_arch = "wasm32")]\npub(crate) use save::download;\n', '')])
# Upstream's unsaved flag also covers an OCR review that is still open; Studio hears the same answer.
patch("editing/close.rs", [('        self.unsaved_flag.store(self.work_at_risk(), std::sync::atomic::Ordering::Relaxed);', '        self.unsaved_flag.store(self.work_at_risk(), std::sync::atomic::Ordering::Relaxed);\n        #[cfg(target_arch = "wasm32")]\n        crate::studio::dirty(self.work_at_risk());')])
editing = ui / "editing.rs"
text = editing.read_text()
text = replace(text, '            v.pending_edit.is_some()\n                || v.forms.focus.is_some()', '            v.pending_edit.is_some()\n                || self.studio_has_bookmark_draft(id)\n                || v.comments.has_studio_drafts(self.session.get(id).map(|doc| &doc.info))\n                || v.forms.focus.is_some()')
# Upstream now commits paragraph and content drafts, restoring them when edits fail.
text = replace(text, '        self.commit_form_typing() && self.commit_open_fill_text(i, id) && self.commit_open_text_edits(i, id)', '        self.commit_form_typing() && self.commit_open_fill_text(i, id) && self.commit_open_text_edits(i, id) && self.studio_commit_comment_drafts(id) && self.studio_commit_bookmark_draft(id)')
text = replace(text, '|| v.line_editor.as_ref().map_or_else(|| false, |ed| ed.has_unsaved_text())', '|| v.line_editor.as_ref().map_or_else(|| false, |ed| ed.has_changes())')
text = replace(text, '        v.pending_edit.is_some()\n            || v.content.blocked().is_some()', '        v.pending_edit.is_some()\n            || v.comments.has_studio_drafts(Some(&doc.info))\n            || v.content.blocked().is_some()\n            || v.content.has_unsaved_draft(doc.added())\n            || self.studio_has_bookmark_draft(v.id)')
text = replace(text, '                self.bookmark_rename = Some((vec![n], "Untitled".into()));', '                self.bookmark_rename = Some((vec![n], "Untitled".into()));\n                self.studio_bookmark_owner = Some(id);')
text = replace(text, '                self.bookmark_rename = Some((path, title));', '                self.bookmark_rename = Some((path, title));\n                self.studio_bookmark_owner = Some(id);')
text = replace(text, "fn bookmark_at<'a>(", "pub(crate) fn bookmark_at<'a>(")
text += '\n' + (suite / "src/pdf-draft-tests.rs").read_text()
editing.write_text(text)
patch("editing/tests.rs", [('fn staging_dir(test: &str) -> PathBuf {', 'pub(super) fn staging_dir(test: &str) -> PathBuf {')])
shutil.copyfile(suite / "src/pdf-draft.rs", ui / "studio_drafts.rs")
lib.write_text(lib.read_text() + '\nmod studio_drafts;\n')

path = ui / "tools/edit_text_ui.rs"
text = path.read_text()
text = replace(text, 'mod tests {\n    use super::*;', 'pub(crate) mod tests {\n    use super::*;')
text = replace(text, '    fn preview_app() -> (crate::PdfCraftApp, LineEditor) {', '    pub(crate) fn preview_app() -> (crate::PdfCraftApp, LineEditor) {')
path.write_text(text)

files = ui / "workflows/files.rs"
text = files.read_text()
text = replace(text, 'fn files_picker(purpose: FilePurpose) -> rfd::AsyncFileDialog {', '#[cfg(not(target_arch = "wasm32"))]\nfn files_picker(purpose: FilePurpose) -> rfd::AsyncFileDialog {')
text = replace(text, '            let requests = self.requests.clone();', '            let requests = self.requests.clone();\n            let failed = self.failed_inbox.clone();')
text = section(text, '                let dialog = files_picker(purpose);', '\n                if !files.is_empty()', '''                let filter = match purpose {
                    FilePurpose::TextFont { .. } => "font",
                    FilePurpose::RedactWords => "text",
                    FilePurpose::Ocr | FilePurpose::ReplacePages => "pdf-only",
                    _ => "pdf-document",
                };
                let picked = if multiple {
                    crate::studio::open_many(filter).await
                } else {
                    crate::studio::open(filter).await.map(|file| file.into_iter().collect())
                };
                let files = match picked {
                    Ok(files) => files,
                    Err(error) => {
                        failed.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(("document".into(), error));
                        Vec::new()
                    }
                };''')
text = section(text, '            let _ = title;\n            for (name, bytes) in &named {', '\n        }\n    }', '            let _ = title;\n            crate::studio_io::write(self, named, after);')
text = replace(text, '''        if let Err(e) = crate::editing::download(&format!("{stem}.{ext}"), &bytes) {
            self.notify_error(e);
        }''', '        crate::studio_io::write(self, vec![(format!("{stem}.{ext}"), Arc::new(bytes))], |_| {});')
text = replace(text, '        let _ = crate::editing::download("report.csv", csv.as_bytes());', '        crate::studio_io::write(self, vec![("report.csv".into(), Arc::new(csv.into_bytes()))], |_| {});')
text = replace(text, '                let _ = crate::editing::download(&format!("{stem}.xfdf"), &bytes);', '                crate::studio_io::write(self, vec![(format!("{stem}.xfdf"), Arc::new(bytes))], |_| {});')
text = replace(text, '        self.notify_tr("Importing data arrives on the web with file pickers for data files");', '''        {
            let target = self.pick_target(self.active_ids().map(|(_, id)| id));
            crate::studio_io::read(self, "pdf-data", false, target, |app, files| {
                if let Some((name, bytes)) = files.into_iter().next() {
                    app.apply_edit(Edit::ImportData { name, bytes: Arc::new(bytes) });
                }
            });
        }''')
text = replace(text, '        self.notify_tr("Merging data files needs the desktop app");', '        crate::studio_io::read(self, "pdf-data", true, None, |app, files| app.merge_data_files(files));')
files.write_text(text)

patch("workflows/create_ui.rs", [('''            match crate::editing::download(&name, &bytes) {
                Ok(()) => saved(self, name),
                Err(e) => self.notify_fmt("Couldn't download {name}: {e}", &[("name", &name), ("e", &e.to_string())]),
            }''', '            crate::studio_io::write(self, vec![(name.clone(), bytes)], move |app| saved(app, name));'),
    ('        self.notify_tr("On the web, open or drop an image to convert it");', '        crate::studio_io::read(self, "picture", true, None, |app, files| app.begin_image_import(files));')])
patch("canvas/zoom_snap.rs", [('''        if let Err(e) = crate::editing::download(&name, &png) {
            self.notify_error(e);
        }''', '        crate::studio_io::write(self, vec![(name, std::sync::Arc::new(png))], |_| {});')])
patch("tools/measure_ui.rs", [('''            if let Err(e) = crate::editing::download("measurements.csv", csv.as_bytes()) {
                app.notify(&e);
            }''', '            crate::studio_io::write(app, vec![("measurements.csv".into(), std::sync::Arc::new(csv.into_bytes()))], |_| {});')])

path = ui / "workflows/print_ui.rs"
text = path.read_text()
text = section(text, '        match crate::editing::download(&file, &pdf) {', '\n    }', '''        self.notify_error(error);
        crate::studio_io::write(self, vec![(file, pdf)], |_| {});''')
text = section(text, '        match crate::editing::download(&file, &bytes) {', '\n    }', '''        crate::studio_io::write(self, vec![(file, std::sync::Arc::new(bytes))], |_| {});
        false''')
path.write_text(text)

path = ui / "workflows/create_multiple_ui.rs"
text = path.read_text()
text = replace(text, '        let mut made = 0usize;', '        let mut made = 0usize;\n        #[cfg(target_arch = "wasm32")]\n        let mut outputs = Vec::new();')
text = replace(text, '                crate::editing::download(&filename, &pdf)', '                outputs.push((filename.clone(), pdf));\n                Ok::<(), String>(())')
text = replace(text, '            self.notify(crate::i18n::trn(crate::i18n::current(), made as u64, "Downloaded {n} PDF", "Downloaded {n} PDFs"));', '            crate::studio_io::write(self, outputs, |_| {});')
path.write_text(text)

path = ui / "workflows/export_ui.rs"
text = path.read_text()
text = replace(text, '            let msg =\n                run(ExportTask {', '            let mut outputs = Vec::new();\n            let msg =\n                run(ExportTask {')
text = replace(text, '                    crate::editing::download(name, &bytes)', '                    outputs.push((name.to_string(), Arc::new(bytes))); Ok(())')
text = replace(text, '''            if let Ok(mut s) = status.lock() {
                *s = Some((0, 0, Some(msg)));
            }
            self.export_status = Some(status);''', '''            if outputs.is_empty() {
                self.notify(msg);
            } else {
                crate::studio_io::write(self, outputs, move |app| app.notify(msg));
            }''')
path.write_text(text)

# Workers keep their existing progress accounting, but only count acknowledged uploads.
for name, old, new in [
    ("workflows/actions_ui.rs", '''                let r = pdfcraft_engine::actions::run_on(&action, &name, Arc::new(bytes), javascript, |_, _| {}).and_then(|r| {
                    #[cfg(not(target_arch = "wasm32"))]
                    write_result(&dir, &name, &r.bytes).map_err(|e| e.to_string())?;
                    #[cfg(target_arch = "wasm32")]
                    crate::editing::download(&name, &r.bytes)?;
                    Ok(())
                });''', '''                let r = match pdfcraft_engine::actions::run_on(&action, &name, Arc::new(bytes), javascript, |_, _| {}) {
                    Ok(result) => crate::studio::save(&name, &result.bytes).await,
                    Err(error) => Err(error),
                };'''),
]:
    path = ui / name
    text = path.read_text()
    begin = text.rindex('        let work = move || {', 0, text.index(old))
    end = text.index('\n        #[cfg(not(target_arch = "wasm32"))]\n        if self.run_inline', begin)
    native = text[begin:end]
    web = replace(native, '        let work = move || {', '        let work = async move {')
    web = replace(web, old, new)
    native = replace(native, '                    #[cfg(target_arch = "wasm32")]\n                    crate::editing::download(&name, &r.bytes)?;', '')
    finish = text.index('\n    }', end)
    tail = replace(text[end:finish], '        #[cfg(target_arch = "wasm32")]\n        work();', '        #[cfg(target_arch = "wasm32")]\n        wasm_bindgen_futures::spawn_local(work);')
    text = text[:begin] + '        #[cfg(not(target_arch = "wasm32"))]\n' + native + '\n        #[cfg(target_arch = "wasm32")]\n' + web + tail + text[finish:]
    path.write_text(text)

# The web batch reads pages in Web Workers; a finished copy counts only after Studio confirms it.
path = ui / "workflows/ocr_web.rs"
text = path.read_text()
text = replace(text, '    current: Option<(String, Box<FileJob>, Pages)>,\n    total: usize,', '    current: Option<(String, Box<FileJob>, Pages)>,\n    /// A finished copy waiting for the Studio receipt; the next file starts after it.\n    delivering: Option<(String, pdfcraft_engine::ocr::FileResult, crate::studio_io::Delivery)>,\n    total: usize,')
text = replace(text, '            current: None,\n            total,', '            current: None,\n            delivering: None,\n            total,')
text = replace(text, '''    pub fn pump(&mut self, cancel: bool, ctx: &egui::Context) -> bool {
''', '''    pub fn pump(&mut self, cancel: bool, ctx: &egui::Context) -> bool {
        if let Some((name, r, delivery)) = self.delivering.take() {
            match delivery.receipt() {
                None => self.delivering = Some((name, r, delivery)),
                Some(Ok(())) => {
                    self.ok += 1;
                    self.words += r.words();
                    if let Some(note) = crate::ocr_ui::low_confidence_note(&name, &r, self.settings.low_confidence_threshold) {
                        self.notes.push(note);
                    }
                }
                Some(Err(e)) => self.failed.push(format!("{name}: {e}")),
            }
            return false;
        }
''')
text = section(text, '        let saved = file.finish(found).and_then(|r| {', '        false\n    }\n}', '''        match file.finish(found) {
            Ok(r) => {
                let ctx = ctx.clone();
                let delivery = crate::studio_io::deliver(move || ctx.request_repaint(), name.clone(), r.bytes.clone());
                self.delivering = Some((name, r, delivery));
            }
            Err(e) => self.failed.push(format!("{name}: {e}")),
        }
''')
path.write_text(text)

# Editable OCR output keeps its review until Studio confirms delivery.
path = ui / "workflows/ocr_verify.rs"
text = path.read_text()
# The Studio default language is Chinese; this test looks for an English label.
text = replace(text, '''            let mut app = PdfCraftApp::new();
            app.open_bytes("scan.pdf", None, bytes.clone()).expect("fixture");
            app
        });
        h.run_steps(4);
        assert!(h.state_mut().execute("ocr.correct"));''', '''            let mut app = PdfCraftApp::new();
            app.set_option("language", "en").unwrap();
            app.open_bytes("scan.pdf", None, bytes.clone()).expect("fixture");
            app
        });
        h.run_steps(4);
        assert!(h.state_mut().execute("ocr.correct"));''')
text = section(text, '        let saved = crate::editing::download(&name, &bytes);', '\n    }\n}', '''        with_state(app, |v, _| v.phase = Phase::Saving);
        crate::studio_io::write_or_else(app, vec![(name, bytes)],
            |app| with_state(app, |v, _| v.finish()),
            |app| with_state(app, |v, _| v.phase = Phase::ReviewReady));''')
path.write_text(text)

# Reuse the existing image mutations, with the same document-generation guard.
path = ui / "tools/content_ui.rs"
text = path.read_text()
for method in ["add_image_dialog", "replace_page_image_dialog", "choose_field_image_target", "replace_image_dialog"]:
    begin = text.index(f"fn {method}(")
    end = text.index('\n    }', begin)
    body = text[begin:end]
    body = replace(body, '        #[cfg(not(target_arch = "wasm32"))]\n', '')
    body = body[:body.index('        #[cfg(target_arch = "wasm32")]')].rstrip()
    text = text[:begin] + body + text[end:]
text = replace(text, '    /// Edit a PDF ▸ Add content ▸ Image: pick a file and place it in the middle of the current page.', '''    #[cfg(target_arch = "wasm32")]
    fn pick_image(&mut self, _title: &str, then: impl FnOnce(&mut Self, String, Vec<u8>) + Send + 'static) {
        let target = self.pick_target(self.active_ids().map(|(_, id)| id));
        crate::studio_io::read(self, "picture", false, target, move |app, files| {
            if let Some((name, bytes)) = files.into_iter().next() { then(app, name, bytes); }
        });
    }

    /// Edit a PDF ▸ Add content ▸ Image: pick a file and place it in the middle of the current page.''')
path.write_text(text)

patch("tools/stamps_ui.rs", [('        self.notify_tr("Custom stamps arrive on the web with file pickers for images");', '''        crate::studio_io::read(self, "pdf-document", false, None, |app, files| {
            if let Some((name, bytes)) = files.into_iter().next() { app.start_custom_stamp(name, bytes); }
        });''')])

path = ui / "workflows/actions_ui.rs"
text = path.read_text()
text = section(text, '            // The open document stands in for a file picker.', '\n        }\n    }', '''            crate::studio_io::read(self, "pdf-only", true, None, move |app, files| app.run_action_on(action, files));''')
path.write_text(text)

path = ui / "tools/fill_sign.rs"
text = path.read_text()
text = replace(text, '        let dialog = rfd::AsyncFileDialog::new().add_filter_any_case(tl!(if scan { "Photo" } else { "Image" }), &["png", "jpg", "jpeg"]);', '        #[cfg(not(target_arch = "wasm32"))]\n        let dialog = rfd::AsyncFileDialog::new().add_filter_any_case(tl!(if scan { "Photo" } else { "Image" }), &["png", "jpg", "jpeg"]);')
text = section(text, '                let bytes = if let Some(file) = dialog.pick_file().await {', '\n                *inbox.picked.lock()', '''                let bytes = match crate::studio::open("picture").await {
                    Ok(Some((_, bytes))) => Some(if bytes.len() > limit { Err(too_large) } else { Ok(bytes) }),
                    Ok(None) => None,
                    Err(error) => Some(Err(error)),
                };''')
path.write_text(text)

path = ui / "widgets.rs"
text = path.read_text()
text = section(text, '/// The ArtCraft wordmark', '/// Buttons for every community link', '''/// Plain text identity for the modified Studio distribution.
pub fn artcraft_logo(ui: &mut egui::Ui, height: f32) -> Response {
    ui.label(egui::RichText::new("Jobdoing").size(height))
}

/// Plain text identity without upstream restricted brand artwork.
pub fn artcraft_mark(ui: &mut egui::Ui, size: f32) -> Response {
    ui.label(egui::RichText::new("PDF").size(size * 0.55))
}

''')
path.write_text(text)

path = source / "crates/fonts/build.rs"
text = path.read_text()
# Upstream removed the font-family exclusion; retain the Studio TC web face.
text = replace(text, '(*family == "BIZ UDPGothic" && *style == "Regular")', '((*family == "BIZ UDPGothic" || *family == "Noto Sans CJK TC") && *style == "Regular")')
path.write_text(text)

# Studio supplies project-scoped files; disable the upstream URL/parent file ingress.
path = source / "apps/pdfcraft-web/src/main.rs"
text = path.read_text()
text = section(text, '                    // `?file=<url>` opens a PDF from a URL', '                    // eframe never raises a close request', '')
text = replace(text, '''        pub fn connect(canvas: &web_sys::HtmlCanvasElement) -> Option<Self> {
            Some(Self { host: Rc::new(Host::connect(APP, canvas)?) })
        }''', '''        pub fn connect(_canvas: &web_sys::HtmlCanvasElement) -> Option<Self> {
            // Studio owns file permissions, ingress and acknowledged save receipts.
            None
        }''')
text = replace(text, '    const APP: &str = "pdfcraft";\n', '')
path.write_text(text)

shutil.copyfile(suite / "src/studio.rs", ui / "studio.rs")
shutil.copyfile(suite / "src/pdf-save.rs", ui / "studio_io.rs")

# Share the existing Post actions with Save, without synthesizing UI input.
path = ui / "tools/comments/paint.rs"
text = path.read_text()
old = '    Edit::AddAnnotation(NewAnnotation { page: cx.page, shape, style: cx.prefs.style(tool), contents, author: cx.prefs.author.clone() })'
text = replace(text, old, '    new_comment_on(cx.page, cx.prefs, tool, shape, contents)')
anchor = 'pub(super) fn new_comment(cx:'
text = replace(text, anchor, '''pub(super) fn new_comment_on(page: usize, prefs: &super::CommentPrefs, tool: CommentTool, shape: Shape, contents: String) -> Edit {
    Edit::AddAnnotation(NewAnnotation { page, shape, style: prefs.style(tool), contents, author: prefs.author.clone() })
}

''' + anchor)
path.write_text(text)
path = ui / "tools/comments/composer.rs"
text = path.read_text()
text = replace(text, 'use super::paint::{edited_in_view, new_comment};', 'use super::paint::{edited_in_view, new_comment_on};')
begin = text.index('    let c = view.comments.composer.take()?;', text.index('pub(crate) fn composer('))
end = text.index('\n/// Submit only', begin)
body = text[begin:end].replace('new_comment(&cx, ', 'new_comment_on(page, prefs, ').replace('new_comment(\n', 'new_comment_on(\n').replace('                &cx,\n', '                page, prefs,\n')
body = replace(body, '    let c = view.comments.composer.take()?;', '    let c = view.comments.composer.take()?;\n    let page = c.page;')
text = text[:begin] + '    finish_composer(view, info, prefs)\n}\n\npub(crate) fn finish_composer(view: &mut DocView, info: &DocInfo, prefs: &CommentPrefs) -> Option<Edit> {\n' + body + text[end:]
path.write_text(text)
patch("tools/comments.rs", [('pub(crate) use composer::{composer, submit_key};', 'pub(crate) use composer::{composer, finish_composer, submit_key};')])

path = ui / "panels/comments_panel.rs"
text = path.read_text()
begin = text.index('            let page = view.current.min(info.pages.len().saturating_sub(1));')
end = text.index('\n        }\n        ui.add_space', begin)
body = text[begin:end]
helper = body.replace('edit = Some(', 'return Some(').replace('                }));', '                }));')
text = text[:begin] + '            edit = finish_add_box(view, info, prefs);' + text[end:]
old = '''        if (ui.add(egui::Button::new(egui::RichText::new(tl!("Save")).color(Color32::WHITE)).fill(t.accent).corner_radius(12)).clicked() || submit)
            && let Some((page, index, text)) = view.comments.editing.take()
        {
            edit = Some(Edit::SetAnnotationContents { page, index, text });
        }'''
text = replace(text, old, '''        if ui.add(egui::Button::new(egui::RichText::new(tl!("Save")).color(Color32::WHITE)).fill(t.accent).corner_radius(12)).clicked() || submit {
            edit = finish_inline_comment(view);
        }''')
text = replace(text, '''                        let text = std::mem::take(&mut view.comments.reply).trim().to_string();
                        edit = Some(Edit::ReplyToAnnotation { page: a.page, index: a.index, text, author: prefs.author.clone() });''', '                        edit = finish_reply(view, a, prefs);')
text += '\npub(crate) fn finish_add_box(view: &mut DocView, info: &DocInfo, prefs: &CommentPrefs) -> Option<Edit> {\n    if view.comments.add_box.trim().is_empty() { return None; }\n' + helper + '\n    None\n}\n'
text += '''
pub(crate) fn finish_inline_comment(view: &mut DocView) -> Option<Edit> {
    view.comments.editing.take().map(|(page, index, text)| Edit::SetAnnotationContents { page, index, text })
}

pub(crate) fn finish_reply(view: &mut DocView, annotation: &Annotation, prefs: &CommentPrefs) -> Option<Edit> {
    if view.comments.reply.trim().is_empty() { return None; }
    let text = std::mem::take(&mut view.comments.reply).trim().to_string();
    Some(Edit::ReplyToAnnotation { page: annotation.page, index: annotation.index, text, author: prefs.author.clone() })
}
'''
path.write_text(text)

patch("commands.rs", [
    ('    pub(crate) fn command_enabled(&self, spec: &CommandSpec) -> bool {', '    pub(crate) fn command_enabled(&self, spec: &CommandSpec) -> bool {\n        if cfg!(target_arch = "wasm32") && spec.id == "create.clipboard" { return false; }'),
    ('    fn disabled_reason(&self, spec: &CommandSpec) -> String {', '    fn disabled_reason(&self, spec: &CommandSpec) -> String {\n        if cfg!(target_arch = "wasm32") && spec.id == "create.clipboard" { return "Clipboard import is unavailable in this browser. Open a text or image file instead.".into(); }'),
])
print("PdfCraft document storage, acknowledged saves, Chinese default and plain branding applied")
