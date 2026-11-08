//! Studio saves stop at serialization until storage acknowledges the same drawing revision.
use std::cell::RefCell;
use std::collections::HashSet;
use std::sync::Arc;
use crate::{Drawing, Session};

pub struct Request {
    pub uid: u64,
    pub revision: u64,
    pub snapshot: Arc<Drawing>,
    pub name: String,
    pub bytes: Vec<u8>,
    pub save_as: bool,
    pub copy: bool,
    pub binary: bool,
}

#[derive(Default)]
struct State {
    enabled: bool,
    pending: HashSet<u64>,
    requests: Vec<Request>,
    finished: Vec<(Request, Result<String, String>)>,
}

thread_local! { static STATE: RefCell<State> = RefCell::default(); }

pub fn set_enabled(enabled: bool) { STATE.with_borrow_mut(|state| { assert!(state.pending.is_empty()); state.enabled = enabled; }); }
pub fn enabled() -> bool { STATE.with_borrow(|state| state.enabled) }
pub fn pending(uid: u64) -> bool { STATE.with_borrow(|state| state.pending.contains(&uid)) }
pub fn busy() -> bool { STATE.with_borrow(|state| !state.pending.is_empty()) }

pub fn queue(session: &Session, name: &str, bytes: Vec<u8>, save_as: bool, binary: bool, copy: bool) -> Result<(), String> {
    let doc = session.state().map_err(|error| error.to_string())?;
    STATE.with_borrow_mut(|state| {
        if !state.pending.insert(doc.uid) { return Err("A save is already awaiting confirmation".into()); }
        state.requests.push(Request {
            uid: doc.uid, revision: doc.revision, snapshot: doc.drawing().clone(),
            name: name.into(), bytes, save_as, binary, copy,
        });
        Ok(())
    })
}

pub fn take_requests() -> Vec<Request> { STATE.with_borrow_mut(|state| std::mem::take(&mut state.requests)) }
pub fn finish(request: Request, result: Result<String, String>) {
    STATE.with_borrow_mut(|state| state.finished.push((request, result)));
}
pub fn take_finished() -> Vec<(Request, Result<String, String>)> {
    STATE.with_borrow_mut(|state| std::mem::take(&mut state.finished))
}

/// An older receipt never cleans later edits, renames another drawing, or authorizes its close.
pub fn settle(session: &mut Session, request: &Request, result: &Result<String, String>) -> bool {
    STATE.with_borrow_mut(|state| { state.pending.remove(&request.uid); });
    let Ok(name) = result else { return false };
    if request.copy || name.is_empty() { return false; }
    let Some(doc) = session.docs.iter_mut().find(|doc| doc.uid == request.uid) else { return false };
    doc.path = Some(name.clone());
    doc.title = std::path::Path::new(name).file_name().map_or_else(|| name.clone(), |value| value.to_string_lossy().into_owned());
    if doc.revision != request.revision || !Arc::ptr_eq(doc.drawing(), &request.snapshot) { return false; }
    doc.saved = request.snapshot.clone();
    doc.binary_dxf = request.binary;
    doc.end_undo_group();
    !doc.is_dirty()
}
