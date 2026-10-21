"""Prepare the pinned DeckCraft source for Studio document-center storage."""
import shutil
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
suite = Path(__file__).resolve().parents[1]


def replace(path, old, new):
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f"Upstream DeckCraft changed in {path}: {old[:90]}")
    path.write_text(text.replace(old, new))


ui = source / "crates/ui-egui/src"
engine = source / "crates/engine/src"
replace(engine / "lib.rs", '#[derive(Clone, Debug)]\npub struct DocState {', 'pub mod studio_save_state;\n\n#[derive(Clone, Debug)]\npub struct DocState {')
shutil.copyfile(suite / "src/deck-save-state.rs", engine / "studio_save_state.rs")
lib = ui / "lib.rs"
replace(lib, '    pub fn run(&mut self, id: &str, params: Value) -> Result<Value, String> {', '''    pub fn run(&mut self, id: &str, params: Value) -> Result<Value, String> {
        #[cfg(target_arch = "wasm32")]
        if matches!(id, "file.save" | "file.saveAs" | "file.saveTemplate") {
            let format = params.get("format").and_then(Value::as_str).unwrap_or("deckcraft");
            studio_io::save(self, format, false);
            return Ok(json!({"pending": true}));
        }''')
replace(lib, "pub mod animtimeline;", 'pub mod animtimeline;\n#[cfg(target_arch = "wasm32")]\nmod studio;\n#[cfg(any(target_arch = "wasm32", test))]\npub mod studio_io;')
replace(lib, '    pub fn save_as_dialog(&mut self, format: &str) {', '    #[cfg(target_arch = "wasm32")]\n    pub fn save_as_dialog(&mut self, format: &str) { studio_io::save(self, format, false); }\n\n    #[cfg(not(target_arch = "wasm32"))]\n    pub fn save_as_dialog(&mut self, format: &str) {')
replace(lib, '    pub fn save(&mut self) {', '    #[cfg(target_arch = "wasm32")]\n    pub fn save(&mut self) { studio_io::save(self, "deckcraft", false); }\n\n    #[cfg(not(target_arch = "wasm32"))]\n    pub fn save(&mut self) {')
replace(lib, '    pub fn save_all(&mut self) -> bool {', '    #[cfg(target_arch = "wasm32")]\n    pub fn save_all(&mut self) -> bool { studio_io::save_all(self) }\n\n    #[cfg(not(target_arch = "wasm32"))]\n    pub fn save_all(&mut self) -> bool {')
replace(lib, '    pub fn logic(&mut self, ctx: &egui::Context) {', '    pub fn logic(&mut self, ctx: &egui::Context) {\n        #[cfg(target_arch = "wasm32")]\n        studio_io::poll(self, ctx);')
replace(lib, '                dl(name, &b);\n                true', '                dl(name, &b);\n                #[cfg(target_arch = "wasm32")]\n                self.set_status("Waiting for document-center export confirmation");\n                true')
replace(lib, '''                let mut any = false;
                for (file, bytes) in web_image_files(&doc, slide, all, &name, ext) {
                    any = self.download(&file, Ok(bytes)) || any;
                }
                return any;''', '''                #[cfg(target_arch = "wasm32")]
                {
                    studio_io::export_many(web_image_files(&doc, slide, all, &name, ext));
                    self.set_status("Waiting for document-center export confirmation");
                    return true;
                }
                #[cfg(not(target_arch = "wasm32"))]
                {
                    let mut any = false;
                    for (file, bytes) in web_image_files(&doc, slide, all, &name, ext) {
                        any = self.download(&file, Ok(bytes)) || any;
                    }
                    return any;
                }''')
# Preserve the existing request identity and target capture for every imported asset.
replace(lib, '    target: FileTarget,\n}', '    target: FileTarget,\n    command: Option<(String, Value)>,\n}')
replace(lib, 'target: self.capture_file_target() });', 'target: self.capture_file_target(), command: None });')
replace(lib, '            // Change Picture: the picture that arrives replaces the selected one (#115).', '            if let Some(r) = self.pending_files.iter_mut().find(|r| r.id == id) {\n                r.command = Some((cmd.into(), extra.clone()));\n            }\n            // Change Picture: the picture that arrives replaces the selected one (#115).')
replace(lib, '        let cmd = match command_for(req.purpose, name, bytes) {', '        let cmd = match req.command.as_ref().map(|(cmd, _)| Ok(cmd.as_str())).unwrap_or_else(|| command_for(req.purpose, name, bytes)) {')
replace(lib, '        let params = if cmd == "slide.fromOutline" {', '        let mut params = if cmd == "slide.fromOutline" {')
replace(lib, '        let result = if cmd == "file.openBytes" || self.viewing_target(&req.target) {', '        if let Some((_, extra)) = req.command.as_ref() {\n            if let Some(extra) = extra.as_object() {\n                for (key, value) in extra { if key != "name" && key != "data" { params[key] = value.clone(); } }\n            }\n        }\n        let result = if cmd == "file.openBytes" || self.viewing_target(&req.target) {')
replace(lib, '                if self.services.pick_open.is_none() {\n                    return Err("picking a SmartArt picture needs the desktop app".into());\n                }\n', '')
replace(lib, '''                if self.services.pick_open.is_some() {
                    self.pick_and_insert("theme", "design.browseTheme");
                } else {
                    // The browser's asynchronous picker would open the file as a new document.
                    self.set_status("Browse for Themes needs the desktop app for now".to_string());
                }''', '                self.pick_and_insert("theme", "design.browseTheme");')
