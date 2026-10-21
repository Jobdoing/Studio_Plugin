"""Add source identity and save intent after the pinned editor preparation."""
from pathlib import Path
import sys

source = Path(sys.argv[2]).resolve()
editor = sys.argv[1]

def patch(name, old, new):
    path = source / name
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f"Unexpected {editor} source: {name}: {old[:80]}")
    path.write_text(text.replace(old, new))

ui = "crates/ui-egui/src/"
if editor == "wordcraft":
    patch(ui + "lib.rs", "    pub inbox: Option<Inbox>,", "    pub inbox: Option<Inbox>,\n    pub studio_opened: Option<std::sync::Arc<std::sync::Mutex<Vec<(String, Vec<u8>, String)>>>>,\n    pub studio_save: Option<Box<dyn Fn(u64, &str, &[u8], bool, bool) -> Result<(), String>>>,\n    pub studio_bind: Option<Box<dyn Fn(u64, &str)>>,\n    pub studio_discard: Option<Box<dyn Fn(&str)>>,")
    patch(ui + "lib.rs", "        let document = self.session.document_id();\n        let old_path", "        let source = params.get(\"studioSource\").and_then(Value::as_str).map(str::to_string);\n        let document = self.session.document_id();\n        let old_path")
    patch(ui + "lib.rs", "        // When the document has been replaced", "        if r.is_ok() && id == \"file.open\" && self.session.document_id() != document {\n            if let (Some(bind), Some(source)) = (&self.services.studio_bind, source) { bind(self.session.document_id(), &source); }\n        }\n        // When the document has been replaced")
    patch(ui + "lib.rs", "            if let Some(d) = &self.services.download\n                && let Err(e) = d(&name, &bytes)\n            {", "            let delivered = if let Some(save) = &self.services.studio_save {\n                save(self.session.document_id(), &name, &bytes, id == \"file.saveAs\", !matches!(id, \"file.save\" | \"file.saveAs\") || !keeps_everything(&name))\n            } else if let Some(download) = &self.services.download { download(&name, &bytes) } else { Ok(()) };\n            if let Err(e) = delivered {")
    patch(ui + "lib.rs", "    fn drain_inbox(&mut self) {\n        let Some(inbox)", "    fn drain_inbox(&mut self) {\n        let opened = self.services.studio_opened.as_ref().map(|q| std::mem::take(&mut *q.lock().unwrap_or_else(std::sync::PoisonError::into_inner))).unwrap_or_default();\n        for (name, bytes, source) in opened {\n            let _ = self.run(\"file.open\", json!({\"path\": name, \"data\": wordcraft_engine::cmd::insert::base64_encode(&bytes), \"studioSource\": source}));\n        }\n        let Some(inbox)")
    patch(ui + "lib.rs", '    marked_saved: bool,\n}', '    marked_saved: bool,\n    revision: u64,\n}')
    patch(ui + "lib.rs", '            if marked_saved {\n                self.session.dirty = false;\n            }', '            if marked_saved && self.services.studio_save.is_none() {\n                self.session.dirty = false;\n            }')
    patch(ui + "lib.rs", 'document, marked_saved });', 'document, marked_saved, revision: self.session.rev() });')
    patch(ui + "lib.rs", '                            self.session.path = Some(filename.into());', '                            self.session.path = Some(filename.into());\n                            if self.services.studio_save.is_some() && self.session.rev() == save.revision { self.session.dirty = false; }')
    patch(ui + "lib.rs", '        if !self.safely_saved(saved) {', '        if self.services.studio_save.is_some() {\n            if let Some(ticket) = v.get("pendingSave").and_then(Value::as_u64) {\n                if self.saves_in_flight.iter().any(|save| save.ticket == ticket && save.marked_saved) { return Ok(PromptSave::Later(ticket)); }\n            }\n        }\n        if !self.safely_saved(saved) {')
    patch(ui + "lib.rs", '        if !go {\n            return Ok(json!({"done": false}));', '        if !go {\n            if let (Some(discard), Some(token)) = (&self.services.studio_discard, params.get("studioSource").and_then(Value::as_str)) { discard(token); }\n            return Ok(json!({"done": false}));')
    patch(ui + "lib.rs", '        let retry = (id == "file.open").then(|| params.clone());', '        let retry = (id == "file.open").then(|| params.clone());\n        let source = params.get("studioSource").and_then(Value::as_str).map(str::to_string);')
    patch(ui + "lib.rs", '        r\n    }\n\n    /// Save before New/Open/Close', '        if r.is_err() && id == "file.open" {\n            if let (Some(discard), Some(token)) = (&self.services.studio_discard, source) { discard(&token); }\n        }\n        r\n    }\n\n    /// Save before New/Open/Close')
    patch(ui + "dialogs.rs", '    } else {\n        app.canvas.want_focus = true;', '    } else {\n        if let Dialog::Password { params, .. } = &d {\n            if let (Some(discard), Some(token)) = (&app.services.studio_discard, params.get("studioSource").and_then(Value::as_str)) { discard(token); }\n        }\n        if !open {\n            if let Dialog::SaveChanges { params, .. } = &d {\n                if let (Some(discard), Some(token)) = (&app.services.studio_discard, params.get("studioSource").and_then(Value::as_str)) { discard(token); }\n            }\n        }\n        app.canvas.want_focus = true;')
    patch(ui + "file_dialogs.rs", 'let result = picked.map(|path| self.run("file.save", json!({"path": path})));', 'let result = picked.map(|path| self.run(if self.services.studio_save.is_some() { "file.saveAs" } else { "file.save" }, json!({"path": path})));')
    patch(ui + "lib.rs", '    const UNSAVED: &str = "My unsaved novel chapter";', '''    #[test]
    fn studio_save_as_dialog_preserves_destination_intent() {
        let (mut app, saves, ticket) = web_picker_app();
        let seen = std::rc::Rc::new(std::cell::Cell::new(false));
        let observed = seen.clone();
        let current = ticket.clone();
        let service = saves.clone();
        app.services.studio_save = Some(Box::new(move |_, _, _, save_as, _| { observed.set(save_as); current.set(service.start()); Ok(()) }));
        app.session.path = Some("Existing.docx".into());
        // Match the web host's filename handoff before Studio chooses the destination.
        app.services.pick_save = Some(Box::new(|name| Some(name.to_string())));
        app.save_as_dialog();
        assert!(seen.get(), "Save As must request a fresh destination even for a bound document");
        assert_eq!(saves.pending(), 1, "the destination receipt is still pending");
        assert_eq!(app.session.path.as_deref(), Some(std::path::Path::new("Existing.docx")));
        assert!(app.session.dirty, "the new destination is not confirmed yet");
    }

    #[test]
    fn studio_confirmed_save_runs_pending_close_and_cancel_keeps_it_open() {
        for success in [true, false] {
            let (mut app, saves, ticket) = web_picker_app();
            let service = saves.clone();
            let current = ticket.clone();
            app.services.studio_save = Some(Box::new(move |_, _, _, _, _| { current.set(service.start()); Ok(()) }));
            app.run("file.close", json!({})).unwrap();
            app.run("ui.saveChanges", json!({"answer": "save"})).unwrap();
            assert!(app.session.dirty);
            assert!(!app.quit_requested);
            if success { saves.filename(ticket.get(), "Confirmed.docx".into()); }
            saves.finish(ticket.get(), if success { async_saves::SaveOutcome::Saved } else { async_saves::SaveOutcome::Cancelled });
            app.settle_async_saves();
            assert_eq!(app.quit_requested, success);
            assert_eq!(app.session.dirty, !success);
        }
    }

    #[test]
    fn studio_pending_receipt_keeps_dirty_until_confirmed() {
        let (mut app, saves, ticket) = web_picker_app();
        let service = saves.clone();
        let current = ticket.clone();
        app.services.studio_save = Some(Box::new(move |_, _, _, _, _| { current.set(service.start()); Ok(()) }));
        app.execute("file.save", json!({})).unwrap();
        assert!(app.session.dirty, "starting delivery is not a save receipt");
        saves.filename(ticket.get(), "Confirmed.docx".into());
        saves.finish(ticket.get(), async_saves::SaveOutcome::Saved);
        app.settle_async_saves();
        assert!(!app.session.dirty);
    }

    const UNSAVED: &str = "My unsaved novel chapter";''')
    web = "apps/wordcraft-web/src/web.rs"
    patch(web, '        studio::dirty(self.app.session.dirty);', '        let ids = js_sys::Array::new();\n        ids.push(&self.app.session.document_id().to_string().into());\n        studio::forget(&ids);\n        studio::dirty(self.app.session.dirty);')
    patch(web, "    let save_ctx = ctx.clone();", "    let save_ctx = ctx.clone();\n    let document_ctx = ctx.clone();\n    let opened: std::sync::Arc<std::sync::Mutex<Vec<(String, Vec<u8>, String)>>> = Default::default();\n    let document_inbox = opened.clone();\n    let save_service = saves.clone();")
    patch(web, "        open_async: Some(Box::new(move |purpose: &str| {", "        studio_opened: Some(opened),\n        studio_bind: Some(Box::new(|id, token| studio::bind(&id.to_string(), token))),\n        studio_discard: Some(Box::new(studio::discard)),\n        studio_save: Some(Box::new(move |id, name, bytes, save_as, copy| {\n            let ticket = save_service.start();\n            let saves = save_service.clone();\n            let ctx = document_ctx.clone();\n            let name = name.to_string();\n            let bytes = bytes.to_vec();\n            wasm_bindgen_futures::spawn_local(async move {\n                let outcome = match studio::save_document(&id.to_string(), &name, &bytes, save_as, copy).await {\n                    Ok(filename) => { saves.filename(ticket, filename); SaveOutcome::Saved },\n                    Err(error) if error == \"CANCELLED\" => SaveOutcome::Cancelled,\n                    Err(error) => SaveOutcome::Failed(error),\n                };\n                saves.finish(ticket, outcome);\n                ctx.request_repaint();\n            });\n            Ok(())\n        })),\n        open_async: Some(Box::new(move |purpose: &str| {")
    patch(web, "            let purpose = purpose.to_string();\n            wasm_bindgen_futures", "            let purpose = purpose.to_string();\n            let opened = document_inbox.clone();\n            if purpose == \"document\" {\n                wasm_bindgen_futures::spawn_local(async move {\n                    match studio::open_document(&purpose).await {\n                        Ok(Some(file)) => opened.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(file),\n                        Ok(None) => {},\n                        Err(error) => log::error!(\"Open failed: {error}\"),\n                    }\n                    ctx.request_repaint();\n                });\n                return;\n            }\n            wasm_bindgen_futures")

