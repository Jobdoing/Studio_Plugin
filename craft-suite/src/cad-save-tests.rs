use crate::{CadApp, Services, closing::Choice};
use cadcraft_engine::{Session, studio_save};
use serde_json::json;

struct Studio;
impl Drop for Studio {
    fn drop(&mut self) { studio_save::set_enabled(false); }
}

fn app() -> (CadApp, Studio) {
    studio_save::set_enabled(true);
    let mut app = CadApp::new(Session::new(), Services::default());
    edit(&mut app);
    (app, Studio)
}

fn edit(app: &mut CadApp) {
    app.session.execute("circle", &json!({"center": [0, 0], "radius": 2})).unwrap();
}

fn queued(app: &CadApp, copy: bool) -> studio_save::Request {
    studio_save::queue(&app.session, "Drawing.dxf", Vec::new(), true, false, copy).unwrap();
    studio_save::take_requests().pop().unwrap()
}

#[test]
fn receipt_cleans_only_the_serialized_revision() {
    let (mut app, _studio) = app();
    let request = queued(&app, false);
    assert!(app.session.state().unwrap().is_dirty());
    assert!(studio_save::pending(request.uid));
    assert!(studio_save::settle(&mut app.session, &request, &Ok("Confirmed.dxf".into())));
    let doc = app.session.state().unwrap();
    assert!(!doc.is_dirty());
    assert_eq!(doc.path.as_deref(), Some("Confirmed.dxf"));
    assert!(!studio_save::busy());
}

#[test]
fn later_edits_and_revision_changes_remain_unsaved() {
    for edit_drawing in [true, false] {
        let (mut app, _studio) = app();
        let request = queued(&app, false);
        if edit_drawing { edit(&mut app); }
        else { app.session.state_mut().unwrap().revision += 1; }
        assert!(!studio_save::settle(&mut app.session, &request, &Ok("Earlier.dxf".into())));
        assert!(app.session.state().unwrap().is_dirty());
    }
}

#[test]
fn failed_cancelled_or_unconfirmed_receipts_do_not_rename_or_clean() {
    for result in [Err("CANCELLED".into()), Err("Permission denied".into()), Err("SAVE_NOT_CONFIRMED".into()), Ok(String::new())] {
        let (mut app, _studio) = app();
        let request = queued(&app, false);
        assert!(!studio_save::settle(&mut app.session, &request, &result));
        let doc = app.session.state().unwrap();
        assert!(doc.is_dirty());
        assert!(doc.path.is_none());
        assert!(!studio_save::busy());
    }
}

#[test]
fn receipt_targets_original_document_and_ignores_closed_document() {
    for close in [false, true] {
        let (mut app, _studio) = app();
        let request = queued(&app, false);
        app.session.new_drawing(false);
        edit(&mut app);
        let current = app.session.state().unwrap().uid;
        if close { app.session.docs.remove(0); app.session.active = 0; }
        assert_eq!(studio_save::settle(&mut app.session, &request, &Ok("Original.dxf".into())), !close);
        let doc = app.session.state().unwrap();
        assert_eq!(doc.uid, current);
        assert!(doc.is_dirty());
        assert!(doc.path.is_none());
    }
}

#[test]
fn exports_keep_the_source_dirty_and_bound_to_its_original_name() {
    let (mut app, _studio) = app();
    let request = queued(&app, true);
    assert!(!studio_save::settle(&mut app.session, &request, &Ok("Export.svg".into())));
    assert!(app.session.state().unwrap().is_dirty());
    assert!(app.session.state().unwrap().path.is_none());
}

#[test]
fn pending_close_waits_for_receipt_and_stops_on_error_or_new_edits() {
    for outcome in ["saved", "CANCELLED", "Permission denied", "edited", "cancel-close"] {
        let (mut app, _studio) = app();
        let request = queued(&app, false);
        app.request_close(None);
        app.answer_close(Choice::Save);
        assert_eq!(app.session.docs.len(), 1);
        assert!(app.close_prompt().is_some());
        if outcome == "edited" { edit(&mut app); }
        if outcome == "cancel-close" { app.answer_close(Choice::Cancel); }
        let result = if matches!(outcome, "CANCELLED" | "Permission denied") { Err(outcome.into()) } else { Ok("Confirmed.dxf".into()) };
        studio_save::finish(request, result);
        app.settle_studio_saves();
        assert_eq!(app.session.docs.is_empty(), outcome == "saved");
        if matches!(outcome, "edited" | "CANCELLED" | "Permission denied") {
            assert!(app.session.state().unwrap().is_dirty());
        }
    }
}

#[test]
fn duplicate_save_cannot_replace_the_pending_snapshot() {
    let (mut app, _studio) = app();
    let request = queued(&app, false);
    edit(&mut app);
    assert!(studio_save::queue(&app.session, "Other.dxf", Vec::new(), false, false, false).is_err());
    assert!(!studio_save::settle(&mut app.session, &request, &Ok("First.dxf".into())));
    assert!(app.session.state().unwrap().is_dirty());
}

#[test]
fn traditional_chinese_uses_upstream_catalog_and_pinned_font() {
    assert_eq!(crate::i18n::Preference::parse("zh-hant"), Some(crate::i18n::Preference::TraditionalChinese));
    assert_eq!(crate::i18n::locale_language("zh-TW"), Some("zh-hant"));
    assert_eq!(crate::i18n::tr("zh-hant", "Polyline"), "聚合線");
    assert_eq!(crate::i18n::tr("zh-hant", "Block"), "圖塊");
    assert!(cadcraft_fonts::CRAFT_FONTS.iter().any(|font| font.family == "Noto Sans CJK TC"));
}
