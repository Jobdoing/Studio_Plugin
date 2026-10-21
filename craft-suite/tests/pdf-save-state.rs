//! Run the production acknowledgement adapter against a controlled session.+//! This checks continuation/state safety, not the browser or PDF engine itself.
#![allow(dead_code)]
extern crate self as pdfcraft_engine;
extern crate self as wasm_bindgen_futures;

use std::sync::Arc;
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct DocId(pub u64);
mod js_sys {
    pub struct Array;
    impl Array { pub fn new() -> Self { Self } pub fn push(&self, _: &String) {} }
}
pub fn spawn_local(_: impl std::future::Future<Output = ()> + 'static) {}

mod studio {
    pub fn forget(_: &crate::js_sys::Array) {}
    pub async fn save_document(_: &str, _: &str, _: &[u8], _: bool, _: bool) -> Result<String, String> { Ok("test.pdf".into()) }
    pub async fn save(_: &str, _: &[u8]) -> Result<(), String> { Ok(()) }
    pub async fn save_many(_: &[(String, std::sync::Arc<Vec<u8>>)]) -> Result<(), String> { Ok(()) }
    pub async fn open(_: &str) -> Result<Option<(String, Vec<u8>)>, String> { Ok(None) }
    pub async fn open_many(_: &str) -> Result<Vec<(String, Vec<u8>)>, String> { Ok(Vec::new()) }
}
mod files { #[derive(Clone, Copy)] pub struct PickTarget; }
struct Context;
impl Clone for Context { fn clone(&self) -> Self { Self } }
impl Context { fn request_repaint(&self) {} }
struct Document { generation: u64, info: () }
impl Document { fn edit_generation(&self) -> u64 { self.generation } }
struct Session { doc: Document, dirty: bool, marks: usize, reject_save: bool, saved_name: Option<String> }
impl Session {
    fn get(&self, id: DocId) -> Option<&Document> { (id == DocId(7)).then_some(&self.doc) }
    fn check_save(&self, _: DocId, _: &Arc<Vec<u8>>) -> Result<(), String> {
        if self.reject_save { Err("INVALID_PDF".into()) } else { Ok(()) }
    }
    fn mark_saved(&mut self, _: DocId, _: Arc<Vec<u8>>, name: Option<String>) -> Result<(), String> {
        self.marks += 1;
        self.dirty = false;
        self.saved_name = name;
        Ok(())
    }
}
struct View { id: DocId }
impl View { fn document_changed(&mut self, _: &()) {} }
struct PdfCraftApp {
    studio_pending_save: Option<adapter::PendingSave>,
    studio_pending_writes: Vec<adapter::PendingWrite>,
    studio_pending_reads: Vec<adapter::PendingRead>,
    session: Session,
    views: Vec<View>,
    ctx: Option<Context>,
    continuations: usize,
    commit_ok: bool,
    typed: bool,
    notifications: Vec<String>,
}
impl PdfCraftApp {
    fn new() -> Self {
        Self {
            studio_pending_save: None, studio_pending_writes: Vec::new(), studio_pending_reads: Vec::new(),
            session: Session { doc: Document { generation: 3, info: () }, dirty: true, marks: 0, reject_save: false, saved_name: None },
            views: vec![View { id: DocId(7) }], ctx: None, continuations: 0, commit_ok: true,
            typed: false, notifications: Vec::new(),
        }
    }
    fn commit_typing_in(&mut self, _: DocId) -> bool {
        if self.typed { self.session.doc.generation += 1; }
        self.commit_ok
    }
    fn has_unsaved_work(&self, _: usize) -> bool { self.session.dirty || self.typed }
    fn still_pick_target(&mut self, _: Option<files::PickTarget>) -> bool { true }
    fn notify_fmt(&mut self, text: &str, _: &[(&str, &str)]) { self.notifications.push(text.into()); }
    fn notify_error(&mut self, text: impl ToString) { self.notifications.push(text.to_string()); }
    fn notify(&mut self, text: impl ToString) { self.notifications.push(text.to_string()); }
}

mod adapter {
    include!(env!("PDF_ADAPTER_SOURCE"));

    #[cfg(test)]
    mod tests {
        use super::*;

        fn saving() -> PdfCraftApp {
            let mut app = PdfCraftApp::new();
            assert!(!start_save(&mut app, 0, DocId(7), "test.pdf", Arc::new(vec![1, 2]), false, Box::new(|app| app.continuations += 1)));
            app
        }
        fn reply(app: &mut PdfCraftApp, outcome: Result<(), String>) {
            *app.studio_pending_save.as_ref().unwrap().result.lock().unwrap() = Some(outcome.map(|()| "renamed.pdf".to_string()));
            poll(app);
        }
        fn unchanged(app: &PdfCraftApp) {
            assert!(app.session.dirty, "unsaved content must remain dirty");
            assert_eq!(app.session.marks, 0, "must not rebase a PDF before a safe acknowledgement");
            assert_eq!(app.continuations, 0, "must not close or delete after an unsafe save");
            assert!(app.session.saved_name.is_none(), "must not change file identity without safe acknowledgement");
        }
        #[test] fn pending_upload_keeps_work() { let mut app = saving(); poll(&mut app); unchanged(&app); assert!(app.studio_pending_save.is_some()); }
        #[test] fn rejected_upload_keeps_work() { let mut app = saving(); reply(&mut app, Err("ACCESS_DENIED".into())); unchanged(&app); assert!(!app.notifications.is_empty()); }
        #[test] fn cancelled_upload_keeps_work() { let mut app = saving(); reply(&mut app, Err("CANCELLED".into())); unchanged(&app); assert!(app.notifications.is_empty()); }
        #[test] fn acknowledged_snapshot_can_close() {
            let mut app = saving(); reply(&mut app, Ok(()));
            assert!(!app.session.dirty); assert_eq!(app.session.marks, 1); assert_eq!(app.continuations, 1);
            assert_eq!(app.session.saved_name.as_deref(), Some("renamed.pdf"));
            poll(&mut app); assert_eq!(app.continuations, 1, "a reply must only run once");
        }
        #[test] fn newer_edit_is_not_rebased() { let mut app = saving(); app.session.doc.generation += 1; reply(&mut app, Ok(())); unchanged(&app); }
        #[test] fn another_tab_is_not_closed() { let mut app = saving(); app.views[0].id = DocId(8); reply(&mut app, Ok(())); unchanged(&app); }
        #[test] fn moved_document_is_still_saved_by_identity() {
            let mut app = saving(); app.views.insert(0, crate::View { id: DocId(8) }); reply(&mut app, Ok(()));
            assert!(!app.session.dirty); assert_eq!(app.continuations, 1);
        }
        #[test] fn closed_tab_is_not_rebased() { let mut app = saving(); app.views.clear(); reply(&mut app, Ok(())); unchanged(&app); }
        #[test] fn later_typing_is_not_discarded() { let mut app = saving(); app.typed = true; reply(&mut app, Ok(())); unchanged(&app); }
        #[test] fn blocked_typing_does_not_close() { let mut app = saving(); app.commit_ok = false; reply(&mut app, Ok(())); unchanged(&app); }
        #[test] fn invalid_serialization_never_starts_upload() {
            let mut app = PdfCraftApp::new(); app.session.reject_save = true;
            assert!(!start_save(&mut app, 0, DocId(7), "test.pdf", Arc::new(Vec::new()), false, Box::new(|app| app.continuations += 1)));
            assert!(app.studio_pending_save.is_none()); unchanged(&app);
        }
        #[test] fn batch_failure_never_deletes_pages() {
            for error in ["CANCELLED", "ACCESS_DENIED", "Uploaded 1 of 2 files"] {
                let mut app = PdfCraftApp::new();
                write(&mut app, vec![("page.pdf".into(), Arc::new(vec![1]))], |app| app.continuations += 1);
                poll(&mut app); unchanged(&app);
                *app.studio_pending_writes[0].result.lock().unwrap() = Some(Err(error.into()));
                poll(&mut app); unchanged(&app);
            }
        }
        #[test] fn complete_batch_can_continue_without_marking_source_saved() {
            let mut app = PdfCraftApp::new();
            write(&mut app, vec![("page.pdf".into(), Arc::new(vec![1]))], |app| app.continuations += 1);
            *app.studio_pending_writes[0].result.lock().unwrap() = Some(Ok(()));
            poll(&mut app); assert_eq!(app.continuations, 1); assert!(app.session.dirty); assert_eq!(app.session.marks, 0);
        }
    }
}
