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
    ('            host_save: None,', '            host_save: None,\n            #[cfg(target_arch = "wasm32")]\n            studio_pending_save: None,\n            #[cfg(target_arch = "wasm32")]\n            studio_pending_writes: Vec::new(),'),
    ('        self.dialog_epoch();', '        #[cfg(target_arch = "wasm32")]\n        studio_io::poll(self);\n        self.dialog_epoch();'),
    ('            language: i18n::AUTO.to_string(),', '            language: "zh-hant".to_string(),'),
    ('    pub bookmark_rename: Option<(Vec<usize>, String)>,', '    pub bookmark_rename: Option<(Vec<usize>, String)>,\n    pub(crate) studio_bookmark_owner: Option<DocId>,'),
    ('            bookmark_rename: None,', '            bookmark_rename: None,\n            studio_bookmark_owner: None,'),
    ('                self.notify_fmt("Downloading attachments on the web arrives with M3.10 ({n} bytes ready)", &[("n", &bytes.len().to_string())]);', '                crate::studio_io::write(self, vec![(crate::files::attachment_file_name(&att.name), std::sync::Arc::new(bytes))], |_| {});'),
]:
    text = replace(text, old, new)
text = section(text, '                if let Some(h) = rfd::AsyncFileDialog::new()', '\n            });\n        }\n    }', '''                match crate::studio::open_many("pdf-document").await {
                    Ok(files) => {
                        inbox.lock().unwrap_or_else(std::sync::PoisonError::into_inner).extend(files);
                    }
                    Err(error) => {
                        failed.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(("document".into(), error));
                    }
                }
                if let Some(ctx) = ctx { ctx.request_repaint(); }''')
text = replace(text, '            let inbox = self.inbox.clone();\n            let ctx = self.ctx.clone();', '            let inbox = self.inbox.clone();\n            let failed = self.failed_inbox.clone();\n            let ctx = self.ctx.clone();')
text += '\n#[cfg(target_arch = "wasm32")]\nmod studio;\n#[cfg(target_arch = "wasm32")]\nmod studio_io;\n'
text = replace(text, '    pub(crate) studio_pending_writes: Vec<studio_io::PendingWrite>,', '    pub(crate) studio_pending_writes: Vec<studio_io::PendingWrite>,\n    #[cfg(target_arch = "wasm32")]\n    pub(crate) studio_pending_reads: Vec<studio_io::PendingRead>,')
text = replace(text, '            studio_pending_writes: Vec::new(),', '            studio_pending_writes: Vec::new(),\n            #[cfg(target_arch = "wasm32")]\n            studio_pending_reads: Vec::new(),')
text = replace(text, '        let dropped = ctx.input(|i| i.raw.dropped_files.clone());', '        #[cfg(target_arch = "wasm32")]\n        ctx.input_mut(|input| input.raw.dropped_files.clear());\n        let dropped = ctx.input(|i| i.raw.dropped_files.clone());')
lib.write_text(text)

