use std::sync::{Arc, Mutex};
use crate::PdfCraftApp;
use pdfcraft_engine::DocId;

pub(crate) struct PendingSave {
    id: DocId,
    generation: u64,
    bytes: Arc<Vec<u8>>,
    after: Box<dyn FnOnce(&mut PdfCraftApp) + Send>,
    result: Arc<Mutex<Option<Result<String, String>>>>,
}

pub(crate) fn start_save(
    app: &mut PdfCraftApp, index: usize, id: DocId, name: &str, bytes: Arc<Vec<u8>>, save_as: bool,
    after: Box<dyn FnOnce(&mut PdfCraftApp) + Send>,
) -> bool {
    if app.studio_pending_save.is_some() { return false; }
    if !app.views.get(index).is_some_and(|view| view.id == id) { return false; }
    let Some(doc) = app.session.get(id) else { return false };
    let generation = doc.edit_generation();
    if let Err(error) = app.session.check_save(id, &bytes) {
        app.notify_error(error);
        return false;
    }
    let result = Arc::new(Mutex::new(None));
    let done = result.clone();
    let output = bytes.clone();
    let name = name.to_string();
    let ctx = app.ctx.clone();
    wasm_bindgen_futures::spawn_local(async move {
        let name = if name.to_ascii_lowercase().ends_with(".pdf") { name } else { format!("{name}.pdf") };
        let outcome = crate::studio::save_document(&id.0.to_string(), &name, &output, save_as, false).await;
        *done.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(outcome);
        if let Some(ctx) = ctx { ctx.request_repaint(); }
    });
    app.studio_pending_save = Some(PendingSave { id, generation, bytes, after, result });
    false
}

pub(crate) fn poll(app: &mut PdfCraftApp) {
    #[cfg(target_arch = "wasm32")]
    {
        let ids = js_sys::Array::new();
        for view in &app.views { ids.push(&view.id.0.to_string().into()); }
        crate::studio::forget(&ids);
    }
    let reads = std::mem::take(&mut app.studio_pending_reads);
    for read in reads {
        let result = read.result.lock().unwrap_or_else(std::sync::PoisonError::into_inner).take();
        match result {
            None => app.studio_pending_reads.push(read),
            Some(Ok(files)) if !files.is_empty() && app.still_pick_target(read.target) => (read.after)(app, files),
            Some(Ok(_)) => {},
            Some(Err(error)) if error == "CANCELLED" => {},
            Some(Err(error)) => app.notify_error(error),
        }
    }
    let pending = std::mem::take(&mut app.studio_pending_writes);
    for write in pending {
        let result = write.result.lock().unwrap_or_else(std::sync::PoisonError::into_inner).take();
        match result {
            None => app.studio_pending_writes.push(write),
            Some(Ok(())) => (write.after)(app),
            Some(Err(error)) if error == "CANCELLED" => {},
            Some(Err(error)) => app.notify_error(error),
        }
    }
    let result = app.studio_pending_save.as_ref().and_then(|pending| {
        pending.result.lock().unwrap_or_else(std::sync::PoisonError::into_inner).take()
    });
    let Some(result) = result else { return };
    let Some(pending) = app.studio_pending_save.take() else { return };
    match result {
        Ok(name) => {
            // Never rebase newer edits on an older uploaded snapshot or close a different tab.
            let Some(index) = app.views.iter().position(|view| view.id == pending.id) else { return };
            if !app.commit_typing_in(pending.id)
                || !app.session.get(pending.id).is_some_and(|doc| doc.edit_generation() == pending.generation)
            {
                app.notify("The saved copy is complete; newer changes remain unsaved.");
                return;
            }
            if let Err(error) = app.session.mark_saved(pending.id, pending.bytes, Some(name)) {
                app.notify_fmt("Couldn't save {name}: {e}", &[("name", "document"), ("e", &error.to_string())]);
                return;
            }
            if let Some(doc) = app.session.get(pending.id)
                && let Some(view) = app.views.get_mut(index)
            { view.document_changed(&doc.info); }
            if app.has_unsaved_work(index) { return; }
            (pending.after)(app);
        }
        Err(error) if error == "CANCELLED" => {}
        Err(error) => app.notify_fmt("Couldn't save {name}: {e}", &[("name", "document"), ("e", &error)]),
    }
}

type Files = Vec<(String, Vec<u8>)>;

pub(crate) struct PendingRead {
    target: Option<crate::files::PickTarget>,
    after: Box<dyn FnOnce(&mut PdfCraftApp, Files) + Send>,
    result: Arc<Mutex<Option<Result<Files, String>>>>,
}

pub(crate) fn read(
    app: &mut PdfCraftApp, purpose: &'static str, multiple: bool,
    target: Option<crate::files::PickTarget>,
    after: impl FnOnce(&mut PdfCraftApp, Files) + Send + 'static,
) {
    let result = Arc::new(Mutex::new(None));
    let done = result.clone();
    let ctx = app.ctx.clone();
    wasm_bindgen_futures::spawn_local(async move {
        let outcome = if multiple { crate::studio::open_many(purpose).await }
            else { crate::studio::open(purpose).await.map(|file| file.into_iter().collect()) };
        *done.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(outcome);
        if let Some(ctx) = ctx { ctx.request_repaint(); }
    });
    app.studio_pending_reads.push(PendingRead { target, after: Box::new(after), result });
}

pub(crate) struct PendingWrite {
    after: Box<dyn FnOnce(&mut PdfCraftApp) + Send>,
    result: Arc<Mutex<Option<Result<(), String>>>>,
}

pub(crate) fn write(
    app: &mut PdfCraftApp, files: Vec<(String, Arc<Vec<u8>>)>,
    after: impl FnOnce(&mut PdfCraftApp) + Send + 'static,
) {
    if files.is_empty() { return; }
    // NOTE(ceiling): A batch holds all output bytes; large jobs need streamed per-file receipts.
    let result = Arc::new(Mutex::new(None));
    let done = result.clone();
    let ctx = app.ctx.clone();
    wasm_bindgen_futures::spawn_local(async move {
        let outcome = crate::studio::save_many(&files).await;
        *done.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(outcome);
        if let Some(ctx) = ctx { ctx.request_repaint(); }
    });
    app.studio_pending_writes.push(PendingWrite { after: Box::new(after), result });
}
