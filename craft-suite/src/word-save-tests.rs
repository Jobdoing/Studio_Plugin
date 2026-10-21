    #[test]
    fn studio_receipt_names_the_saved_document() {
        let (mut app, saves, ticket) = web_picker_app();
        app.execute("file.save", json!({})).unwrap();
        saves.filename(ticket.get(), "Acknowledged.docx".into());
        saves.finish(ticket.get(), async_saves::SaveOutcome::Saved);
        app.settle_async_saves();
        assert_eq!(app.session.path.as_deref(), Some(std::path::Path::new("Acknowledged.docx")));
        assert!(!app.session.dirty);
    }

    #[test]
    fn studio_export_does_not_rename_or_clean_the_source() {
        let (mut app, saves, ticket) = web_picker_app();
        app.execute("file.saveAs", json!({"path": "copy.txt"})).unwrap();
        saves.filename(ticket.get(), "Export.txt".into());
        saves.finish(ticket.get(), async_saves::SaveOutcome::Saved);
        app.settle_async_saves();
        assert!(app.session.path.is_none());
        assert!(app.session.dirty);
    }

    #[test]
    fn studio_receipt_preserves_edits_made_after_serialization() {
        let (mut app, saves, ticket) = web_picker_app();
        app.execute("file.save", json!({})).unwrap();
        app.execute("text.insert", json!({"text": "More edits"})).unwrap();
        saves.filename(ticket.get(), "Earlier.docx".into());
        saves.finish(ticket.get(), async_saves::SaveOutcome::Saved);
        app.settle_async_saves();
        assert_eq!(app.session.path.as_deref(), Some(std::path::Path::new("Earlier.docx")));
        assert!(app.session.dirty);
        assert!(body_text(&app).contains("More edits"));
    }

    #[test]
    fn studio_failed_save_does_not_apply_a_filename_receipt() {
        let (mut app, saves, ticket) = web_picker_app();
        app.execute("file.save", json!({})).unwrap();
        saves.filename(ticket.get(), "Failed.docx".into());
        saves.finish(ticket.get(), async_saves::SaveOutcome::Failed("Upload rejected".into()));
        app.settle_async_saves();
        assert!(app.session.path.is_none());
        assert!(app.session.dirty);
        assert!(saves.take_filename(ticket.get()).is_none());
    }

    #[test]
    fn studio_replaced_document_ignores_an_old_filename_receipt() {
        for outcome in [
            async_saves::SaveOutcome::Saved,
            async_saves::SaveOutcome::Cancelled,
            async_saves::SaveOutcome::Failed("Upload rejected".into()),
        ] {
            let (mut app, saves, ticket) = web_picker_app();
            app.execute("file.save", json!({})).unwrap();
            let original = app.session.document_id();
            app.execute("file.new", json!({})).unwrap();
            app.execute("text.insert", json!({"text": "Replacement document"})).unwrap();
            app.session.path = Some("Replacement.docx".into());
            app.session.dirty = false;
            let replacement = app.session.document_id();
            assert_ne!(replacement, original);
            saves.filename(ticket.get(), "Old-document.docx".into());
            saves.finish(ticket.get(), outcome);
            app.settle_async_saves();
            assert_eq!(app.session.document_id(), replacement);
            assert_eq!(app.session.path.as_deref(), Some(std::path::Path::new("Replacement.docx")));
            assert!(!app.session.dirty);
            assert!(body_text(&app).contains("Replacement document"));
            assert!(saves.take_filename(ticket.get()).is_none());
        }
    }

    #[test]
    fn studio_cancelled_save_keeps_the_pending_close_blocked() {
        let (mut app, saves, ticket) = web_picker_app();
        let original = app.session.document_id();
        app.run("file.close", json!({})).unwrap();
        assert_eq!(prompt(&app), Some("saveChanges"));
        app.run("ui.saveChanges", json!({"answer": "save"})).unwrap();
        assert!(!app.quit_requested);
        assert_eq!(saves.pending(), 1);
        saves.filename(ticket.get(), "Cancelled.docx".into());
        saves.finish(ticket.get(), async_saves::SaveOutcome::Cancelled);
        app.settle_async_saves();
        assert!(!app.quit_requested);
        assert_eq!(app.session.document_id(), original);
        assert!(body_text(&app).contains(UNSAVED));
        assert!(app.session.path.is_none());
        assert!(app.session.dirty);
        assert_eq!(prompt(&app), Some("saveChanges"));
        assert!(prompt_message(&app).unwrap_or_default().contains("cancelled"));
        assert!(saves.take_filename(ticket.get()).is_none());
    }