elif editor == "gridcraft":
    patch(ui + "lib.rs", 'pub struct Services {', 'pub struct Services {\n    pub studio_bind: Option<Box<dyn Fn(u64, &str)>>,\n    pub studio_discard: Option<Box<dyn Fn(&str)>>,')
    patch(ui + "dialogs.rs", '    if open {\n        app.dialog = Some(d);', '    if !open && d.name == "openPassword" {\n        if let (Some(discard), Some(token)) = (&app.services.studio_discard, d.values.get("studioSource").and_then(Json::as_str)) { discard(token); }\n    }\n    if open {\n        app.dialog = Some(d);')
    patch(ui + "lib.rs", "        let r = self.session.run(id, params);", "        let source = params.get(\"studioSource\").and_then(Json::as_str).map(str::to_string);\n        let previous = self.session.active().map(|doc| doc.uid);\n        let r = self.session.run(id, params);\n        #[cfg(target_arch = \"wasm32\")]\n        if r.is_ok() && id == \"file.open\" {\n            if let (Some(source), Some(doc)) = (source, self.session.active()) {\n                if Some(doc.uid) != previous { if let Some(bind) = &self.services.studio_bind { bind(doc.uid, &source); } }\n            }\n        }\n        #[cfg(not(target_arch = \"wasm32\"))]\n        let _ = (source, previous);")
    patch(ui + "lib.rs", 'return self.save_to_studio(params.get("path").and_then(Json::as_str), params.get("studioClose").and_then(Json::as_bool).unwrap_or(false), params.get("studioCopy").and_then(Json::as_bool).unwrap_or(false));', 'return self.save_to_studio_intent(params.get("path").and_then(Json::as_str), params.get("studioClose").and_then(Json::as_bool).unwrap_or(false), params.get("studioCopy").and_then(Json::as_bool).unwrap_or(false), id == "file.saveAs");')
    patch(ui + "lib.rs", 'if let Err(error) = self.save_to_studio(None, false, false)', 'if let Err(error) = self.save_to_studio_intent(None, false, false, true)')

