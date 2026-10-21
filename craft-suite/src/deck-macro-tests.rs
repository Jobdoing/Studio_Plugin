//! Reject actual macro package data, independent of the selected file's suffix.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::io::{Cursor, Read, Write};

#[test]
fn studio_macro_packages_are_rejected_and_plain_pptx_opens() {
    let normal = crate::export(&deckcraft_model::defaults::new_presentation(None)).unwrap();
    assert!(crate::import(&normal).is_ok());
    for (payload, content_type) in [(true, false), (false, true)] {
        let mut input = zip::ZipArchive::new(Cursor::new(&normal)).unwrap();
        let mut output = zip::ZipWriter::new(Cursor::new(Vec::new()));
        let options = zip::write::SimpleFileOptions::default();
        for i in 0..input.len() {
            let mut entry = input.by_index(i).unwrap();
            let mut data = Vec::new();
            entry.read_to_end(&mut data).unwrap();
            if content_type && entry.name() == "[Content_Types].xml" {
                data = String::from_utf8(data).unwrap().replace(
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
                    "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml",
                ).into_bytes();
            }
            output.start_file(entry.name(), options).unwrap();
            output.write_all(&data).unwrap();
        }
        if payload {
            output.start_file("ppt/vbaProject.bin", options).unwrap();
            output.write_all(b"STUDIO_MACRO_SENTINEL").unwrap();
        }
        let bytes = output.finish().unwrap().into_inner();
        let error = crate::import(&bytes).unwrap_err().to_string();
        assert!(error.contains("Macro-enabled presentations are not supported"), "{error}");
    }
}
