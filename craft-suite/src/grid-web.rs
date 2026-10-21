//! Studio document-center services for the browser shell.
use gridcraft_ui_egui::{Inbox, Services, SheetApp, studio_save::AsyncSaves};

#[path = "studio.rs"]
mod studio;

#[derive(Clone, Default)]
pub struct Bridge {
    saves: AsyncSaves,
    opened: std::sync::Arc<std::sync::Mutex<Vec<(String, Vec<u8>, String)>>>,
    errors: std::sync::Arc<std::sync::Mutex<Vec<String>>>,
}

impl Bridge {
    pub fn connect(&self, services: &mut Services, inbox: Inbox, ctx: egui::Context) {
        services.studio_saves = Some(self.saves.clone());
        services.studio_bind = Some(Box::new(|id, token| studio::bind(&id.to_string(), token)));
        services.studio_discard = Some(Box::new(studio::discard));
        let open_ctx = ctx.clone();
        let errors = self.errors.clone();
        let opened = self.opened.clone();
        services.open_async = Some(Box::new(move || {
            let opened = opened.clone();
            let errors = errors.clone();
            let ctx = open_ctx.clone();
            wasm_bindgen_futures::spawn_local(async move {
                match studio::open_document("spreadsheet").await {
                    Ok(Some(file)) => opened.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(file),
                    Ok(None) => {},
                    Err(error) => errors.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(error),
                }
                ctx.request_repaint();
            });
        }));
        let _ = inbox;
        let picture_ctx = ctx.clone();
        let errors = self.errors.clone();
        services.pick_picture_async = Some(Box::new(move |inbox| {
            pick("picture", inbox, picture_ctx.clone(), errors.clone());
        }));
        let errors = self.errors.clone();
        services.download = Some(Box::new(move |name, bytes| {
            let name = name.to_string();
            let bytes = bytes.to_vec();
            let ctx = ctx.clone();
            let errors = errors.clone();
            wasm_bindgen_futures::spawn_local(async move {
                if let Err(error) = studio::save(&name, &bytes).await {
                    if error != "CANCELLED" {
                        errors
                            .lock()
                            .unwrap_or_else(std::sync::PoisonError::into_inner)
                            .push(error);
                    }
                }
                ctx.request_repaint();
            });
        }));
    }

    pub fn sync(&self, app: &mut SheetApp, ctx: &egui::Context) {
        let opened = std::mem::take(&mut *self.opened.lock().unwrap_or_else(std::sync::PoisonError::into_inner));
        for (name, bytes, token) in opened {
            let params = serde_json::json!({"name": name, "base64": gridcraft_engine::io::base64_encode(&bytes), "studioSource": token});
            match app.run("file.open", params.clone()) {
                Ok(result) => { app.backstage = None; app.after_open(None, &result); },
                Err(error) if error.contains(gridcraft_engine::io::PASSWORD_REQUIRED) => app.open_dialog("openPassword", params),
                Err(error) => {
                    studio::discard(&token);
                    app.message = Some(("Open file".into(), error));
                },
            }
        }
        for mut ticket in self.saves.take_requests() {
            let saves = self.saves.clone();
            let ctx = ctx.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let outcome = match studio::save_document(&ticket.uid.to_string(), &ticket.name, &ticket.bytes, ticket.save_as, !ticket.full_fidelity).await {
                    Ok(name) => {
                        ticket.name = name;
                        Ok(())
                    }
                    Err(error) => Err(error),
                };
                saves.finish(ticket, outcome);
                ctx.request_repaint();
            });
        }
        let errors = std::mem::take(
            &mut *self
                .errors
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner),
        );
        if let Some(error) = errors.into_iter().next() {
            app.message = Some(("Document center".into(), error));
        }
        let ids = js_sys::Array::new();
        for doc in app.session.documents() { ids.push(&doc.uid.to_string().into()); }
        studio::forget(&ids);
        studio::dirty(
            app.session.documents().iter().any(|doc| doc.is_dirty())
                || app.editor.is_some()
                || app.text_box_editor.is_some(),
        );
    }
}

fn pick(
    purpose: &'static str,
    inbox: Inbox,
    ctx: egui::Context,
    errors: std::sync::Arc<std::sync::Mutex<Vec<String>>>,
) {
    wasm_bindgen_futures::spawn_local(async move {
        match studio::open(purpose).await {
            Ok(Some(file)) => inbox
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .push(file),
            Ok(None) => {}
            Err(error) => errors
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .push(error),
        }
        ctx.request_repaint();
    });
}
