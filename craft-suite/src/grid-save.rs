//! A save owns the document identity and immutable model that produced its bytes.
use std::sync::{Arc, Mutex};

use gridcraft_engine::{DocState, Session, io::FileKind, model::Workbook};

#[derive(Clone)]
pub struct Ticket {
    pub uid: u64,
    pub snapshot: Arc<Workbook>,
    pub name: String,
    pub bytes: Vec<u8>,
    pub close: bool,
    pub full_fidelity: bool,
    pub save_as: bool,
}

fn extension(name: &str) -> String {
    std::path::Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn default_save_name(doc: &DocState) -> String {
    let title = doc.display_title();
    let kind = FileKind::from_path(&title);
    let keeps_vba = doc.wb.vba_project.is_none()
        || kind == Some(FileKind::Json)
        || matches!(extension(&title).as_str(), "xlsm" | "xltm");
    if matches!(kind, Some(FileKind::Xlsx | FileKind::Json)) && keeps_vba {
        return title;
    }
    let stem = std::path::Path::new(&title)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Book");
    let ext = if doc.wb.vba_project.is_some() {
        "xlsm"
    } else {
        "xlsx"
    };
    format!("{stem}.{ext}")
}

impl Ticket {
    fn for_document(
        doc: &DocState,
        name: Option<&str>,
        close: bool,
        copy: bool,
    ) -> Result<Self, String> {
        let name = name
            .map(str::to_string)
            .unwrap_or_else(|| default_save_name(doc));
        let kind = FileKind::from_path(&name);
        let keeps_vba = doc.wb.vba_project.is_none()
            || kind == Some(FileKind::Json)
            || matches!(extension(&name).as_str(), "xlsm" | "xltm");
        if !copy && kind == Some(FileKind::Xlsx) && !keeps_vba {
            return Err(
                "This workbook contains VBA. Save as .xlsm, .xltm or .json to preserve its macros."
                    .into(),
            );
        }
        Ok(Self {
            uid: doc.uid,
            snapshot: doc.wb.clone(),
            bytes: gridcraft_engine::io::save_bytes(&doc.wb, &name)
                .map_err(|error| error.to_string())?,
            name,
            close,
            save_as: copy,
            full_fidelity: !copy
                && matches!(kind, Some(FileKind::Xlsx | FileKind::Json))
                && keeps_vba,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(session: &mut Session, close: bool) -> Ticket {
        session.new_workbook();
        let changed = session.run("cell.set", serde_json::json!({"cell": "A1", "input": "17"}));
        assert!(changed.is_ok());
        let doc = session.active().unwrap();
        Ticket::for_document(doc, Some("Budget.xlsx"), close, false).unwrap()
    }

    #[test]
    fn rejected_or_cancelled_save_keeps_dirty_and_document_open() {
        for error in ["CANCELLED", "Permission denied"] {
            let mut session = Session::new();
            let ticket = request(&mut session, true);
            let saves = AsyncSaves::default();
            saves.start(ticket).unwrap();
            let pending = saves.take_requests().remove(0);
            saves.finish(pending, Err(error.into()));
            saves.poll(&mut session);
            assert_eq!(session.documents().len(), 1);
            assert!(session.active().unwrap().is_dirty());
        }
    }

    #[test]
    fn acknowledgement_updates_original_document_when_active_changes() {
        let mut session = Session::new();
        let ticket = request(&mut session, false);
        let uid = ticket.uid;
        session.new_workbook();
        let other_uid = session.active().unwrap().uid;
        let saves = AsyncSaves::default();
        saves.start(ticket).unwrap();
        let pending = saves.take_requests().remove(0);
        saves.finish(pending, Ok(()));
        saves.poll(&mut session);
        assert_eq!(session.active().unwrap().uid, other_uid);
        let original = session
            .documents()
            .iter()
            .find(|doc| doc.uid == uid)
            .unwrap();
        assert!(!original.is_dirty());
        assert_eq!(original.title, "Budget.xlsx");
    }

    #[test]
    fn later_edit_remains_dirty_and_blocks_pending_close() {
        let mut session = Session::new();
        let ticket = request(&mut session, true);
        let saves = AsyncSaves::default();
        saves.start(ticket).unwrap();
        assert!(
            session
                .run("cell.set", serde_json::json!({"cell": "A1", "input": "29"}))
                .is_ok()
        );
        let pending = saves.take_requests().remove(0);
        saves.finish(pending, Ok(()));
        saves.poll(&mut session);
        assert_eq!(session.documents().len(), 1);
        assert!(session.active().unwrap().is_dirty());
    }

    #[test]
    fn acknowledged_copy_preserves_source_dirty_state() {
        let mut session = Session::new();
        let _ = request(&mut session, true);
        let ticket =
            Ticket::for_document(session.active().unwrap(), Some("Copy.xlsx"), true, true).unwrap();
        let saves = AsyncSaves::default();
        saves.start(ticket).unwrap();
        let pending = saves.take_requests().remove(0);
        saves.finish(pending, Ok(()));
        saves.poll(&mut session);
        assert!(session.active().unwrap().is_dirty());
        assert_eq!(session.documents().len(), 1);
    }

    #[test]
    fn successful_save_closes_only_unchanged_original_document() {
        let mut session = Session::new();
        let ticket = request(&mut session, true);
        session.new_workbook();
        let remaining_uid = session.active().unwrap().uid;
        session.new_workbook();
        session.set_active(1);
        let saves = AsyncSaves::default();
        saves.start(ticket).unwrap();
        let pending = saves.take_requests().remove(0);
        saves.finish(pending, Ok(()));
        saves.poll(&mut session);
        assert_eq!(session.documents().len(), 2);
        assert_eq!(session.active().unwrap().uid, remaining_uid);
    }

    #[test]
    fn opened_macro_workbook_keeps_its_format_and_vba_after_acknowledgement() {
        let sentinel = b"Studio VBA sentinel: preserve every byte\0\xff";
        for name in ["Budget.xlsm", "Template.xltm", "Model.json"] {
            let mut original = Workbook::new();
            original
                .sheets
                .push(Arc::new(gridcraft_engine::model::Sheet::new("Data")));
            original.vba_project = Some(sentinel.to_vec());
            let input = gridcraft_engine::io::save_bytes(&original, name).unwrap();
            let mut session = Session::new();
            session.run("file.open", serde_json::json!({"name": name, "base64": gridcraft_engine::io::base64_encode(&input)})).unwrap();
            assert!(session.active().unwrap().path.is_none());
            session
                .run("cell.set", serde_json::json!({"cell": "A1", "input": "29"}))
                .unwrap();
            let ticket =
                Ticket::for_document(session.active().unwrap(), None, false, false).unwrap();
            assert_eq!(ticket.name, name);
            let (reopened, _) =
                gridcraft_engine::io::open_bytes(&ticket.name, &ticket.bytes).unwrap();
            assert_eq!(reopened.vba_project.as_deref(), Some(sentinel.as_slice()));
            assert_eq!(
                reopened
                    .active()
                    .unwrap()
                    .value(gridcraft_engine::core::CellRef::new(0, 0))
                    .display(),
                "29"
            );
            let saves = AsyncSaves::default();
            saves.start(ticket).unwrap();
            assert!(session.active().unwrap().is_dirty());
            let pending = saves.take_requests().remove(0);
            saves.finish(pending, Ok(()));
            saves.poll(&mut session);
            assert!(!session.active().unwrap().is_dirty());
            assert_eq!(session.active().unwrap().path.as_deref(), Some(name));
        }
    }

    #[test]
    fn macro_free_save_is_rejected_but_explicit_copy_never_cleans_or_closes_source() {
        let mut session = Session::new();
        let _ = request(&mut session, true);
        Arc::make_mut(&mut session.active_mut().unwrap().wb).vba_project =
            Some(b"VBA source sentinel".to_vec());
        let doc = session.active().unwrap();
        assert!(Ticket::for_document(doc, Some("Lossy.xlsx"), true, false).is_err());
        let ticket = Ticket::for_document(doc, Some("Copy.xlsx"), true, true).unwrap();
        let (copy, _) = gridcraft_engine::io::open_bytes(&ticket.name, &ticket.bytes).unwrap();
        assert!(copy.vba_project.is_none());
        let saves = AsyncSaves::default();
        saves.start(ticket).unwrap();
        let pending = saves.take_requests().remove(0);
        saves.finish(pending, Ok(()));
        saves.poll(&mut session);
        assert_eq!(session.documents().len(), 1);
        assert!(session.active().unwrap().is_dirty());
        assert_eq!(
            session.active().unwrap().wb.vba_project.as_deref(),
            Some(b"VBA source sentinel".as_slice())
        );
    }
}

#[derive(Default)]
struct State {
    pending: bool,
    requests: Vec<Ticket>,
    outcomes: Vec<(Ticket, Result<(), String>)>,
}

#[derive(Clone, Default)]
pub struct AsyncSaves(Arc<Mutex<State>>);

impl AsyncSaves {
    pub fn start(&self, ticket: Ticket) -> Result<(), String> {
        let mut state = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if state.pending {
            return Err("A document-center save is already pending.".into());
        }
        state.pending = true;
        state.requests.push(ticket);
        Ok(())
    }

    pub fn take_requests(&self) -> Vec<Ticket> {
        std::mem::take(
            &mut self
                .0
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .requests,
        )
    }

    pub fn finish(&self, ticket: Ticket, outcome: Result<(), String>) {
        self.0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .outcomes
            .push((ticket, outcome));
    }

    pub fn poll(&self, session: &mut Session) -> Vec<String> {
        let outcomes = {
            let mut state = self
                .0
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            let outcomes = std::mem::take(&mut state.outcomes);
            if !outcomes.is_empty() {
                state.pending = false;
            }
            outcomes
        };
        let mut errors = Vec::new();
        for (ticket, outcome) in outcomes {
            if let Err(error) = outcome {
                if error != "CANCELLED" {
                    errors.push(error);
                }
                continue;
            }
            if !ticket.full_fidelity {
                continue;
            }
            let Some(index) = session
                .documents()
                .iter()
                .position(|doc| doc.uid == ticket.uid)
            else {
                continue;
            };
            let active_uid = session.active().map(|doc| doc.uid);
            session.set_active(index);
            let close = if let Some(doc) = session.active_mut() {
                doc.saved = ticket.snapshot;
                doc.path = Some(ticket.name.clone());
                doc.title = ticket.name;
                ticket.close && !doc.is_dirty()
            } else {
                false
            };
            if close {
                session.close_document(index);
            }
            if let Some(active) = session
                .documents()
                .iter()
                .position(|doc| Some(doc.uid) == active_uid)
            {
                session.set_active(active);
            }
        }
        errors
    }
}

impl crate::SheetApp {
    pub fn save_to_studio(
        &mut self,
        name: Option<&str>,
        close: bool,
        copy: bool,
    ) -> Result<serde_json::Value, String> {
        self.save_to_studio_intent(name, close, copy, false)
    }

    pub fn save_to_studio_intent(
        &mut self, name: Option<&str>, close: bool, copy: bool, save_as: bool,
    ) -> Result<serde_json::Value, String> {
        if !self.commit_edit(0, 0, false, false) {
            return Err("The current cell could not be committed.".into());
        }
        self.store_view_state();
        let doc = self.session.active().ok_or("No workbook is open.")?;
        if name.is_some_and(|name| extension(name) == "pdf") {
            return self.run("file.exportPdf", serde_json::json!({}));
        }
        let mut ticket = Ticket::for_document(doc, name, close, copy)?;
        ticket.save_as = save_as || copy;
        self.services
            .studio_saves
            .as_ref()
            .ok_or("No document-center save service.")?
            .start(ticket)?;
        Ok(serde_json::json!({"pending": true}))
    }
}