elif editor == "deckcraft":
    patch("crates/engine/src/recovery.rs", '        h.write_u32(std::process::id());', '        #[cfg(not(target_arch = "wasm32"))]\n        h.write_u32(std::process::id());')
    patch(ui + "lib.rs", '                InboxEvent::Cancelled { id } => self.pending_files.retain(|r| r.id != id),', '                InboxEvent::Cancelled { id } => {\n                    #[cfg(target_arch = "wasm32")]\n                    studio_io::bind_open(id, None);\n                    self.pending_files.retain(|r| r.id != id);\n                },')
    patch(ui + "lib.rs", '        let Some(pos) = self.pending_files.iter().position(|r| r.id == id) else { return };', '        let Some(pos) = self.pending_files.iter().position(|r| r.id == id) else {\n            #[cfg(target_arch = "wasm32")]\n            studio_io::bind_open(id, None);\n            return;\n        };')
    patch(ui + "lib.rs", '            Err(e) => {\n                self.set_status(e);\n                return;\n            }\n        };\n        let mut params', '            Err(e) => {\n                #[cfg(target_arch = "wasm32")]\n                studio_io::bind_open(id, None);\n                self.set_status(e);\n                return;\n            }\n        };\n        let mut params')
    patch(ui + "lib.rs", '        let mut params = if cmd == "slide.fromOutline" {', '        #[cfg(target_arch = "wasm32")]\n        if cmd != "file.openBytes" { studio_io::bind_open(id, None); }\n        let mut params = if cmd == "slide.fromOutline" {')
    patch(ui + "lib.rs", '            studio_io::save(self, format, false);', '            studio_io::save_intent(self, format, false, id != "file.save");')
    patch(ui + "lib.rs", 'pub fn save_as_dialog(&mut self, format: &str) { studio_io::save(self, format, false); }', 'pub fn save_as_dialog(&mut self, format: &str) { studio_io::save_intent(self, format, false, true); }')
    patch(ui + "lib.rs", "        match result {\n            Err(e) if cmd == \"file.openBytes\"", "        #[cfg(target_arch = \"wasm32\")]\n        if cmd == \"file.openBytes\" {\n            if result.is_ok() { if let Some(doc) = self.session.active_mut() { doc.path = Some(name.into()); } }\n            studio_io::bind_open(id, result.is_ok().then(|| self.session.active().map(|doc| doc.uid)).flatten());\n        }\n        match result {\n            Err(e) if cmd == \"file.openBytes\"")

