//! Actual engine checks for asynchronous Studio picture fills.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use super::*;

fn picture() -> Vec<u8> {
    let hex = "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c63f8cfc0000003010100c9fe92ef0000000049454e44ae426082";
    (0..hex.len()).step_by(2).map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap()).collect()
}

#[test]
fn studio_fill_keeps_original_shape_when_view_changes() {
    let services = Services { open_async: Some(Box::new(|_, _| {})), ..Default::default() };
    let mut app = SlideApp::new(Session::with_new(), services);
    let original = app.session.active().unwrap().uid;
    let shape = app.session.active().unwrap().doc.slides[0].shapes[0].id;
    app.session.execute("edit.select", &json!({"ids": [shape]})).unwrap();
    panes::pick_fill_picture(&mut app);
    let request = app.pending_files.last().unwrap().id;
    app.session.execute("file.new", &json!({})).unwrap();
    let current = app.session.active().unwrap().uid;
    app.apply_external_file(request, "fill.png", &picture());
    assert_eq!(app.session.active().unwrap().uid, current);
    let original = app.session.documents().iter().find(|d| d.uid == original).unwrap();
    assert!(matches!(original.doc.slides[0].shapes[0].fill, Some(deckcraft_model::Fill::Picture(_))));
    assert!(original.is_dirty());
    assert!(!app.session.active().unwrap().is_dirty());
}

#[test]
fn studio_background_keeps_original_slide_and_closed_target_is_ignored() {
    let services = Services { open_async: Some(Box::new(|_, _| {})), ..Default::default() };
    let mut app = SlideApp::new(Session::with_new(), services);
    app.pick_and_insert("picture", "design.background");
    let request = app.pending_files.last().unwrap().id;
    app.session.execute("slide.new", &json!({})).unwrap();
    app.apply_external_file(request, "background.png", &picture());
    let doc = &app.session.active().unwrap().doc;
    assert!(doc.slides[0].background.is_some());
    assert!(doc.slides[1].background.is_none());
    app.pick_and_insert("picture", "design.background");
    let request = app.pending_files.last().unwrap().id;
    app.session.close_document(0);
    app.session.execute("file.new", &json!({})).unwrap();
    app.apply_external_file(request, "late.png", &picture());
    assert!(!app.session.active().unwrap().is_dirty());
}
