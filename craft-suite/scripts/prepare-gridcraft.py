"""Apply the Studio integration to GridCraft v0.17.0."""
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
expected = {
    "crates/ui-egui/src/control.rs": "707e845170b50eddbfde2b8bc3eb996a6e4bc294c44b887e172bc7266168ce38",
    'apps/gridcraft-web/src/web.rs': '4a6411a7380055f5a03682917316729f763088ca25d3357032f785e80972e6d1',
    'crates/ui-egui/src/lib.rs': '3e8244639d4d4575c2d44547338c10f92ba09375bc1f36e4f6274d71bb11e9ce',
    'crates/ui-egui/src/backstage.rs': '1eaf0c15a8b387dd0e659de62f5f8f3ca718fb0e159cbc9aedb742f7fa59da65',
    'crates/ui-egui/src/dialogs.rs': 'e4eb60333fb4d5f4f26c4295c78c636d1eef511a0a4b332c9abc300bcbaa57e1',
    'crates/ui-egui/src/ribbon.rs': '10670d745f0c4bacbb7e5a273ace8df5a02d1fe182b66c62e313f34dd64072a0',
    'crates/ui-egui/src/theme.rs': '9e888c32e57e82baaf680fda02b619f600e81a9c4374c3ec7e16fb2ebab0ed01',
    'apps/gridcraft-web/index.html': 'b92b0a676c6b6e98b1a61f48024e007eb9045f8298cb9c9e8c1b0116cdfaeb13',
    'crates/ui-egui/src/services.rs': 'b2853b65102c1b67c7ef41fe2ffe515e97960f5faf7b448df4b4d644500551a1',
    'crates/ui-egui/src/app.rs': 'd98863561e3bb561683fa029fc44abf4469bbce19f41fbf152062fe017353190',
    'crates/ui-egui/src/app/commands.rs': 'd43d48f24a65c29efa39ba36d20a3225332a21c2fc8850d7fc98eeb64a7da818',
    'crates/ui-egui/src/app/files.rs': '4f3f3dbb6ac2fcd5fe93a1ff3072f02192b80bad99c682fa6e4be257cd42345d',
    'crates/ui-egui/src/app/quit.rs': 'f8bbd4727501101a36c82ef94ef8d22bccecf76153bfe2558855d091c09df54f',
    'crates/ui-egui/src/dialogs/show.rs': '1b5eb08223c3d9c5e18a5a2daaab4d51eef19ea8050fb3e2612db9ac6c1455bd',
    'crates/ui-egui/src/backstage/options.rs': '7460a5ac545c813e6bc876c50a7ae3ed6b6dab09db7fbfee8041529416847906',
    'crates/ui-egui/src/ribbon/title_bar.rs': 'adae16c2446caf8656aec607a980168ce2bfb8d0155ab0d92c5bdaba8bb9f6dd',
    'crates/ui-egui/src/theme/font_fallback.rs': '3c27ae87637711b58b17877d54e66c47d0007ce15488a381e851d312841fcecc',
}
for name, digest in expected.items():
    if hashlib.sha256((source / name).read_bytes()).hexdigest() != digest:
        raise RuntimeError(f'Expected unmodified GridCraft v0.17.0: {name}')


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
start = text.index('        // Host modes (`craft-web-host`):')
end = text.index('        let app_bridge = bridge.clone();', start)
text = text[:start] + '        let bridge = Some(crate::host::Bridge::default());\n' + text[end:]
start = text.index("                    // Follow the browser's language")
end = text.index('                    // Preferences from an earlier visit', start)
text = text[:start] + '                    app.ui.language = gridcraft_ui_egui::i18n::Language::Zh;\n' + text[end:]
start = text.index('                    if let Some(bridge) = &app_bridge {\n                        prefs.keep_user_name')
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
# The helper now also controls embedded window chrome; keep it and its structure checks.
assert text.index('fn query_param(key: &str)') < text.index('\nstruct WebShell')
start = text.index('fn mime_for(name: &str)')
text = text[:start]
text = text.replace('WebShell { app, inbox, bridge: app_bridge, prefs }', 'WebShell { app, bridge: app_bridge, prefs }')
text = text.replace('    inbox: Inbox,\n', '')
text = text.replace('let mut prefs = crate::prefs::PrefsSync::new', 'let prefs = crate::prefs::PrefsSync::new')
web.write_text(text)
shutil.copyfile(suite / 'src/grid-web.rs', web.parent / 'host.rs')
shutil.copyfile(suite / 'src/studio.rs', web.parent / 'studio.rs')
shutil.copyfile(suite / 'src/grid-save.rs', source / 'crates/ui-egui/src/studio_save.rs')
shutil.copyfile(suite / 'src/grid-studio-tests.rs', source / 'crates/ui-egui/src/studio_tests.rs')
# Exercise the exact queue code with the actual engine without building native GPU test tools.
queue = (suite / 'src/grid-save.rs').read_text().split('impl crate::SheetApp {')[0]
(source / 'crates/engine/tests/studio_grid_save.rs').write_text(queue)

