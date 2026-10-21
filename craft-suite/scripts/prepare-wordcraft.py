"""Apply the reviewed Studio adapter to the pinned WordCraft source snapshot."""
import shutil
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
suite = Path(__file__).resolve().parents[1]
web = source / "apps/wordcraft-web/src/web.rs"
text = web.read_text()

def replace_once(old, new):
    global text
    if text.count(old) != 1:
        raise RuntimeError(f"Upstream source changed: {old[:70]}")
    text = text.replace(old, new)

start = text.index('            let dialog = if purpose == "picture" {')
end = text.index('\n        })),', start)
text = text[:start] + '''            let purpose = purpose.to_string();
            wasm_bindgen_futures::spawn_local(async move {
                match studio::open(&purpose).await {
                    Ok(Some(file)) => {
                        inbox.lock().unwrap_or_else(|e| e.into_inner()).push(file);
                        ctx.request_repaint();
                    }
                    Ok(None) => {}
                    Err(e) => log::error!("Studio open failed: {e}"),
                }
            });''' + text[end:]

start = text.index('fn download(saves: &AsyncSaves,')
end = text.index('\n/// The hidden iframe', start)
text = text[:start] + '''fn download(saves: &AsyncSaves, ctx: &egui::Context, path: &str, bytes: &[u8]) -> Result<(), String> {
    let ticket = saves.start();
    let saves = saves.clone();
    let ctx = ctx.clone();
    let name = path.to_string();
    let bytes = bytes.to_vec();
    wasm_bindgen_futures::spawn_local(async move {
        let outcome = match studio::save_named(&name, &bytes).await {
            Ok(filename) => { saves.filename(ticket, filename); SaveOutcome::Saved },
            Err(e) if e == "CANCELLED" => SaveOutcome::Cancelled,
            Err(e) => SaveOutcome::Failed(e),
        };
        saves.finish(ticket, outcome);
        ctx.request_repaint();
    });
    Ok(())
}
''' + text[end:]
replace_once('use std::cell::{Cell, RefCell};', 'use std::cell::Cell;\n#[allow(dead_code)]\n#[path = "studio.rs"]\nmod studio;')
replace_once('on_dirty: Some(Box::new(move |d| dirty.set(d))),', 'on_dirty: Some(Box::new(move |d| { dirty.set(d); studio::dirty(d); })),')
replace_once('        self.app.logic(ctx);', '        self.app.logic(ctx);\n        studio::dirty(self.app.session.dirty);')
replace_once('                    app.autosave = false;', '                    app.ui.language = "zh-hant".into();\n                    app.autosave = false;')
start = text.index('        let dropped = ctx.input_mut(|i| std::mem::take(&mut i.raw.dropped_files));')
end = text.index('        let msgs = ', start)
text = text[:start] + '        ctx.input_mut(|i| i.raw.dropped_files.clear());\n' + text[end:]
# The document center is the source for images/fonts too; local paste/font access is disabled.
replace_once('                    app.services.pasted = Some(pasted);', '                    app.services.pasted = None;')
replace_once('        load_system_fonts: Some(Box::new(move || {\n            load_system_fonts(font_ctx.clone(), font_messages.clone());\n        })),', '        load_system_fonts: None,')
replace_once('    let font_ctx = ctx.clone();\n    let font_messages = messages.clone();\n', '')
start = text.index('                    let pasted: Inbox = Inbox::default();')
end = text.index("                    // The browser's locale", start)
text = text[:start] + text[end:]
start = text.index('/// Largest picture pasted from the browser')
end = text.index('/// `dirty` is the flag', start)
text = text[:start] + text[end:]
start = text.index('/// Most local fonts one Load System Installed Fonts installs')
end = text.index('/// Whether the system has animation effects', start)
text = text[:start] + text[end:]
start = text.index('fn mime_for(')
text = text[:start]
text = '\n'.join(line for line in text.split('\n') if not line.startswith(('const DOC_EXTS:', 'const IMAGE_EXTS:', 'const RECIPIENT_EXTS:')))
replace_once('                    let messages = Rc::new(RefCell::new(Vec::new()));\n', '')
replace_once('services(inbox.clone(), cc.egui_ctx.clone(), dirty, saves.clone(), messages.clone())', 'services(inbox, cc.egui_ctx.clone(), dirty, saves.clone())')
replace_once('WebShell { app, inbox, messages }', 'WebShell { app }')
replace_once('    inbox: Inbox,\n    messages: Rc<RefCell<Vec<String>>>,\n', '')
start = text.index('        let msgs = std::mem::take(')
end = text.index('        self.app.logic(ctx);', start)
text = text[:start] + text[end:]
replace_once('saves: AsyncSaves, messages: Rc<RefCell<Vec<String>>>) -> Services', 'saves: AsyncSaves) -> Services')
web.write_text(text)
shutil.copyfile(suite / "src/studio.rs", web.parent / "studio.rs")
async_saves = source / "crates/ui-egui/src/async_saves.rs"
async_text = async_saves.read_text()
old = '    finished: Vec<(u64, SaveOutcome)>,\n'
assert async_text.count(old) == 1
async_text = async_text.replace(old, old + '    filenames: Vec<(u64, String)>,\n')
old = '    /// Saves started and not finished (the browser\'s leave-page guard warns while there are any).'
assert async_text.count(old) == 1
async_text = async_text.replace(old, '''    /// Record the document center's acknowledged filename for this pending save.
    pub fn filename(&self, ticket: u64, filename: String) {
        self.with(|s| {
            if s.pending.contains(&ticket) {
                s.filenames.push((ticket, filename));
            }
        });
    }

    pub(crate) fn take_filename(&self, ticket: u64) -> Option<String> {
        self.with(|s| s.filenames.iter().position(|(id, _)| *id == ticket)
            .map(|i| s.filenames.swap_remove(i).1))
    }

''' + old)
async_saves.write_text(async_text)
ui = source / "crates/ui-egui/src/lib.rs"
ui_text = ui.read_text()
old = '        for (ticket, outcome) in saves.take_finished() {\n'
assert ui_text.count(old) == 1
ui_text = ui_text.replace(old, old + '            let filename = saves.take_filename(ticket);\n')
old = '                    async_saves::SaveOutcome::Saved => log::info!("saved {} through the save picker", save.name),'
assert ui_text.count(old) == 1
ui_text = ui_text.replace(old, '''                    async_saves::SaveOutcome::Saved => {
                        if save.marked_saved && save.document == current
                            && let Some(filename) = filename
                        {
                            self.session.path = Some(filename.into());
                        }
                        log::info!("saved {} through the save picker", save.name);
                    },''')
test_anchor = '    const UNSAVED: &str = "My unsaved novel chapter";'
assert ui_text.count(test_anchor) == 1
ui_text = ui_text.replace(test_anchor, (suite / "src/word-save-tests.rs").read_text() + '\n' + test_anchor)
ui.write_text(ui_text)
fonts = source / "crates/fonts/build.rs"
font_source = fonts.read_text()
old = 'if wasm && !(*family == "BIZ UDPGothic" && *style == "Regular") {'
if font_source.count(old) != 1:
    raise RuntimeError("Upstream font build changed")
fonts.write_text(font_source.replace(old, 'if wasm && !(["BIZ UDPGothic", "Noto Sans CJK TC"].contains(family) && *style == "Regular") {'))
print("WordCraft Studio source adapter applied")
