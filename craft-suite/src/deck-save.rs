use std::{cell::RefCell, collections::VecDeque, sync::Arc};
use deckcraft_model::Presentation;
use crate::SlideApp;

struct Job {
    name: String,
    bytes: Vec<u8>,
    files: Option<Vec<(String, Arc<Vec<u8>>)>>,
    source: Option<(u64, Arc<Presentation>, bool)>,
    save_as: bool,
}

thread_local! {
    static QUEUE: RefCell<VecDeque<Job>> = RefCell::default();
    static ACTIVE: RefCell<bool> = const { RefCell::new(false) };
    static RESULTS: RefCell<Vec<(Job, Result<String, String>)>> = RefCell::default();
    static ALBUM_REQUEST: RefCell<u64> = const { RefCell::new(0) };
    static ALBUM_RESULTS: RefCell<Vec<(u64, Result<Option<(String, Vec<u8>)>, String>)>> = RefCell::default();
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    static OPEN_SOURCES: RefCell<std::collections::HashMap<u64, String>> = RefCell::default();
}

#[cfg(target_arch = "wasm32")]
pub fn remember_open(request: u64, token: String) { OPEN_SOURCES.with_borrow_mut(|sources| { sources.insert(request, token); }); }

#[cfg(target_arch = "wasm32")]
pub fn bind_open(request: u64, uid: Option<u64>) {
    if let Some(token) = OPEN_SOURCES.with_borrow_mut(|sources| sources.remove(&request)) {
        if let Some(uid) = uid { crate::studio::bind(&uid.to_string(), &token); }
        else { crate::studio::discard(&token); }
    }
}

#[cfg(target_arch = "wasm32")]
pub fn pick_album(dialog: &mut crate::dialogs::Dialog, ctx: &egui::Context) {
    let id = ALBUM_REQUEST.with_borrow_mut(|id| { *id += 1; *id });
    dialog.fields.insert("studioAlbumRequest".into(), id.to_string());
    let ctx = ctx.clone();
    wasm_bindgen_futures::spawn_local(async move {
        let result = crate::studio::open("picture").await;
        ALBUM_RESULTS.with_borrow_mut(|results| results.push((id, result)));
        ctx.request_repaint();
    });
}

pub fn poll_album(app: &mut SlideApp, dialog: &mut crate::dialogs::Dialog) {
    for (id, result) in ALBUM_RESULTS.with_borrow_mut(std::mem::take) {
        if dialog.fields.get("studioAlbumRequest") != Some(&id.to_string()) { continue; }
        match result {
            Ok(Some((name, bytes))) if !bytes.is_empty() && bytes.len() <= 32 * 1024 * 1024 => {
                let mut items: Vec<serde_json::Value> = match serde_json::from_str(dialog.fields.get("items").map(String::as_str).unwrap_or("[]")) {
                    Ok(items) => items,
                    Err(_) => { app.set_status("The picture list is invalid"); continue; }
                };
                if items.len() >= 48 { app.set_status("A photo album holds at most 48 pictures or text boxes"); continue; }
                items.push(serde_json::json!({"name": name, "data": deckcraft_engine::cmd::base64_encode(&bytes)}));
                if let Ok(value) = serde_json::to_string(&items) { dialog.fields.insert("items".into(), value); }
                dialog.fields.insert("sel".into(), (items.len() - 1).to_string());
            }
            Ok(Some(_)) => app.set_status("The picture is empty or larger than 32 MB"),
            Ok(None) => {},
            Err(e) => app.set_status(format!("Document-center open failed: {e}")),
        }
    }
}

pub fn export(name: &str, bytes: &[u8]) {
    QUEUE.with_borrow_mut(|q| q.push_back(Job { name: name.into(), bytes: bytes.into(), files: None, source: None, save_as: true }));
}

pub fn export_many(files: Vec<(String, Vec<u8>)>) {
    let count = files.len();
    let files = files.into_iter().map(|(name, bytes)| (name, Arc::new(bytes))).collect();
    QUEUE.with_borrow_mut(|q| q.push_back(Job { name: format!("{count} slide images"), bytes: Vec::new(), files: Some(files), source: None, save_as: true }));
}

pub fn save(app: &mut SlideApp, format: &str, close: bool) {
    save_intent(app, format, close, false);
}

