use super::*;
use std::sync::{Arc, Mutex};

fn app() -> SheetApp {
    let mut app = SheetApp::new(Session::new(), Services::default());
    app.services.studio_saves = Some(studio_save::AsyncSaves::default());
    app.run("file.new", json!({})).unwrap();
    app.run("cell.set", json!({"cell": "A1", "input": "17"})).unwrap();
    app
}

#[test]
fn studio_ui_close_waits_for_ack_and_preserves_later_edits() {
    for outcome in [Ok(()), Err("CANCELLED".into()), Err("Permission denied".into())] {
        let mut app = app();
        let original = app.session.active().unwrap().uid;
        let saves = app.services.studio_saves.clone().unwrap();
        app.run("file.close", json!({})).unwrap();
        assert_eq!(app.dialog.as_ref().unwrap().name(), "saveChanges");
        app.answer_save_changes(SaveAnswer::Save, false, &egui::Context::default());
        assert!(app.session.active().unwrap().is_dirty());
        let ticket = saves.take_requests().remove(0);
        assert!(ticket.close);
        app.run("cell.set", json!({"cell": "A1", "input": "29"})).unwrap();
        saves.finish(ticket, outcome);
        app.logic(&egui::Context::default());
        let doc = app.session.documents().iter().find(|d| d.uid == original).unwrap();
        assert!(doc.is_dirty());
        assert_eq!(doc.wb.active().unwrap().value(cell(0, 0)).display(), "29");
    }
}

#[test]
fn studio_ui_save_as_commits_draft_and_autosave_cannot_bypass_ack() {
    let mut app = app();
    let saves = app.services.studio_saves.clone().unwrap();
    app.session.active_mut().unwrap().path = Some("Budget.xlsx".into());
    app.ui.autosave = true;
    app.logic(&egui::Context::default());
    assert!(app.session.active().unwrap().is_dirty());
    assert!(saves.take_requests().is_empty());
    app.begin_edit(Some("31".into()), false);
    app.run("file.saveAs", json!({})).unwrap();
    let ticket = saves.take_requests().remove(0);
    assert!(ticket.save_as);
    assert_eq!(ticket.snapshot.active().unwrap().value(cell(0, 0)).display(), "31");
    assert!(app.session.active().unwrap().is_dirty());
    saves.finish(ticket, Ok(()));
    app.logic(&egui::Context::default());
    assert!(!app.session.active().unwrap().is_dirty());
}

#[test]
fn studio_new_and_open_keep_dirty_workbooks_and_bind_only_successful_open() {
    let mut app = app();
    let original = app.session.active().unwrap().uid;
    let bound = Arc::new(Mutex::new(Vec::new()));
    let observed = bound.clone();
    app.services.studio_bind = Some(Box::new(move |id, token| observed.lock().unwrap().push((id, token.to_owned()))));
    app.run("file.new", json!({})).unwrap();
    let bytes = gridcraft_engine::io::save_bytes(&app.session.active().unwrap().wb, "Input.xlsx").unwrap();
    app.run("file.open", json!({"name": "Input.xlsx", "base64": gridcraft_engine::io::base64_encode(&bytes), "studioSource": "source-1"})).unwrap();
    assert_eq!(*bound.lock().unwrap(), vec![(app.session.active().unwrap().uid, "source-1".into())]);
    assert!(app.session.documents().iter().find(|d| d.uid == original).unwrap().is_dirty());
    assert!(app.run("file.open", json!({"name": "Broken.xlsx", "base64": "!", "studioSource": "source-2"})).is_err());
    assert_eq!(bound.lock().unwrap().len(), 1);
}

#[test]
fn studio_password_cancel_discards_pending_source() {
    let mut app = app();
    let discarded = Arc::new(Mutex::new(Vec::new()));
    let observed = discarded.clone();
    app.services.studio_discard = Some(Box::new(move |token| observed.lock().unwrap().push(token.to_owned())));
    app.open_dialog("openPassword", json!({"name": "Locked.xlsx", "base64": "", "studioSource": "pending-source"}));
    let control::Outcome::Done(result) = control::handle(&mut app, &egui::Context::default(), "ui.dialog.cancel", &json!({})) else { panic!("expected dialog result") };
    assert_eq!(result["ok"], true);
    assert!(app.dialog.is_none());
    assert_eq!(*discarded.lock().unwrap(), vec!["pending-source"]);
}
