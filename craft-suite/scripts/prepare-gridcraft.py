"""Apply the Studio integration to GridCraft v0.9.0 / a2cc4b42."""
import shutil
import sys
import hashlib
from pathlib import Path

source = Path(sys.argv[1]).resolve()
suite = Path(__file__).resolve().parents[1]
font_dir = Path(sys.argv[2]).resolve()
for name, digest in {
    'fonts/NotoSansCJKtc-Regular.otf': 'dce08bd4fd91aa8aa76ed8fea4b694c2dfb8550f67871e326843212ddbeb88b4',
    'OFL.txt': '6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2',
}.items():
    if hashlib.sha256((font_dir / name).read_bytes()).hexdigest() != digest:
        raise RuntimeError(f'Unexpected pinned Noto CJK font input: {name}')

# Reject a different upstream tree before changing any file, including sliced rewrites.
expected = {'apps/gridcraft-web/src/web.rs': '9afd607079d4aad3d4a5f8c9639cebbdb2ed9814a75bbd154ab9ef1f146a341c', 'crates/ui-egui/src/lib.rs': 'db8a3febf1c41e7ef7e94085074f21c3f8e1a1e4ebf6f4dfb86dfc1d7c6c189b', 'crates/ui-egui/src/backstage.rs': '8bf1e14ef13054d4cd0893c2d37bbdb616aefff95b2a6f3df206662dc75cae3e', 'crates/ui-egui/src/dialogs.rs': '617f673ba0d346f6891e860c63e0dac1ddd433e1c684de27ed17890f8e758ad2', 'crates/ui-egui/src/ribbon.rs': 'c048dabff7497f11ae3a575e289b53ed07b14e2bce0c9a2be8084b11f2b76b5b', 'crates/ui-egui/src/theme.rs': '88c6533fab5b3e92f1f7bbbebcac9099538f94f3ac5d7edf2ebc309da2064935', 'apps/gridcraft-web/index.html': '1e80e32656f8a2af606c60df9858f35f31d3184033eecd618112404538b47bf9'}
for name, digest in expected.items():
    if hashlib.sha256((source / name).read_bytes()).hexdigest() != digest:
        raise RuntimeError(f'Expected unmodified GridCraft v0.9.0: {name}')


def patch(path, changes):
    file = source / path
    text = file.read_text()
    for old, new in changes:
        if text.count(old) != 1:
            raise RuntimeError(f"Upstream source changed: {path}: {old[:70]}")
        text = text.replace(old, new)
    file.write_text(text)


web = source / "apps/gridcraft-web/src/web.rs"
text = web.read_text()
text = text.replace('use wasm_bindgen::JsValue;\n', '')
start = text.index('        // `?host=parent`:')
end = text.index('        let app_bridge = bridge.clone();', start)
text = text[:start] + '        let bridge = Some(crate::host::Bridge::default());\n' + text[end:]
start = text.index("                    // Follow the browser's language")
end = text.index('                    SheetApp::setup_context_for_language', start)
text = text[:start] + '                    app.ui.language = gridcraft_ui_egui::i18n::Language::Zh;\n' + text[end:]
start = text.index('                    if let Some(bridge) = &app_bridge {\n                        if let Some(author)')
end = text.index('                    Ok(Box::new', start)
text = text[:start] + text[end:]
start = text.index('        if let (Err(e), Some(bridge))')
end = text.index('        if let Some(el)', start)
text = text[:start] + text[end:]
start = text.index('        let dropped = ctx.input_mut')
end = text.index('        self.app.logic(ctx);', start)
text = text[:start] + '        ctx.input_mut(|i| i.raw.dropped_files.clear());\n' + text[end:]
text = text.replace('            bridge.sync(&mut self.app);', '            bridge.sync(&mut self.app, ui.ctx());')
# Studio replaces all storage services below. Keep clipboard, print and URL behavior.
start = text.index('        open_async: Some(Box::new')
end = text.index('        print: Some(Box::new', start)
text = text[:start] + text[end:]
text = text.replace('    let open_inbox = inbox.clone();\n    let picture_ctx = ctx.clone();\n', '')
text = text.replace('fn services(inbox: Inbox, ctx: egui::Context)', 'fn services(inbox: Inbox, _ctx: egui::Context)')
start = text.index('/// Trigger a browser save dialog')
text = text[:start]
start = text.index('fn query_param(key: &str)')
end = text.index('\nstruct WebShell', start)
text = text[:start] + text[end:]
start = text.index('fn mime_for(name: &str)')
text = text[:start]
text = text.replace('WebShell { app, inbox, bridge: app_bridge }', 'WebShell { app, bridge: app_bridge }')
text = text.replace('    inbox: Inbox,\n', '')
web.write_text(text)
shutil.copyfile(suite / 'src/grid-web.rs', web.parent / 'host.rs')
shutil.copyfile(suite / 'src/studio.rs', web.parent / 'studio.rs')
shutil.copyfile(suite / 'src/grid-save.rs', source / 'crates/ui-egui/src/studio_save.rs')
# Exercise the exact queue code with the actual engine without building native GPU test tools.
queue = (suite / 'src/grid-save.rs').read_text().split('impl crate::SheetApp {')[0]
(source / 'crates/engine/tests/studio_grid_save.rs').write_text(queue)

