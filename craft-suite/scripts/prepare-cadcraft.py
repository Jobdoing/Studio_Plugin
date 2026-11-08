"""Adapt pristine CADCraft v0.18.0 to the shared Studio file host."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tomllib

source = Path(sys.argv[1]).resolve()
suite = Path(__file__).resolve().parents[1]
commit = "32238e83c2c8bf643994132883e94bc96961f649"
assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip() == commit, "Expected CADCraft v0.18.0 commit"
assert tomllib.loads((source / "Cargo.toml").read_text())["workspace"]["package"]["version"] == "0.18.0"
font_dir = Path(os.environ["CRAFT_FONTS_DIR"])
for name, digest in {
    "fonts/NotoSansCJKtc-Regular.otf": "dce08bd4fd91aa8aa76ed8fea4b694c2dfb8550f67871e326843212ddbeb88b4",
    "OFL.txt": "6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2",
}.items():
    assert hashlib.sha256((font_dir / name).read_bytes()).hexdigest() == digest, f"Unexpected pinned font: {name}"


def patch(name, old, new):
    path = source / name
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f"Upstream CADCraft changed: {name}: {old[:90]}")
    path.write_text(text.replace(old, new))


engine = "crates/engine/src/"
ui = "crates/ui-egui/src/"
web = "apps/cadcraft-web/src/main.rs"
# Reuse the dependency's existing WASM stream implementation; keep every native guard.
dwg_pin, = (package for package in tomllib.loads((source / "Cargo.lock").read_text())["package"] if package["name"] == "acadrust")
assert dwg_pin["version"] == "0.6.6" and dwg_pin["checksum"] == "8923c99ea1f151cb7fc17ce2fc14f8b1e330fa22611e535602d985c0cc3c89a2"
patch("crates/dwg/build.rs", 'if arch == "wasm32" || (os == "freebsd" && arch == "aarch64") {', 'if os == "freebsd" && arch == "aarch64" {')
patch("crates/dwg/Cargo.toml", '[target.\'cfg(not(any(target_arch = "wasm32", all(target_os = "freebsd", target_arch = "aarch64"))))\'.dependencies]', '[target.\'cfg(not(all(target_os = "freebsd", target_arch = "aarch64")))\'.dependencies]')
patch("crates/dwg/src/lib.rs", 'mod native {', '// NOTE(ceiling): WASM uses the existing in-process fallback without native crash/timeout isolation; move conversion to a dedicated Web Worker to restore it.\nmod native {')
patch(engine + "lib.rs", "mod doc_state;", "mod doc_state;\npub mod studio_save;")
shutil.copyfile(suite / "src/cad-save.rs", source / engine / "studio_save.rs")
# Intercept the real engine save entrance, including menus, aliases, scripts and LISP.
patch(engine + "cmd/file.rs", "    let bytes = write_bytes(s, cmd, path, opts)?;\n    let n = commit_save", """    let bytes = write_bytes(s, cmd, path, opts)?;
    if crate::studio_save::enabled() {
        let n = bytes.len();
        crate::studio_save::queue(s, path, bytes, cmd == "saveas", opts.binary, !is_drawing_file(path))
            .map_err(|error| bad(cmd, error))?;
        return Ok(n);
    }
    let n = commit_save""")
patch(engine + "cmd/file.rs", "    let hooks = io().ok_or_else(|| bad(cmd, \"file formats are not available in this build\"))?;", """    let hooks = io().ok_or_else(|| bad(cmd, "file formats are not available in this build"))?;
    let mut studio_options = *opts;
    if crate::studio_save::enabled() && path.to_ascii_lowercase().ends_with(".dwg") {
        studio_options.version = Some(Version::R2000);
    }
    let opts = &studio_options;""")
patch(engine + "cmd/file.rs", "fn drawing_version(s: &Session, path: &str) -> Version {", """fn drawing_version(s: &Session, path: &str) -> Version {
    if crate::studio_save::enabled() && path.to_ascii_lowercase().ends_with(".dwg") { return Version::R2000; }""")
patch(engine + "cmd/file.rs", '    if cfg!(target_arch = "wasm32") {\n        r["download"]', '    if crate::studio_save::enabled() { r["pending"] = json!(true); }\n    if cfg!(target_arch = "wasm32") && !crate::studio_save::enabled() {\n        r["download"]')
patch(engine + "cmd/file.rs", 'r["version"] = json!(opts.version.unwrap_or_else(|| drawing_version(s, &path)).year());', 'r["version"] = json!(if crate::studio_save::enabled() && path.to_ascii_lowercase().ends_with(".dwg") { Version::R2000.year() } else { opts.version.unwrap_or_else(|| drawing_version(s, &path)).year() });')
patch(ui + "lib.rs", "pub struct CadApp {", "pub struct CadApp {\n    studio_close: Option<u64>,")
patch(ui + "lib.rs", "            system_languages: Vec::new(),", "            studio_close: None,\n            system_languages: Vec::new(),")
patch(ui + "lib.rs", "    pub fn logic(&mut self, ctx: &egui::Context) {", "    pub fn logic(&mut self, ctx: &egui::Context) {\n        self.settle_studio_saves();")
patch(ui + "closing.rs", "    pub fn answer_close(&mut self, choice: Choice) {", "    pub fn answer_close(&mut self, choice: Choice) {\n        self.studio_close = None;")
patch(ui + "closing.rs", '            if self.session.docs.get(i).is_some_and(|d| d.is_dirty()) {', '            if self.session.docs.get(i).is_some_and(|d| d.is_dirty()) || cadcraft_engine::studio_save::pending(uid) {')
patch(ui + "closing.rs", 'if self.quit_confirmed || !self.session.docs.iter().any(|d| d.is_dirty()) {', 'if self.quit_confirmed || (!self.session.docs.iter().any(|d| d.is_dirty()) && !cadcraft_engine::studio_save::busy()) {')
patch(ui + "closing.rs", "            Choice::Save => {", """            Choice::Save => {
                if cadcraft_engine::studio_save::pending(uid) {
                    self.studio_close = Some(uid);
                    return;
                }""")
patch(ui + "closing.rs", '                let saved = r.is_ok() && self.doc_index(uid)', '''                if r.is_ok() && cadcraft_engine::studio_save::pending(uid) {
                    self.studio_close = Some(uid);
                    return;
                }
                let saved = r.is_ok() && self.doc_index(uid)''')
path = source / ui / "closing.rs"
path.write_text(path.read_text() + "\n" + (suite / "src/cad-save-poll.rs").read_text())
# Preserve native file services, but disable the upstream host and direct browser file paths.
patch(web, "mod host;", "#[allow(dead_code)]\nmod studio;")
patch(web, '#[cfg(target_arch = "wasm32")]\npub mod download;\n', '')
patch(web, "crate::upload::Inbox, Option<crate::host::Bridge>,", "crate::upload::Inbox,")
patch(web, "self.0.system_animations = self.3.as_ref()", "self.0.system_animations = self.2.as_ref()")
patch(web, "crate::push_title(&mut self.4,", "crate::push_title(&mut self.3,")
patch(web, """            if let Some(bridge) = &self.2 {
                bridge.report_dirty(&self.0);
            }""", """            crate::studio::dirty(cadcraft_engine::studio_save::busy() || self.0.session.docs.iter().any(|doc| doc.is_dirty()));""")
patch(web, "                self.1.take_dropped(ui.ctx());", "                ui.ctx().input_mut(|input| input.raw.dropped_files.clear());")
patch(web, "        let bridge = crate::host::Bridge::connect(&canvas);\n        match &bridge {\n            Some(bridge) => {\n                bridge.install();\n                cadcraft_engine::cmd::file::set_deliver(crate::host::deliver);\n            }\n            None => cadcraft_engine::cmd::file::set_deliver(crate::download::download),\n        }", "        cadcraft_engine::studio_save::set_enabled(true);\n        cadcraft_engine::cmd::file::set_deliver(crate::upload::deliver);")
patch(web, "        let app_bridge = bridge.clone();\n", "")
patch(web, "let session = if app_bridge.is_some() { Session::empty() } else { Session::new() };", "let session = Session::empty();")
patch(web, """                        let host = app_bridge.inspect(|bridge| {
                            bridge.listen(inbox.clone());
                            bridge.post_ready();
                        });""", "")
patch(web, "Shell(app, inbox, host, reduced_motion, None)", "Shell(app, inbox, reduced_motion, None)")
patch(web, """            if let (Err(e), Some(bridge)) = (&result, &bridge) {
                bridge.post_failed(&format!("{e:?}"));
            }
""", "")
patch(web, "                        // `?cpu`: no render state for the app, so the canvas draws with egui shapes.", "                        app.ui.interface_language = cadcraft_ui_egui::i18n::Preference::TraditionalChinese;\n                        // `?cpu`: no render state for the app, so the canvas draws with egui shapes.")
shutil.copyfile(suite / "src/studio.rs", source / "apps/cadcraft-web/src/studio.rs")
shutil.copyfile(suite / "src/cad-web.rs", source / "apps/cadcraft-web/src/upload.rs")
patch("apps/cadcraft-web/Cargo.toml", 'wasm-bindgen = "0.2"', 'js-sys = "0.3"\nwasm-bindgen = "0.2"')
path = source / "Cargo.lock"
text = path.read_text()
start = text.index('name = "cadcraft-web"\n')
end = text.index('\n[[package]]', start)
entry = text[start:end]
assert entry.count(' "log",') == 1
path.write_text(text[:start] + entry.replace(' "log",', ' "js-sys",\n "log",') + text[end:])
# The pinned TC face is the sole exception to the upstream font-family exclusion policy.
patch("crates/fonts/build.rs", "if BARRED_FAMILIES.iter().any(|barred| family.starts_with(barred)) {", 'if *family != "Noto Sans CJK TC" && BARRED_FAMILIES.iter().any(|barred| family.starts_with(barred)) {')
patch("crates/fonts/build.rs", 'let web_face = (*family == "BIZ UDPGothic" && *style == "Regular")', 'let web_face = (["Noto Sans CJK TC", "BIZ UDPGothic"].contains(family) && *style == "Regular")')
patch("crates/fonts/src/craft_fonts.rs", 'assert!(!BARRED.iter().any(|b| f.family.starts_with(b)),', 'assert!(f.family == "Noto Sans CJK TC" || !BARRED.iter().any(|b| f.family.starts_with(b)),')
patch(ui + "i18n/tests.rs", '["ko", "zh", "ar", "vi", "ka"].contains(&language.code)', '["ko", "zh", "zh-hant", "ar", "vi", "ka"].contains(&language.code)')
print("CADCraft v0.18.0 Studio source adapter applied")