pub fn save_intent(app: &mut SlideApp, format: &str, close: bool, save_as: bool) {
    let Some(d) = app.session.active() else { return };
    let original_pptx = d.path.as_ref().is_some_and(|path| path.to_ascii_lowercase().ends_with(".pptx"));
    let ext = if format == "pptx" || (!save_as && original_pptx) { "pptx" } else { "deckcraft" };
    let name = format!("{}.{}", d.title(), ext);
    match deckcraft_engine::cmd::file::save_bytes(&d.doc, ext) {
        Ok(bytes) => {
            let job = Job { name, bytes, files: None, source: Some((d.uid, d.doc.clone(), close)), save_as };
            QUEUE.with_borrow_mut(|q| q.push_back(job));
            app.set_status("Waiting for document-center save confirmation");
        }
        Err(e) => app.set_status(e.to_string()),
    }
}

pub fn save_all(app: &mut SlideApp) -> bool {
    let active = app.session.active().map(|d| d.uid);
    let dirty: Vec<usize> = app.session.documents().iter().enumerate().filter(|(_, d)| d.is_dirty()).map(|(i, _)| i).collect();
    if dirty.is_empty() { return true; }
    for index in dirty {
        app.session.set_active(index);
        save(app, "deckcraft", false);
    }
    if let Some(index) = active.and_then(|uid| app.session.documents().iter().position(|d| d.uid == uid)) {
        app.session.set_active(index);
    }
    // NOTE(ceiling): Web quit queues uploads without automatic exit; close the Studio plugin after saving completes.
    false
}

#[cfg(target_arch = "wasm32")]
pub fn poll(app: &mut SlideApp, ctx: &egui::Context) {
    let ids = js_sys::Array::new();
    for doc in app.session.documents() { ids.push(&doc.uid.to_string().into()); }
    crate::studio::forget(&ids);
    if app.dialog.as_ref().is_none_or(|d| d.id != "photoAlbum") {
        ALBUM_RESULTS.with_borrow_mut(Vec::clear);
    }
    for (job, result) in RESULTS.with_borrow_mut(std::mem::take) {
        match result {
            Ok(name) => {
                let mut newer_edits = false;
                if let Some((uid, snapshot, close)) = job.source {
                    deckcraft_engine::studio_save_state::acknowledge(&mut app.session, uid, snapshot, close, &name);
                    newer_edits = app.session.documents().iter().any(|d| d.uid == uid && d.is_dirty());
                }
                app.set_status(if newer_edits {
                    format!("Saved {name}; newer changes remain unsaved")
                } else { format!("Saved {name} to the document center") });
            }
            Err(e) => app.set_status(format!("Document-center save was not confirmed: {e}")),
        }
    }
    if !ACTIVE.with_borrow(|a| *a) {
        if let Some(job) = QUEUE.with_borrow_mut(|q| q.pop_front()) {
            ACTIVE.with_borrow_mut(|a| *a = true);
            let ctx = ctx.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let result = match job.files.as_ref() {
                    Some(files) => crate::studio::save_many(files).await.map(|()| job.name.clone()),
                    None => match job.source.as_ref() {
                        Some((uid, _, _)) => crate::studio::save_document(&uid.to_string(), &job.name, &job.bytes, job.save_as, false).await,
                        None => crate::studio::save_named(&job.name, &job.bytes).await,
                    },
                };
                RESULTS.with_borrow_mut(|q| q.push((job, result)));
                ACTIVE.with_borrow_mut(|a| *a = false);
                ctx.request_repaint();
            });
        }
    }
    crate::studio::dirty(app.session.documents().iter().any(|d| d.is_dirty()));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn studio_save_all_queues_every_snapshot_and_keeps_active_document() {
        QUEUE.with_borrow_mut(VecDeque::clear);
        let mut app = SlideApp::new(deckcraft_engine::Session::with_new(), crate::Services::default());
        app.session.execute("slide.new", &serde_json::json!({})).unwrap();
        app.session.execute("file.new", &serde_json::json!({})).unwrap();
        app.session.execute("slide.new", &serde_json::json!({})).unwrap();
        app.session.set_active(0);
        let active = app.session.active().unwrap().uid;
        let snapshots: Vec<_> = app.session.documents().iter().map(|d| (d.uid, d.doc.clone())).collect();
        assert!(!save_all(&mut app));
        assert_eq!(app.session.active().unwrap().uid, active);
        QUEUE.with_borrow(|queue| {
            assert_eq!(queue.len(), 2);
            for (job, (uid, snapshot)) in queue.iter().zip(snapshots.iter()) {
                let (queued_uid, queued_snapshot, close) = job.source.as_ref().unwrap();
                assert_eq!(queued_uid, uid);
                assert!(Arc::ptr_eq(queued_snapshot, snapshot));
                assert!(!close);
                assert!(!job.bytes.is_empty());
            }
        });
        assert!(app.session.documents().iter().all(|d| d.is_dirty()));
        QUEUE.with_borrow_mut(VecDeque::clear);
    }
}