elif editor == "pdfcraft":
    patch(ui + "editing.rs", '            let _ = (path, target);', '            let _ = path;')
    patch(ui + "editing.rs", 'crate::studio_io::start_save(self, index, id, &name, bytes, Box::new(after))', 'crate::studio_io::start_save(self, index, id, &name, bytes, matches!(target, SaveTarget::As), Box::new(after))')
    patch(ui + "lib.rs", 'match crate::studio::open_many("pdf-document").await {', 'match crate::studio::open_documents("pdf-document").await {')
    patch(ui + "lib.rs", 'inbox.lock().unwrap_or_else(std::sync::PoisonError::into_inner).extend(files);', 'opened.lock().unwrap_or_else(std::sync::PoisonError::into_inner).extend(files);')
    patch(ui + "lib.rs", '            let inbox = self.inbox.clone();\n            let failed', '            let opened = self.studio_opened.clone();\n            let failed')
    patch(ui + "lib.rs", '    pub inbox: Inbox,', '    pub inbox: Inbox,\n    pub(crate) studio_opened: std::sync::Arc<std::sync::Mutex<Vec<(String, Vec<u8>, String)>>>,')
    patch(ui + "lib.rs", '            inbox: Default::default(),', '            inbox: Default::default(),\n            studio_opened: Default::default(),')
    patch(ui + "lib.rs", '        let arrived: Vec<(String, Vec<u8>)> = self.inbox.lock()', '        #[cfg(target_arch = "wasm32")]\n        {\n            let opened = std::mem::take(&mut *self.studio_opened.lock().unwrap_or_else(std::sync::PoisonError::into_inner));\n            for (name, bytes, token) in opened {\n                if let Err(error) = self.open_bytes(&name, Some(format!("studio-source:{token}")), bytes) { self.notify_error(error); }\n            }\n        }\n        let arrived: Vec<(String, Vec<u8>)> = self.inbox.lock()')
    patch(ui + "lib.rs", '        let Some(p) = self.password_prompt.take() else { return };\n        let Some(pw) = password else {', '        let Some(p) = self.password_prompt.take() else { return };\n        let Some(pw) = password else {\n            #[cfg(target_arch = "wasm32")]\n            if let Some(token) = p.path.as_deref().and_then(|value| value.strip_prefix("studio-source:")) { crate::studio::discard(token); }')
    patch(ui + "lib.rs", '        if let Some(r) = self.open_converted(name, &bytes) {', '        if let Some(r) = self.open_converted(name, &bytes) {\n            #[cfg(target_arch = "wasm32")]\n            if let Some(token) = path.as_deref().and_then(|value| value.strip_prefix("studio-source:")) { crate::studio::discard(token); }')
    patch(ui + "lib.rs", '            Err(e) => return Err(e.to_string()),\n        };\n        self.finish_open(name, path, bytes.len(), prepared, activate)', '            Err(e) => {\n                #[cfg(target_arch = "wasm32")]\n                if let Some(token) = path.as_deref().and_then(|value| value.strip_prefix("studio-source:")) { crate::studio::discard(token); }\n                return Err(e.to_string());\n            },\n        };\n        self.finish_open(name, path, bytes.len(), prepared, activate)')
    patch(ui + "lib.rs", '        let id = self.session.commit_open(prepared);', '        let id = self.session.commit_open(prepared);\n        #[cfg(target_arch = "wasm32")]\n        if let Some(token) = path.as_deref().and_then(|value| value.strip_prefix("studio-source:")) { crate::studio::bind(&id.0.to_string(), token); }')
