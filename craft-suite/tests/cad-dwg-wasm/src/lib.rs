//! Fixture from upstream crates/io/tests/dwg_required_dictionaries.rs::rectangle.
//! Copyright upstream CADCraft contributors; MIT OR Apache-2.0, as upstream.
use cadcraft_doc::{Common, Drawing, EntityKind, LwPolyline, Space};
use cadcraft_geom::{PolyVertex, Vec2};

pub fn rectangle() -> Drawing {
    let mut drawing = Drawing::new_metric();
    let corners = [(0.0, 0.0), (4.0, 0.0), (4.0, 2.0), (0.0, 2.0)];
    let polyline = LwPolyline {
        vertices: corners.iter().map(|(x, y)| PolyVertex::new(Vec2::new(*x, *y))).collect(),
        closed: true, const_width: 0.0, elevation: 0.0, plinegen: false,
    };
    drawing.add(&Space::Model, Common::default(), EntityKind::LwPolyline(polyline)).expect("add the rectangle");
    drawing
}

pub fn move_corner(drawing: &mut Drawing) {
    let handle = drawing.model.iter().next().expect("fixture entity").handle;
    drawing.modify_entity(handle, |entity| {
        let EntityKind::LwPolyline(polyline) = &mut entity.kind else { panic!("expected fixture polyline") };
        polyline.vertices[1].p = Vec2::new(7.0, 9.0);
    }).expect("edit the opened DWG");
}

pub fn verify_geometry(drawing: &Drawing, expected: &Drawing) {
    assert_eq!(drawing.entity_count(), 1, "the real DWG must contain the fixture entity");
    assert_eq!(drawing.model.iter().map(|entity| &entity.kind).collect::<Vec<_>>(),
               expected.model.iter().map(|entity| &entity.kind).collect::<Vec<_>>(),
               "DWG must preserve every vertex, order and closed flag");
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn verify(bytes: &[u8]) -> Vec<u8> {
    use cadcraft_dwg::{Limits, dwg_to_dxf_noted};
    assert_eq!(&bytes[..6], b"AC1015", "fixture must be a native-generated R2000 DWG");
    let (dxf, notes) = dwg_to_dxf_noted(bytes, Limits::DEFAULT).expect("decode real DWG in WASM");
    assert!(notes.is_empty(), "fixture must not silently lose records: {notes:?}");
    assert!(!dxf.is_empty());
    let mut drawing = cadcraft_io::read(bytes, "native.dwg").expect("open real DWG through the editor IO in WASM");
    verify_geometry(&drawing, &rectangle());
    assert!(dwg_to_dxf_noted(bytes, Limits { max_dwg_bytes: bytes.len() - 1, ..Limits::DEFAULT }).is_err());
    assert!(dwg_to_dxf_noted(bytes, Limits { max_dxf_bytes: 1, ..Limits::DEFAULT }).is_err());
    assert!(cadcraft_io::read(b"AC1032 this is not a dwg file at all", "damaged.dwg").is_err());
    // A writer that echoes the input must fail: serialize a real geometry change.
    move_corner(&mut drawing);
    assert_ne!(drawing.model.iter().map(|entity| &entity.kind).collect::<Vec<_>>(),
               rectangle().model.iter().map(|entity| &entity.kind).collect::<Vec<_>>());
    let output = cadcraft_io::write_with(&drawing, "wasm.dwg", &cadcraft_io::SaveOptions {
        version: Some(cadcraft_io::Version::R2000), binary: false,
    }).expect("write DWG in WASM");
    assert_eq!(&output[..6], b"AC1015");
    verify_geometry(&cadcraft_io::read(&output, "wasm.dwg").expect("reopen WASM-written DWG"), &drawing);
    output
}
