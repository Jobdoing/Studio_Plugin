//! Generate the upstream fixture natively and independently read WASM-written output.
fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args[1].as_str() {
        "generate" => {
            let dxf = cadcraft_io::write(&studio_dwg_check::rectangle(), "rectangle.dxf").expect("write fixture DXF");
            let dwg = cadcraft_dwg::dxf_to_dwg_as(&dxf, "AC1015").expect("generate native fixture DWG");
            std::fs::write(&args[2], dwg).expect("write native fixture");
        }
        "verify" => {
            let bytes = std::fs::read(&args[2]).expect("read WASM output");
            let drawing = cadcraft_io::read(&bytes, "wasm.dwg").expect("native reopen of WASM-written DWG");
            let mut expected = studio_dwg_check::rectangle();
            studio_dwg_check::move_corner(&mut expected);
            studio_dwg_check::verify_geometry(&drawing, &expected);
        }
        _ => panic!("expected generate or verify"),
    }
}