else:
    raise ValueError(editor)
import shutil
suite = Path(__file__).resolve().parents[1]
files = {
    "wordcraft": [("studio.rs", "apps/wordcraft-web/src/studio.rs")],
    "gridcraft": [("studio.rs", "apps/gridcraft-web/src/studio.rs"), ("grid-web.rs", "apps/gridcraft-web/src/host.rs"), ("grid-save.rs", ui + "studio_save.rs")],
    "deckcraft": [("studio.rs", ui + "studio.rs"), ("studio.rs", "apps/deckcraft-web/src/web/studio.rs"), ("deck-save.rs", ui + "studio_io.rs")],
    "pdfcraft": [("studio.rs", ui + "studio.rs"), ("pdf-save.rs", ui + "studio_io.rs")],
}
for original, destination in files[editor]:
    shutil.copyfile(suite / "src" / original, source / destination)
if editor == "gridcraft":
    (source / "crates/engine/tests/studio_grid_save.rs").write_text((suite / "src/grid-save.rs").read_text().split("impl crate::SheetApp {")[0])
if editor == "deckcraft":
    path = source / "apps/deckcraft-web/src/web.rs"
    text = path.read_text()
    path.write_text(text[:text.index("fn services(inbox:")] + (suite / "src/deck-web.rs").read_text())
print(f"Prepared {editor} file identity and save intent")