patch('crates/ui-egui/src/lib.rs', [
    ('pub mod theme;', 'pub mod theme;\npub mod studio_save;'),
    ('pub struct Services {', 'pub struct Services {\n    pub studio_saves: Option<studio_save::AsyncSaves>,'),
    ('        if let Some(r) = self.run_ui_command(id, &params) {', '''        if self.services.studio_saves.is_some() && matches!(id, "file.save" | "file.saveAs") {
            return self.save_to_studio(params.get("path").and_then(Json::as_str), params.get("studioClose").and_then(Json::as_bool).unwrap_or(false), params.get("studioCopy").and_then(Json::as_bool).unwrap_or(false));
        }
        if self.services.studio_saves.is_some() && matches!(id, "file.exportCsv" | "file.exportHtml") {
            let ext = if id == "file.exportCsv" { "csv" } else { "html" };
            let name = params.get("path").and_then(Json::as_str).unwrap_or("Copy");
            let name = std::path::Path::new(name).with_extension(ext).to_string_lossy().into_owned();
            return self.save_to_studio(Some(&name), false, true);
        }
        if self.services.studio_saves.is_some() && id == "file.open" && params.get("path").is_some() {
            self.open_dialog("open", json!({}));
            return Ok(json!({"pending": true}));
        }
        if let Some(r) = self.run_ui_command(id, &params) {'''),
    ('            "saveAs" => {\n                let suggested', '''            "saveAs" if self.services.studio_saves.is_some() => {
                if let Err(error) = self.save_to_studio(None, false, false) { self.alert(error); }
            }
            "saveAs" => {
                let suggested'''),
    ('    pub fn logic(&mut self, ctx: &egui::Context) {', '''    pub fn logic(&mut self, ctx: &egui::Context) {
        if let Some(saves) = self.services.studio_saves.clone() {
            for error in saves.poll(&mut self.session) { self.alert(error); }
        }'''),
    ('            let _ = self.session.run("file.save", json!({}));', '            let _ = self.run("file.save", json!({}));'),
    ('        if self.grid.autosave\n', '        // NOTE(ceiling): Studio needs destination selection; enable AutoSave when the host provides a persistent authorized target.\n        if self.services.studio_saves.is_none() && self.grid.autosave\n'),
])

patch('crates/ui-egui/src/dialogs.rs', [
    ('                        let target = if path.is_empty() { app.services.pick_save.as_ref().and_then(|f| f(&format!("Copy.{fmt}"))) } else { Some(path) };', '                        let target = if path.is_empty() && app.services.studio_saves.is_some() { Some(format!("Copy.{fmt}")) } else if path.is_empty() { app.services.pick_save.as_ref().and_then(|f| f(&format!("Copy.{fmt}"))) } else { Some(path) };'),
    ('                            app.run_or_alert(id, json!({"path": t}));', '                            app.run_or_alert(id, json!({"path": t, "studioCopy": true}));'),
    ('                            app.run_or_alert("file.save", json!({}));\n                            if app.session.active()', '                            app.run_or_alert("file.save", json!({"studioClose": true}));\n                            if app.services.studio_saves.is_none() && app.session.active()'),
])

patch('crates/ui-egui/src/backstage.rs', [
    ('    let label = if web {', '    let label = if web && app.services.studio_saves.is_none() {'),
    ('    let id = match fmt {\n        "pdf" =>', '''    if app.services.studio_saves.is_some() && fmt != "pdf" {
        let title = app.session.active().map(|d| d.display_title()).unwrap_or_else(|| "Book".into());
        let stem = std::path::Path::new(&title).file_stem().and_then(|s| s.to_str()).unwrap_or("Book");
        return match app.save_to_studio(Some(&format!("{stem}.{fmt}")), false, true) {
            Ok(_) => true,
            Err(error) => { app.alert(error); false }
        };
    }
    let id = match fmt {
        "pdf" =>'''),
])

patch('crates/ui-egui/src/backstage.rs', [
    ('    if ui.checkbox(&mut autosave, lang.tr("Save .xlsx workbooks automatically after every change")).changed() {', '''    if app.services.studio_saves.is_some() {
        ui.label("AutoSave needs a persistent destination. Use Save to choose a document-center destination.");
    }
    if ui.add_enabled(app.services.studio_saves.is_none(), egui::Checkbox::new(&mut autosave, lang.tr("Save .xlsx workbooks automatically after every change"))).changed() {'''),
])

patch('crates/ui-egui/src/ribbon.rs', [
    ('            if resp.on_hover_text("AutoSave: save after every change (workbooks saved to a file)").clicked() {', '''            let tip = if app.services.studio_saves.is_some() { "AutoSave needs a persistent destination. Use Save to choose a document-center destination." } else { "AutoSave: save after every change (workbooks saved to a file)" };
            if resp.on_hover_text(tip).clicked() && app.services.studio_saves.is_none() {'''),
])

patch('crates/ui-egui/src/theme.rs', [
    ('fn load_fallback(_fonts: &mut FontDefinitions, _han: HanOrder) -> Vec<String> {\n    Vec::new()\n}', '''fn load_fallback(fonts: &mut FontDefinitions, _han: HanOrder) -> Vec<String> {
    let key = "studio-cjk".to_string();
    fonts.font_data.insert(key.clone(), Arc::new(FontData::from_static(include_bytes!("../studio-fonts/NotoSansCJKtc-Regular.otf"))));
    vec![key]
}'''),
])
fonts = source / 'crates/ui-egui/studio-fonts'
fonts.mkdir(exist_ok=True)
shutil.copyfile(font_dir / 'fonts/NotoSansCJKtc-Regular.otf', fonts / 'NotoSansCJKtc-Regular.otf')
shutil.copyfile(font_dir / 'OFL.txt', fonts / 'OFL.txt')

# The app icon is original MIT/Apache geometry, not the restricted ArtCraft brand.
patch('apps/gridcraft-web/index.html', [
    ('<html lang="en">', '<html lang="zh-Hans">'),
])
print('GridCraft Studio adapter applied')