replace(lib, '''                if self.services.pick_open.is_some() {
                    self.pick_and_insert("open", "review.compare");
                } else {
                    // The browser's asynchronous picker would open the file as a new document.
                    self.set_status("Compare needs the desktop app for now".to_string());
                }''', '                self.pick_and_insert("open", "review.compare");')
replace(lib, '        if self.services.pick_open.is_some() {\n            self.pick_and_insert("audio", "transition.sound");\n        }', '        self.pick_and_insert("audio", "transition.sound");')
replace(lib, '    fn pick_and_reuse(&mut self, keep: bool) {', '    fn pick_and_reuse(&mut self, keep: bool) {\n        if self.services.open_async.is_some() {\n            self.pick_and_run("open", "slide.reuse", &json!({"keepFormatting": keep}));\n            return;\n        }')
# Picture fills consume `picture`, while media insertions consume `data`.
replace(lib, '        let result = if cmd == "file.openBytes" || self.viewing_target(&req.target) {', '''        if matches!(cmd, "shape.fill" | "design.background") {
            params["picture"] = params["data"].clone();
        }
        let result = if cmd == "file.openBytes" || self.viewing_target(&req.target) {''')
panes = ui / "panes.rs"
replace(panes, 'fn pick_fill_picture(app: &mut SlideApp) {', '''fn pick_fill_picture(app: &mut SlideApp) {
    if app.services.open_async.is_some() {
        let ids = app.session.active().map(|d| d.selection.shapes.clone()).unwrap_or_default();
        if !ids.is_empty() { app.pick_and_run("picture", "shape.fill", &json!({"ids": ids})); }
        return;
    }''')
replace(panes, 'fn pick_fill_picture(app: &mut SlideApp) {', 'pub(crate) fn pick_fill_picture(app: &mut SlideApp) {')
replace(panes, '''                "picture" => {
                    if let Some(pick)''', '''                "picture" => {
                    if app.services.open_async.is_some() {
                        app.pick_and_insert("picture", "design.background");
                    } else if let Some(pick)''')
replace(panes, '''            if ui.button("Insert picture from file…").clicked()
                && let Some(pick)''', '''            #[cfg(target_arch = "wasm32")]
            if ui.button("Insert picture from file…").clicked() {
                app.pick_and_insert("picture", "design.background");
            }
            #[cfg(not(target_arch = "wasm32"))]
            if ui.button("Insert picture from file…").clicked()
                && let Some(pick)''')
ribbon = ui / "ribbon.rs"
replace(ribbon, 'let desktop = app.services.pick_open.is_some();', 'let desktop = app.services.pick_open.is_some() || app.services.open_async.is_some();')
replace(ribbon, 'let can_pick = app.services.pick_open.is_some();', 'let can_pick = app.services.pick_open.is_some() || app.services.open_async.is_some();')
# Reuse the bounded OPC reader, rejecting unsupported macro data before it can be discarded.
opc = source / "crates/pptx/src/opc.rs"
replace(opc, '        for i in 0..zip.len() {', '''        if zip.file_names().any(|name| name.rsplit('/').next().is_some_and(|part| part.eq_ignore_ascii_case("vbaProject.bin"))) {
            return Err(PptxError::Unsupported("Macro-enabled presentations are not supported".into()));
        }
        for i in 0..zip.len() {''')
replace(opc, '        Ok(Package { parts })', '''        let package = Package { parts };
        if let Some(types) = package.xml("[Content_Types].xml") {
            if types.root.children_named("Override").chain(types.root.children_named("Default")).any(|part| {
                part.attr("ContentType").is_some_and(|kind| {
                    let kind = kind.to_ascii_lowercase();
                    kind.contains("macroenabled") || kind.contains("vbaproject")
                })
            }) {
                return Err(PptxError::Unsupported("Macro-enabled presentations are not supported".into()));
            }
        }
        Ok(package)''')
