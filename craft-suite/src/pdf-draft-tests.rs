#[cfg(test)]
mod studio_draft_tests {
    use super::tests::staging_dir;
    use super::*;
    use crate::{PdfCraftApp, content_ui::TextDraft};
    use std::sync::Arc;

    fn app_with_draft(text: &str) -> PdfCraftApp {
        let mut app = PdfCraftApp::new();
        let bytes = app.session.create_blank(612.0, 792.0, 1).unwrap();
        app.open_bytes("source.pdf", None, bytes.as_ref().clone())
            .unwrap();
        let rect = [40.0, 40.0, 300.0, 70.0];
        let style = pdfcraft_engine::AddedText {
            rect,
            ..crate::content_ui::default_style()
        };
        app.views[0].content.draft = Some(TextDraft {
            page: 0,
            index: None,
            rect,
            text: text.into(),
            style,
            focus: true,
        });
        app
    }

    fn output_text(bytes: Arc<Vec<u8>>) -> String {
        let mut session = pdfcraft_engine::Session::new();
        let id = session.open("reopened.pdf", None, bytes, None).unwrap();
        session
            .get(id)
            .unwrap()
            .text_blocks(0)
            .iter()
            .map(|block| block.text.clone())
            .collect::<Vec<_>>()
            .join("\n")
    }

    #[test]
    fn drawable_draft_blocks_close_and_cancel_keeps_the_draft() {
        let mut app = app_with_draft("Uncommitted Studio text");
        let id = app.views[0].id;
        assert!(!app.session.get(id).unwrap().dirty);
        assert!(app.has_unsaved_work(0));
        let context = egui::Context::default();
        assert!(!app.request_quit(&context));
        app.resolve_close(&context, None);
        assert_eq!(app.views.len(), 1);
        assert_eq!(
            app.views[0].content.draft.as_ref().unwrap().text,
            "Uncommitted Studio text"
        );
        assert!(app.has_unsaved_work(0));
    }

