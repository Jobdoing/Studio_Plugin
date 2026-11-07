#[cfg(test)]
mod studio_format_tests {
    use cadcraft_engine::{Session, cmd::file, studio_save};
    use cadcraft_ui_egui::{CadApp, Services};
    use serde_json::json;

    #[test]
    fn real_save_entrance_serializes_r2000_dwg_and_dxf_without_cleaning_before_receipt() {
        file::set_io(file::IoHooks {
            read: |bytes, name| cadcraft_io::read(bytes, name).map_err(|error| error.to_string()),
            write: |drawing, name| cadcraft_io::write(drawing, name).map_err(|error| error.to_string()),
            plot: None,
        });
        file::set_write_as(|drawing, name, options| cadcraft_io::write_with(drawing, name,
            &cadcraft_io::SaveOptions { version: options.version, binary: options.binary }).map_err(|error| error.to_string()));
        studio_save::set_enabled(true);
        let mut app = CadApp::new(Session::new(), Services {
            no_file_system: true,
            pick_save: Some(Box::new(|name| Some(name.to_string()))),
            ..Services::default()
        });
        app.run("circle", json!({"center": [3, 4], "radius": 2})).unwrap();
        for name in ["Drawing.dwg", "Drawing.dxf"] {
            let outcome = app.run("saveas", json!({"path": name, "version": "2018"})).unwrap();
            assert_eq!(outcome["pending"], true);
            let request = studio_save::take_requests().pop().unwrap();
            assert!(request.save_as);
            assert!(!request.copy);
            assert!(app.session.state().unwrap().is_dirty());
            if name.ends_with(".dwg") {
                assert_eq!(&request.bytes[..6], b"AC1015");
                assert_eq!(outcome["version"], "2000");
            }
            let reopened = cadcraft_io::read(&request.bytes, name).unwrap();
            assert_eq!(reopened.entity_count(), app.session.doc().unwrap().entity_count());
            assert_eq!(reopened.model.iter().map(|entity| &entity.kind).collect::<Vec<_>>(),
                       app.session.doc().unwrap().model.iter().map(|entity| &entity.kind).collect::<Vec<_>>());
            assert!(studio_save::settle(&mut app.session, &request, &Ok(name.into())));
            app.run("circle", json!({"center": [5, 6], "radius": 1})).unwrap();
        }
        app.run("qsave", serde_json::Value::Null).unwrap();
        let request = studio_save::take_requests().pop().unwrap();
        assert!(!request.save_as, "Save must reuse the bound destination");
        assert!(app.session.state().unwrap().is_dirty());
        assert!(!studio_save::settle(&mut app.session, &request, &Err("CANCELLED".into())));
        studio_save::set_enabled(false);
    }
}