editing = ui / "editing.rs"
text = editing.read_text()
text = section(text, '            // An embedding page that asked for saves', '\n        }\n    }', '            crate::studio_io::start_save(self, index, id, &name, bytes, Box::new(after))')
text = replace(text, '            let _ = path;', '            let _ = (path, target);')
text = section(text, '/// Offer bytes as a browser download.', '\nimpl PdfCraftApp {', '')
text = replace(text, '        self.unsaved_flag.store(self.first_dirty().is_some(), std::sync::atomic::Ordering::Relaxed);', '        self.unsaved_flag.store(self.first_dirty().is_some(), std::sync::atomic::Ordering::Relaxed);\n        #[cfg(target_arch = "wasm32")]\n        crate::studio::dirty(self.first_dirty().is_some());')
text = replace(text, 'v.pending_edit.is_some() || v.forms.focus.is_some() || v.fill_text.as_ref().is_some_and(|t| !t.text.trim().is_empty())', 'v.pending_edit.is_some() || v.content.draft.is_some() || v.line_editor.is_some() || self.studio_has_bookmark_draft(id) || v.comments.has_studio_drafts(self.session.get(id).map(|doc| &doc.info)) || v.forms.focus.is_some() || v.fill_text.as_ref().is_some_and(|t| !t.text.trim().is_empty())')
text = replace(text, '        self.commit_form_typing() && self.commit_open_fill_text(id)', '        self.commit_form_typing() && self.commit_open_fill_text(id) && self.studio_commit_line_editor(id) && self.studio_commit_content_draft(id) && self.studio_commit_comment_drafts(id) && self.studio_commit_bookmark_draft(id)')
text = replace(text, '            || v.content.blocked().is_some()', '            || v.content.blocked().is_some()\n            || v.content.has_unsaved_draft(doc.added())')
text = replace(text, 'ed.has_unsaved_text()', 'ed.has_changes()')
text = replace(text, '            || v.pending_edit.is_some()', '            || v.pending_edit.is_some()\n            || v.comments.has_studio_drafts(Some(&doc.info))')
text = replace(text, '            || v.content.has_unsaved_draft(doc.added())', '            || v.content.has_unsaved_draft(doc.added())\n            || self.studio_has_bookmark_draft(v.id)')
text = replace(text, '                self.bookmark_rename = Some((vec![n], "Untitled".into()));', '                self.bookmark_rename = Some((vec![n], "Untitled".into()));\n                self.studio_bookmark_owner = Some(id);')
text = replace(text, '                self.bookmark_rename = Some((path, title));', '                self.bookmark_rename = Some((path, title));\n                self.studio_bookmark_owner = Some(id);')
text = replace(text, "fn bookmark_at<'a>(", "pub(crate) fn bookmark_at<'a>(")
text = replace(text, '    fn staging_dir(test: &str) -> PathBuf {', '    pub(super) fn staging_dir(test: &str) -> PathBuf {')
text += '\n' + (suite / "src/pdf-draft-tests.rs").read_text()
editing.write_text(text)
shutil.copyfile(suite / "src/pdf-draft.rs", ui / "studio_drafts.rs")
lib.write_text(lib.read_text() + '\nmod studio_drafts;\n')

path = ui / "edit_text_ui.rs"
text = path.read_text()
text = replace(text, 'mod tests {\n    use super::*;', 'pub(crate) mod tests {\n    use super::*;')
text = replace(text, '    fn preview_app() -> (crate::PdfCraftApp, LineEditor) {', '    pub(crate) fn preview_app() -> (crate::PdfCraftApp, LineEditor) {')
path.write_text(text)

files = ui / "files.rs"
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

patch("create_ui.rs", [('''        match crate::editing::download(&name, &bytes) {
            Ok(()) => saved(self, name),
            Err(e) => self.notify_fmt("Couldn't download {name}: {e}", &[("name", &name), ("e", &e.to_string())]),
        }''', '        crate::studio_io::write(self, vec![(name.clone(), bytes)], move |app| saved(app, name));'),
    ('        self.notify_tr("On the web, open or drop an image to convert it");', '        crate::studio_io::read(self, "picture", true, None, |app, files| app.begin_image_import(files));'),
    ('pub use pdfcraft_engine::CONVERTIBLE;', '#[cfg(not(target_arch = "wasm32"))]\npub use pdfcraft_engine::CONVERTIBLE;')])
patch("measure_ui.rs", [('''            if let Err(e) = crate::editing::download("measurements.csv", csv.as_bytes()) {
                app.notify(&e);
            }''', '            crate::studio_io::write(app, vec![("measurements.csv".into(), std::sync::Arc::new(csv.into_bytes()))], |_| {});')])

path = ui / "print_ui.rs"
text = path.read_text()
text = section(text, '        match crate::editing::download(&file, &pdf) {', '\n    }', '''        self.notify_error(error);
        crate::studio_io::write(self, vec![(file, pdf)], |_| {});''')
text = section(text, '        match crate::editing::download(&file, &bytes) {', '\n    }', '''        crate::studio_io::write(self, vec![(file, std::sync::Arc::new(bytes))], |_| {});
        false''')
path.write_text(text)

path = ui / "create_multiple_ui.rs"
text = path.read_text()
text = replace(text, '        let mut made = 0usize;', '        let mut made = 0usize;\n        #[cfg(target_arch = "wasm32")]\n        let mut outputs = Vec::new();')
text = replace(text, '                crate::editing::download(&filename, &pdf)', '                outputs.push((filename.clone(), pdf));\n                Ok::<(), String>(())')
text = replace(text, '            self.notify(crate::i18n::trn(crate::i18n::current(), made as u64, "Downloaded {n} PDF", "Downloaded {n} PDFs"));', '            crate::studio_io::write(self, outputs, |_| {});')
path.write_text(text)