    #[test]
    fn save_commits_the_requested_tabs_draft_and_reopens_its_actual_pdf_text() {
        let mut app = app_with_draft("Studio PDF roundtrip draft");
        let id = app.views[0].id;
        let other = app.session.create_blank(612.0, 792.0, 1).unwrap();
        app.open_bytes("other.pdf", None, other.as_ref().clone())
            .unwrap();
        let other_id = app.views[1].id;
        let dir = staging_dir("studio-draft-roundtrip");
        let path = dir.join("saved.pdf");
        app.save_override = Some(path.to_string_lossy().into_owned());
        assert!(app.save_view(0, SaveTarget::InPlace));
        assert!(app.views[0].content.draft.is_none());
        assert!(!app.session.get(id).unwrap().dirty);
        let bytes = Arc::new(std::fs::read(&path).unwrap());
        assert!(output_text(bytes).contains("Studio PDF roundtrip draft"));
        assert!(!app.session.get(other_id).unwrap().dirty);
        assert!(app.session.get(other_id).unwrap().added().is_empty());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn cancelled_or_failed_save_keeps_the_committed_draft_text_unsaved() {
        for cancelled in [true, false] {
            let mut app = app_with_draft("Retained after save did not complete");
            let id = app.views[0].id;
            let dir = staging_dir(if cancelled {
                "studio-draft-cancel"
            } else {
                "studio-draft-failure"
            });
            if cancelled {
                app.pick_override = Some(Vec::new());
            } else {
                app.save_override = Some(
                    dir.join("missing/output.pdf")
                        .to_string_lossy()
                        .into_owned(),
                );
            }
            assert!(!app.save_view(0, SaveTarget::InPlace));
            app.process_picked();
            assert_eq!(app.views.len(), 1);
            assert!(app.session.get(id).unwrap().dirty);
            assert!(app.has_unsaved_work(0));
            assert!(
                output_text(app.session.save_bytes(id).unwrap())
                    .contains("Retained after save did not complete")
            );
            std::fs::remove_dir_all(dir).unwrap();
        }
    }

    #[test]
    fn blocked_content_draft_is_preserved_when_save_cannot_commit_it() {
        let mut app = app_with_draft("Unsupported text \u{4e2d}");
        assert!(!app.commit_typing_in(app.views[0].id));
        assert_eq!(
            app.views[0].content.draft.as_ref().unwrap().text,
            "Unsupported text \u{4e2d}"
        );
        assert!(app.has_unsaved_work(0));
    }

    #[test]
    fn existing_paragraph_text_and_style_are_saved_and_reopened() {
        for style_only in [false, true] {
            let (mut app, mut editor) = crate::edit_text_ui::tests::preview_app();
            let id = app.views[0].id;
            if style_only {
                editor.look.bold = true;
            } else {
                editor.text = "Saved paragraph replacement".into();
            }
            app.views[0].line_editor = Some(editor);
            assert!(!app.session.get(id).unwrap().dirty);
            assert!(app.has_unsaved_work(0));
            let context = egui::Context::default();
            assert!(!app.request_quit(&context));
            app.resolve_close(&context, None);
            assert!(app.views[0].line_editor.as_ref().unwrap().has_changes());
            let dir = staging_dir(if style_only {
                "studio-line-style"
            } else {
                "studio-line-text"
            });
            let path = dir.join("saved.pdf");
            app.save_override = Some(path.to_string_lossy().into_owned());
            assert!(app.save_view(0, SaveTarget::InPlace));
            let mut reopened = pdfcraft_engine::Session::new();
            let saved = reopened
                .open(
                    "saved.pdf",
                    None,
                    Arc::new(std::fs::read(&path).unwrap()),
                    None,
                )
                .unwrap();
            let blocks = reopened.get(saved).unwrap().text_blocks(0);
            if style_only {
                assert!(
                    blocks
                        .iter()
                        .any(|block| block.text.contains("Preview text")
                            && block.base_font.contains("Bold"))
                );
            } else {
                assert!(
                    blocks
                        .iter()
                        .any(|block| block.text.contains("Saved paragraph replacement"))
                );
            }
            assert!(app.views[0].line_editor.is_none());
            assert!(!app.has_unsaved_work(0));
            std::fs::remove_dir_all(dir).unwrap();
        }
    }

    #[test]
    fn failed_paragraph_commit_restores_its_text_and_style_draft() {
        let (mut app, mut editor) = crate::edit_text_ui::tests::preview_app();
        editor.text = "Retained paragraph".into();
        editor.look.bold = true;
        editor.block = 1;
        app.views[0].line_editor = Some(editor.clone());
        assert!(!app.commit_typing_in(app.views[0].id));
        assert_eq!(app.views[0].line_editor.as_ref(), Some(&editor));
        assert!(app.has_unsaved_work(0));
    }

    #[test]
    fn all_comment_text_drafts_save_and_reopen_in_the_pdf() {
        use crate::comments::{Composer, ComposerKind};
        use pdfcraft_engine::{Edit, NewAnnotation, NoteIcon, Shape};
        for kind in 0..4 {
            let mut app = app_with_draft("");
            app.views[0].content.draft = None;
            let id = app.views[0].id;
            assert!(app.apply_edit(Edit::AddAnnotation(NewAnnotation {
                page: 0,
                shape: Shape::Note {
                    at: [50.0, 50.0],
                    icon: NoteIcon::Comment
                },
                style: app.comment_prefs.style(crate::comments::CommentTool::Note),
                contents: "Existing comment".into(),
                author: "Studio".into(),
            })));
            let bytes = app.session.save_bytes(id).unwrap();
            app.session.mark_saved(id, bytes, None).unwrap();
            let annotation = app.session.get(id).unwrap().info.annotations[0].clone();
            let expected = format!("Saved comment draft {kind}");
            match kind {
                0 => {
                    app.views[0].comments.composer = Some(Composer {
                        page: 0,
                        at: [80.0, 80.0],
                        kind: ComposerKind::Note,
                        text: expected.clone(),
                        focus: true,
                    })
                }
                1 => app.views[0].comments.add_box = expected.clone(),
                2 => {
                    app.views[0].comments.editing =
                        Some((annotation.page, annotation.index, expected.clone()))
                }
                _ => {
                    app.views[0].comments.selected = Some((annotation.page, annotation.index));
                    app.views[0].comments.reply = expected.clone();
                }
            }
            assert!(!app.session.get(id).unwrap().dirty);
            assert!(app.has_unsaved_work(0));
            let context = egui::Context::default();
            assert!(!app.request_quit(&context));
            app.resolve_close(&context, None);
            assert!(app.has_unsaved_work(0));
            let dir = staging_dir(&format!("studio-comment-{kind}"));
            let path = dir.join("saved.pdf");
            app.save_override = Some(path.to_string_lossy().into_owned());
            assert!(app.save_view(0, SaveTarget::InPlace));
            let mut reopened = pdfcraft_engine::Session::new();
            let saved = reopened
                .open(
                    "saved.pdf",
                    None,
                    Arc::new(std::fs::read(&path).unwrap()),
                    None,
                )
                .unwrap();
            assert!(
                reopened
                    .get(saved)
                    .unwrap()
                    .info
                    .annotations
                    .iter()
                    .any(|annotation| annotation.contents.as_deref() == Some(&expected))
            );
            assert!(!app.has_unsaved_work(0));
            std::fs::remove_dir_all(dir).unwrap();
        }
    }

    #[test]
    fn bookmark_title_draft_is_saved_on_its_original_document() {
        let mut app = app_with_draft("");
        app.views[0].content.draft = None;
        let id = app.views[0].id;
        app.bookmark_action(crate::panels::BmAction::New);
        app.bookmark_rename = None;
        let bytes = app.session.save_bytes(id).unwrap();
        app.session.mark_saved(id, bytes, None).unwrap();
        app.bookmark_action(crate::panels::BmAction::StartRename(vec![0]));
        app.bookmark_rename.as_mut().unwrap().1 = "Saved bookmark title".into();
        assert!(app.has_unsaved_work(0));
        let other = app.session.create_blank(612.0, 792.0, 1).unwrap();
        app.open_bytes("other.pdf", None, other.as_ref().clone())
            .unwrap();
        let dir = staging_dir("studio-bookmark");
        let path = dir.join("saved.pdf");
        app.save_override = Some(path.to_string_lossy().into_owned());
        assert!(app.save_view(0, SaveTarget::InPlace));
        let mut reopened = pdfcraft_engine::Session::new();
        let saved = reopened
            .open(
                "saved.pdf",
                None,
                Arc::new(std::fs::read(&path).unwrap()),
                None,
            )
            .unwrap();
        assert_eq!(
            reopened.get(saved).unwrap().info.outline[0].title,
            "Saved bookmark title"
        );
        assert!(
            app.session
                .get(app.views[1].id)
                .unwrap()
                .info
                .outline
                .is_empty()
        );
        assert!(!app.has_unsaved_work(0));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn stale_comment_target_preserves_every_draft_before_saving() {
        let mut app = app_with_draft("");
        app.views[0].content.draft = None;
        let id = app.views[0].id;
        app.views[0].comments.composer = Some(crate::comments::Composer {
            page: 0,
            at: [50.0, 50.0],
            kind: crate::comments::ComposerKind::Note,
            text: "Retained new note".into(),
            focus: true,
        });
        app.views[0].comments.editing = Some((0, 1, "Retained stale comment edit".into()));
        assert!(!app.commit_typing_in(id));
        assert_eq!(
            app.views[0].comments.composer.as_ref().unwrap().text,
            "Retained new note"
        );
        assert_eq!(
            app.views[0].comments.editing.as_ref().unwrap().2,
            "Retained stale comment edit"
        );
        assert!(app.session.get(id).unwrap().info.annotations.is_empty());
        assert!(app.has_unsaved_work(0));
    }
}