patch('crates/ui-egui/src/lib.rs', [
    ('pub mod theme;', 'pub mod theme;\npub mod studio_save;\n#[cfg(test)]\nmod studio_tests;'),
])
patch('crates/ui-egui/src/services.rs', [
    ('pub struct Services {', 'pub struct Services {\n    pub studio_saves: Option<crate::studio_save::AsyncSaves>,'),
])
patch('crates/ui-egui/src/app/commands.rs', [
    ('    pub(super) fn alert(&mut self, e: String) {', '    pub(crate) fn alert(&mut self, e: String) {'),
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
])
patch('crates/ui-egui/src/app.rs', [
    ('    pub fn logic(&mut self, ctx: &egui::Context) {', '''    pub fn logic(&mut self, ctx: &egui::Context) {
        if let Some(saves) = self.services.studio_saves.clone() {
            for error in saves.poll(&mut self.session) { self.alert(error); }
        }'''),
])
patch('crates/ui-egui/src/app/files.rs', [
    ('            let _ = self.session.run("file.save", json!({}));', '            let _ = self.run("file.save", json!({}));'),
    ('        let autosave_due =\n', '        // NOTE(ceiling): Studio needs destination selection; enable AutoSave when the host provides a persistent authorized target.\n        let autosave_due = self.services.studio_saves.is_none() &&\n'),
    ('        } else if self.ui.autosave && dirty_xlsx {', '        } else if self.services.studio_saves.is_none() && self.ui.autosave && dirty_xlsx {'),
])

patch('crates/ui-egui/src/dialogs/show.rs', [
    ('                        let target = if path.is_empty() {', '                        let target = if path.is_empty() && app.services.studio_saves.is_some() {\n                            Some(format!("Copy.{fmt}"))\n                        } else if path.is_empty() {'),
    ('                            app.run_or_alert(id, json!({"path": t}));', '                            app.run_or_alert(id, json!({"path": t, "studioCopy": true}));'),
])
patch('crates/ui-egui/src/app/quit.rs', [
    ('                self.run_or_alert("file.save", json!({}));\n                if self.session.active()', '                self.run_or_alert("file.save", json!({"studioClose": true}));\n                if self.services.studio_saves.is_none() && self.session.active()'),
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

patch('crates/ui-egui/src/backstage/options.rs', [
    ('    if ui.checkbox(&mut autosave, lang.tr("Save .xlsx workbooks automatically after every change")).changed() {', '''    if app.services.studio_saves.is_some() {
        ui.label("AutoSave needs a persistent destination. Use Save to choose a document-center destination.");
    }
    if ui.add_enabled(app.services.studio_saves.is_none(), egui::Checkbox::new(&mut autosave, lang.tr("Save .xlsx workbooks automatically after every change"))).changed() {'''),
])

patch('crates/ui-egui/src/ribbon/title_bar.rs', [
    ('            if resp.on_hover_text(app.ui.language.tr("AutoSave: save after every change (workbooks saved to a file)")).clicked() {', '''            let tip = if app.services.studio_saves.is_some() { "AutoSave needs a persistent destination. Use Save to choose a document-center destination." } else { "AutoSave: save after every change (workbooks saved to a file)" };
            if resp.on_hover_text(app.ui.language.tr(tip)).clicked() && app.services.studio_saves.is_none() {'''),
])

patch('crates/ui-egui/src/theme/font_fallback.rs', [
    ('pub(super) fn load_fallback(_fonts: &mut FontDefinitions, _han: HanOrder) -> Vec<String> {\n    Vec::new()\n}', '''pub(super) fn load_fallback(fonts: &mut FontDefinitions, _han: HanOrder) -> Vec<String> {
    let key = "studio-cjk".to_string();
    fonts.font_data.insert(key.clone(), std::sync::Arc::new(egui::FontData::from_static(include_bytes!("../../studio-fonts/NotoSansCJKtc-Regular.otf"))));
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