path = ui / "export_ui.rs"
text = path.read_text()
text = replace(text, '            let msg = run(\n                src,', '            let mut outputs = Vec::new();\n            let msg = run(\n                src,')
text = replace(text, '                |name, bytes| crate::editing::download(name, &bytes),', '                |name, bytes| { outputs.push((name.to_string(), Arc::new(bytes))); Ok(()) },')
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
    ("actions_ui.rs", '''                let r = pdfcraft_engine::actions::run_on(&action, &name, Arc::new(bytes), |_, _| {}).and_then(|r| {
                    #[cfg(not(target_arch = "wasm32"))]
                    write_result(&dir, &name, &r.bytes).map_err(|e| e.to_string())?;
                    #[cfg(target_arch = "wasm32")]
                    crate::editing::download(&name, &r.bytes)?;
                    Ok(())
                });''', '''                let r = match pdfcraft_engine::actions::run_on(&action, &name, Arc::new(bytes), |_, _| {}) {
                    Ok(result) => crate::studio::save(&name, &result.bytes).await,
                    Err(error) => Err(error),
                };'''),
    ("ocr_ui.rs", '''                        let saved = r.and_then(|r| {
                            #[cfg(not(target_arch = "wasm32"))]
                            crate::editing::write_atomically(&dir.join(&name).to_string_lossy(), &r.bytes).map_err(|e| e.to_string())?;
                            #[cfg(target_arch = "wasm32")]
                            crate::editing::download(&name, &r.bytes)?;
                            Ok(r.words())
                        });''', '''                        let saved = match r {
                            Ok(result) => crate::studio::save(&name, &result.bytes).await.map(|()| result.words()),
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
    native = replace(native, '                    #[cfg(target_arch = "wasm32")]\n                    crate::editing::download(&name, &r.bytes)?;' if name == "actions_ui.rs" else '                            #[cfg(target_arch = "wasm32")]\n                            crate::editing::download(&name, &r.bytes)?;', '')
    finish = text.index('\n    }', end)
    tail = replace(text[end:finish], '        #[cfg(target_arch = "wasm32")]\n        work();', '        #[cfg(target_arch = "wasm32")]\n        wasm_bindgen_futures::spawn_local(work);')
    text = text[:begin] + '        #[cfg(not(target_arch = "wasm32"))]\n' + native + '\n        #[cfg(target_arch = "wasm32")]\n' + web + tail + text[finish:]
    path.write_text(text)

# Reuse the existing image mutations, with the same document-generation guard.
path = ui / "content_ui.rs"
text = path.read_text()
for method in ["add_image_dialog", "replace_page_image_dialog", "choose_field_image", "replace_image_dialog"]:
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

patch("stamps_ui.rs", [('        self.notify_tr("Custom stamps arrive on the web with file pickers for images");', '''        crate::studio_io::read(self, "pdf-document", false, None, |app, files| {
            if let Some((name, bytes)) = files.into_iter().next() { app.start_custom_stamp(name, bytes); }
        });''')])

path = ui / "actions_ui.rs"
text = path.read_text()
text = section(text, '            // The open document stands in for a file picker.', '\n        }\n    }', '''            crate::studio_io::read(self, "pdf-only", true, None, move |app, files| app.run_action_on(action, files));''')
path.write_text(text)

path = ui / "fill_sign.rs"
text = path.read_text()
text = replace(text, '        let dialog = rfd::AsyncFileDialog::new().add_filter(tl!(if scan { "Photo" } else { "Image" }), &["png", "jpg", "jpeg"]);', '        #[cfg(not(target_arch = "wasm32"))]\n        let dialog = rfd::AsyncFileDialog::new().add_filter(tl!(if scan { "Photo" } else { "Image" }), &["png", "jpg", "jpeg"]);')
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
text = replace(text, '''        // AGENTS.md §1.1 bars Adobe's type designs whatever their licence, so a checkout that
        // carries one (craft-fonts has Noto Sans CJK, which is Source Han) never embeds it.''', '''        // Studio permits the pinned OFL Noto TC face for its Chinese interface.
        // Keep the upstream exclusions for other font families.''')
text = replace(text, 'if BARRED_FAMILIES.iter().any(|barred| family.starts_with(barred)) {', 'if *family != "Noto Sans CJK TC" && BARRED_FAMILIES.iter().any(|barred| family.starts_with(barred)) {')
text = replace(text, '(*family == "BIZ UDPGothic" && *style == "Regular") || arabic', '((*family == "BIZ UDPGothic" || *family == "Noto Sans CJK TC") && *style == "Regular") || arabic')
path.write_text(text)

path = source / "crates/fonts/src/craft.rs"
text = path.read_text()
text = replace(text, "    /// Whatever the craft-fonts checkout holds, no Adobe type design is embedded (AGENTS.md §1.1).", "    /// Studio permits the pinned OFL Noto TC face; other upstream exclusions remain.")
text = replace(text, 'fn barred_families_are_never_embedded()', 'fn licensed_studio_tc_face_is_the_only_exclusion_exception()')
text = replace(text, 'assert!(!BARRED_FAMILIES.iter().any(|barred| face.family.starts_with(barred)), "{} is embedded", face.name());', 'assert!(face.family == "Noto Sans CJK TC" || !BARRED_FAMILIES.iter().any(|barred| face.family.starts_with(barred)), "{} is embedded", face.name());')
path.write_text(text)

# Studio supplies project-scoped files; disable the upstream URL/parent file ingress.
path = source / "apps/pdfcraft-web/src/main.rs"
text = path.read_text()
text = section(text, '                    // `?file=<url>` opens a PDF from a URL', '                    // eframe never raises a close request', '')
text = section(text, '                    // `?host=parent`: a same-origin page embedding PdfCraft', '                    Ok(Box::new(app))', '')
path.write_text(text)

shutil.copyfile(suite / "src/studio.rs", ui / "studio.rs")
shutil.copyfile(suite / "src/pdf-save.rs", ui / "studio_io.rs")

# Share the existing Post actions with Save, without synthesizing UI input.
path = ui / "comments.rs"
text = path.read_text()
old = '    Edit::AddAnnotation(NewAnnotation { page: cx.page, shape, style: cx.prefs.style(tool), contents, author: cx.prefs.author.clone() })'
text = replace(text, old, '    new_comment_on(cx.page, cx.prefs, tool, shape, contents)')
anchor = '/// The floating composer card (new note, new text box, edit). Returns the edit to apply.'
text = replace(text, anchor, '''fn new_comment_on(page: usize, prefs: &CommentPrefs, tool: CommentTool, shape: Shape, contents: String) -> Edit {
    Edit::AddAnnotation(NewAnnotation { page, shape, style: prefs.style(tool), contents, author: prefs.author.clone() })
}

''' + anchor)
begin = text.index('    let c = view.comments.composer.take()?;', text.index('pub(crate) fn composer('))
end = text.index('\n/// Submit only', begin)
body = text[begin:end].replace('new_comment(&cx, ', 'new_comment_on(page, prefs, ').replace('new_comment(\n', 'new_comment_on(\n').replace('                &cx,\n', '                page, prefs,\n')
body = replace(body, '    let text = c.text.trim_end().to_string();', '    let page = c.page;\n    let text = c.text.trim_end().to_string();')
text = text[:begin] + '    finish_composer(view, info, prefs)\n}\n\npub(crate) fn finish_composer(view: &mut DocView, info: &DocInfo, prefs: &CommentPrefs) -> Option<Edit> {\n' + body + text[end:]
path.write_text(text)

path = ui / "comments_panel.rs"
text = path.read_text()
begin = text.index('            let page = view.current.min(info.pages.len().saturating_sub(1));')
end = text.index('\n        }\n        ui.add_space', begin)
body = text[begin:end]
helper = body.replace('edit = Some(', 'return Some(').replace('                }));', '                }));')
text = text[:begin] + '            edit = finish_add_box(view, info, prefs);' + text[end:]
old = '''                            && let Some((page, index, text)) = view.comments.editing.take()
                        {
                            edit = Some(Edit::SetAnnotationContents { page, index, text });
                        }'''
text = replace(text, old, '''                        {
                            edit = finish_inline_comment(view);
                        }''')
text = replace(text, 'if (ui\n                            .add(egui::Button::new(egui::RichText::new(tl!("Save"))', 'if ui\n                            .add(egui::Button::new(egui::RichText::new(tl!("Save"))')
text = replace(text, '|| submit)\n                        {\n                            edit = finish_inline_comment(view);', '|| submit\n                        {\n                            edit = finish_inline_comment(view);')
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
    ('        let resp = ui.add_enabled(enabled, egui::Button::new(label).shortcut_text(shortcut));', '        let resp = ui.add_enabled(enabled, egui::Button::new(label).shortcut_text(shortcut));\n        let resp = if cfg!(target_arch = "wasm32") && spec.id == "create.clipboard" { resp.on_disabled_hover_text("Clipboard import is unavailable in this browser. Open a text or image file instead.") } else { resp };'),
])
print("PdfCraft document storage, acknowledged saves, Chinese default and plain branding applied")
