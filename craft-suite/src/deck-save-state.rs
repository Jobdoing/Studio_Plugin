use std::sync::Arc;
use deckcraft_model::Presentation;
use crate::Session;

/// Acknowledge only the bytes and document submitted to storage, preserving later edits.
pub fn acknowledge(session: &mut Session, uid: u64, snapshot: Arc<Presentation>, close: bool, name: &str) -> bool {
    let Some(index) = session.documents().iter().position(|d| d.uid == uid) else { return false };
    let view = session.active().map(|d| d.uid);
    session.set_active(index);
    let mut closed = false;
    if let Some(d) = session.active_mut() {
        d.saved_doc = snapshot;
        d.path = Some(name.into());
        d.revision += 1;
        if close && !d.is_dirty() { session.close_document(index); closed = true; }
    }
    if let Some(index) = view.and_then(|uid| session.documents().iter().position(|d| d.uid == uid)) {
        session.set_active(index);
    }
    closed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_traditional_chinese_font_covers_document_text() {
        assert!(deckcraft_fonts::CRAFT_FONTS.iter().any(|f| f.family == "Noto Sans CJK TC"));
        let db = deckcraft_fonts::FontDb::with_font_dirs(Vec::new());
        let face = db.fallback_for('\u{7e41}', u32::MAX).unwrap();
        assert_ne!(face.glyph_for('\u{7e41}'), 0);
    }

    #[test]
    fn acknowledgement_preserves_edits_and_targets_original_document() {
        let mut session = Session::with_new();
        let first = session.active().unwrap().uid;
        let snapshot = session.active().unwrap().doc.clone();
        // A real edit replaces the presentation Arc, which defines engine dirty state.
        let d = session.active_mut().unwrap();
        Arc::make_mut(&mut d.doc).slides.clear();
        session.execute("file.new", &serde_json::json!({})).unwrap();
        let second = session.active().unwrap().uid;
        assert!(!acknowledge(&mut session, first, snapshot, true, "Renamed.deckcraft"));
        assert_eq!(session.active().unwrap().uid, second);
        assert!(session.documents().iter().find(|d| d.uid == first).unwrap().is_dirty());
        assert_eq!(session.documents().iter().find(|d| d.uid == first).unwrap().title(), "Renamed");
        let newest = session.documents().iter().find(|d| d.uid == first).unwrap().doc.clone();
        assert!(acknowledge(&mut session, first, newest, true, "Renamed.deckcraft"));
        assert_eq!(session.active().unwrap().uid, second);
        assert_eq!(session.documents().len(), 1);
    }

    #[test]
    fn closed_document_acknowledgement_cannot_mark_another_document_saved() {
        let mut session = Session::with_new();
        let first = session.active().unwrap().uid;
        let snapshot = session.active().unwrap().doc.clone();
        session.close_document(0);
        session.execute("file.new", &serde_json::json!({})).unwrap();
        let d = session.active_mut().unwrap();
        Arc::make_mut(&mut d.doc).slides.clear();
        assert!(!acknowledge(&mut session, first, snapshot, false, "Renamed.deckcraft"));
        assert!(session.active().unwrap().is_dirty());
    }
}
