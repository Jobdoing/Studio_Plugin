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

    fn studio_picker_app() -> (WordApp, async_saves::AsyncSaves, std::rc::Rc<std::cell::Cell<u64>>) {
        let (mut app, saves, ticket) = web_picker_app();
        let service = saves.clone();
        let current = ticket.clone();
        app.services.studio_save = Some(Box::new(move |_, _, _, _, _| {
            current.set(service.start());
            Ok(())
        }));
        (app, saves, ticket)
    }

    #[test]
    fn studio_receipt_cleans_only_the_serialized_revision() {
        for edited in [false, true] {
            let (mut app, saves, ticket) = studio_picker_app();
            app.execute("file.save", json!({})).unwrap();
            assert!(app.session.dirty);
            if edited {
                app.execute("text.insert", json!({"text": "Later edits"})).unwrap();
            }
            saves.filename(ticket.get(), "Confirmed.docx".into());
            saves.finish(ticket.get(), async_saves::SaveOutcome::Saved);
            app.settle_async_saves();
            assert_eq!(app.session.dirty, edited, "only the acknowledged revision is saved");
            assert_eq!(app.session.path.as_deref(), Some(std::path::Path::new("Confirmed.docx")));
            if edited { assert!(body_text(&app).contains("Later edits")); }
        }
    }

    #[test]
    fn studio_new_and_open_preserve_unsaved_documents_and_bind_the_new_source() {
        let (mut app, _, _) = studio_picker_app();
        let original = app.session.document_id();
        let bound = std::rc::Rc::new(std::cell::RefCell::new(Vec::new()));
        let observed = bound.clone();
        app.services.studio_bind = Some(Box::new(move |id, token| observed.borrow_mut().push((id, token.to_string()))));
        app.run("file.new", json!({})).unwrap();
        app.run("file.open", json!({"path": "Opened.txt", "data": wordcraft_engine::cmd::insert::base64_encode(b"Opened text"), "studioSource": "local-source"})).unwrap();
        assert_eq!(*bound.borrow(), vec![(app.session.document_id(), "local-source".to_string())]);
        assert!(body_text(&app).contains("Opened text"));
        app.run("view.switchWindows", json!({"id": original})).unwrap();
        assert!(app.session.dirty && body_text(&app).contains(UNSAVED));
    }

    #[test]
    fn studio_dirty_report_includes_background_documents() {
        let (mut app, _, _) = studio_picker_app();
        let original = app.session.document_id();
        app.run("file.new", json!({})).unwrap();
        assert!(!app.session.dirty);
        let dirty = std::rc::Rc::new(std::cell::Cell::new(false));
        let observed = dirty.clone();
        app.services.on_dirty = Some(Box::new(move |value| observed.set(value)));
        let ctx = egui::Context::default();
        ctx.run_ui(egui::RawInput::default(), |ui| app.logic(ui.ctx())).drop_without_applying_deltas();
        assert!(dirty.get(), "leaving Studio must still protect the background document");
        app.run("view.switchWindows", json!({"id": original})).unwrap();
        app.run("file.close", json!({})).unwrap();
        app.run("ui.saveChanges", json!({"answer": "dontSave"})).unwrap();
        ctx.run_ui(egui::RawInput::default(), |ui| app.logic(ui.ctx())).drop_without_applying_deltas();
        assert!(!dirty.get(), "discarding the only unsaved document releases the guard");
    }

    #[test]
    fn studio_failed_open_discards_its_pending_source() {
        let (mut app, _, _) = studio_picker_app();
        let discarded = std::rc::Rc::new(std::cell::RefCell::new(Vec::new()));
        let observed = discarded.clone();
        app.services.studio_discard = Some(Box::new(move |token| observed.borrow_mut().push(token.to_string())));
        assert!(app.run("file.open", json!({"path": "Broken.docx", "data": wordcraft_engine::cmd::insert::base64_encode(b"Not a document"), "studioSource": "pending-source"})).is_err());
        assert_eq!(*discarded.borrow(), vec!["pending-source"]);
        assert!(app.session.dirty && body_text(&app).contains(UNSAVED));
    }

    #[test]
    fn studio_password_cancel_discards_its_pending_source() {
        let (mut app, _, _) = studio_picker_app();
        let discarded = std::rc::Rc::new(std::cell::RefCell::new(Vec::new()));
        let observed = discarded.clone();
        app.services.studio_discard = Some(Box::new(move |token| observed.borrow_mut().push(token.to_string())));
        app.dialog = Some(dialogs::Dialog::Password {
            name: "Protected.docx".into(), params: json!({"studioSource": "protected-source"}),
            password: Default::default(), message: String::new(),
        });
        let mut fonts = false;
        let mut h = egui_kittest::Harness::builder().build_ui_state(move |ui, app: &mut WordApp| {
            if fonts { dialogs::show(app, ui.ctx()); }
            else { theme::install_fonts_for(ui.ctx(), false); fonts = true; }
        }, app);
        h.run_steps(3);
        assert!(discarded.borrow().is_empty(), "a pending password prompt still owns its source");
        h.get_by_label("Cancel").click();
        h.run_steps(2);
        assert_eq!(*discarded.borrow(), vec!["protected-source"]);
        assert!(h.state().dialog.is_none());
        assert!(h.state().session.dirty && body_text(h.state()).contains(UNSAVED));
    }