shutil.copyfile(suite / "src/deck-import-tests.rs", ui / "studio_import_tests.rs")
replace(lib, 'pub mod animtimeline;', 'pub mod animtimeline;\n#[cfg(test)]\nmod studio_import_tests;')
shutil.copyfile(suite / "src/deck-macro-tests.rs", source / "crates/pptx/src/studio_macro_tests.rs")
replace(source / "crates/pptx/src/lib.rs", 'mod cfb;', 'mod cfb;\n#[cfg(test)]\nmod studio_macro_tests;')
dialogs = ui / "dialogs.rs"
replace(dialogs, 'fn photo_album_dialog(app: &mut SlideApp, ui: &mut Ui, d: &mut Dialog) -> bool {', 'fn photo_album_dialog(app: &mut SlideApp, ui: &mut Ui, d: &mut Dialog) -> bool {\n    #[cfg(target_arch = "wasm32")]\n    crate::studio_io::poll_album(app, d);')
replace(dialogs, '            if ui.button("Add Pictures…").clicked()\n                && let Some(item) = pick_album_picture(app)', '            #[cfg(target_arch = "wasm32")]\n            if ui.button("Add Pictures…").clicked() { crate::studio_io::pick_album(d, ui.ctx()); }\n            #[cfg(not(target_arch = "wasm32"))]\n            if ui.button("Add Pictures…").clicked()\n                && let Some(item) = pick_album_picture(app)')
old = '''                        app.save();
                        // In the browser a save is a download: the presentation stays "unsaved".
                        let web = app.services.pick_save.is_none() && app.services.download.is_some();
                        if web || app.session.active().is_some_and(|d| !d.is_dirty()) {
                            run(app, "file.close", json!({}));
                        }'''
replace(dialogs, old, '''                        #[cfg(target_arch = "wasm32")]
                        crate::studio_io::save(app, "deckcraft", true);
                        #[cfg(not(target_arch = "wasm32"))]
                        {
                            app.save();
                            if app.session.active().is_some_and(|d| !d.is_dirty()) {
                                run(app, "file.close", json!({}));
                            }
                        }''')
# The modified distribution must not ship the restricted ArtCraft marks.
text = dialogs.read_text()
start = text.index('pub fn paint_logo(')
end = text.index('\n/// The selection', start)
text = text[:start] + '''pub fn paint_logo(p: &egui::Painter, r: Rect) {
    p.text(r.center(), egui::Align2::CENTER_CENTER, "D", egui::FontId::proportional(r.height() * 0.6), Color32::WHITE);
}
''' + text[end:]
dialogs.write_text(text)
replace(ui / "backstage.rs", 'Join the ArtCraft community on Discord', 'Upstream DeckCraft community on Discord')
replace(ui / "backstage.rs", 'if web { "Download" } else { "Save" }', 'if web { "Save to document center" } else { "Save" }')
replace(ui / "backstage.rs", 'if web { "Download the file" } else { "Choose where to save" }', 'if web { "Choose a document-center destination" } else { "Choose where to save" }')
replace(ui / "backstage.rs", 'DeckCraft prints through a PDF: it downloads, ready to print from your browser or PDF viewer.', 'Save the PDF to the document center, then open it in a PDF viewer to print.')
manifest = source / "crates/ui-egui/Cargo.toml"
replace(manifest, 'js-sys = "0.3"', 'js-sys = "0.3"\nwasm-bindgen = "0.2"\nwasm-bindgen-futures = "0.4"')
webdir = source / "apps/deckcraft-web"
web = webdir / "src/web.rs"
text = web.read_text()
start = text.index('const PRESENTATION_EXTS:')
end = text.index('const CANVAS_ID:', start)
text = text[:start] + 'mod studio;\n\n' + text[end:]
text = text[:text.index('/// Web services:')] + (suite / "src/deck-web.rs").read_text()
start = text.index('        let dropped = ctx.input_mut(')
end = text.index('        self.app.logic(ctx);', start)
text = text[:start] + '        ctx.input_mut(|i| i.raw.dropped_files.clear());\n' + text[end:]
if text.count('        self.app.ui(ui);') != 1:
    raise RuntimeError("Unexpected DeckCraft web UI entry")
text = text.replace('        self.app.ui(ui);', '        self.app.ui(ui);\n        studio::dirty(self.app.session.documents().iter().any(|d| d.is_dirty()));')
web.write_text(text)
font_build = source / "crates/fonts/build.rs"
replace(font_build, '("BIZ UDPGothic", "Regular") | ("Inter", "Regular" | "Bold" | "Variable")', '("Noto Sans CJK TC", "Regular") | ("BIZ UDPGothic", "Regular") | ("Inter", "Regular" | "Bold" | "Variable")')
shutil.copyfile(suite / "src/studio.rs", ui / "studio.rs")
(webdir / "src/web").mkdir(exist_ok=True)
shutil.copyfile(suite / "src/studio.rs", webdir / "src/web/studio.rs")
shutil.copyfile(suite / "src/deck-save.rs", ui / "studio_io.rs")
replace(webdir / "index.html", '  <link data-trunk rel="icon" href="../../assets/app-icon/hicolor/32x32/apps/ai.storyteller.deckcraft.png" />', '  <script src="./runtime.mjs" type="module"></script>')
# These already locked dependencies are now also used by the UI's async adapter.
lock = source / "Cargo.lock"
text = lock.read_text()
start = text.index('name = "deckcraft-ui-egui"')
end = text.index('[[package]]', start)
entry = text[start:end]
if entry.count(' "toml",\n') != 1:
    raise RuntimeError("Unexpected DeckCraft UI lock entry")
text = text[:start] + entry.replace(' "toml",\n', ' "toml",\n "wasm-bindgen",\n "wasm-bindgen-futures",\n') + text[end:]
lock.write_text(text)
print("DeckCraft Studio storage prepared; upstream English interface retained")
