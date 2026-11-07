//! Studio is the only file host; every opened source is bound or explicitly discarded.
use cadcraft_ui_egui::CadApp;
use cadcraft_engine::studio_save;
use std::{cell::RefCell, rc::Rc};

#[derive(Clone)]
pub struct Inbox {
    files: Rc<RefCell<Vec<(String, Vec<u8>, String)>>>,
    ctx: egui::Context,
}

impl Inbox {
    pub fn new(ctx: &egui::Context) -> Self { Self { files: Default::default(), ctx: ctx.clone() } }

    pub fn pick(&self) {
        let inbox = self.clone();
        wasm_bindgen_futures::spawn_local(async move {
            match crate::studio::open_document("drawing").await {
                Ok(Some(file)) => inbox.files.borrow_mut().push(file),
                Ok(None) => {},
                Err(error) => log::error!("Studio open failed: {error}"),
            }
            inbox.ctx.request_repaint();
        });
    }

    pub fn drain(&self, app: &mut CadApp) {
        for (name, bytes, token) in std::mem::take(&mut *self.files.borrow_mut()) {
            if name.to_ascii_lowercase().ends_with(".shx") {
                match cadcraft_fonts::shx::register(&name, &bytes) {
                    Ok(()) => { let _ = app.run("regenall", serde_json::json!({})); },
                    Err(error) => app.open_failed(error.to_string()),
                }
                crate::studio::discard(&token);
                continue;
            }
            let previous = app.session.docs.len();
            app.open_bytes(&name, &bytes);
            if app.session.docs.len() > previous {
                let doc = &mut app.session.docs[previous];
                doc.path = Some(name);
                crate::studio::bind(&doc.uid.to_string(), &token);
            } else {
                crate::studio::discard(&token);
            }
        }
        for request in studio_save::take_requests() {
            let ctx = self.ctx.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let result = crate::studio::save_document(&request.uid.to_string(), &request.name, &request.bytes, request.save_as, request.copy).await;
                studio_save::finish(request, result);
                ctx.request_repaint();
            });
        }
        let ids = js_sys::Array::new();
        for doc in &app.session.docs { ids.push(&doc.uid.to_string().into()); }
        crate::studio::forget(&ids);
        crate::studio::dirty(studio_save::busy() || app.session.docs.iter().any(|doc| doc.is_dirty()));
    }
}

/// Exports use confirmed Studio copies and never change the drawing's source or clean state.
pub fn deliver(name: &str, _mime: &str, bytes: &[u8]) -> Result<(), String> {
    let (name, bytes) = (name.to_string(), bytes.to_vec());
    wasm_bindgen_futures::spawn_local(async move {
        if let Err(error) = crate::studio::save(&name, &bytes).await { log::error!("Studio export failed: {error}"); }
    });
    Ok(())
}
