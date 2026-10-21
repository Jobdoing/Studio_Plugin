fn services(inbox: Inbox, ctx: egui::Context) -> Services {
    let open_inbox = inbox.clone();
    Services {
        open_async: Some(Box::new(move |purpose: &str, request: u64| {
            let inbox = open_inbox.clone();
            let ctx = ctx.clone();
            let purpose = match purpose { "open" => "presentation", "theme" => "deck-theme", other => other }.to_owned();
            wasm_bindgen_futures::spawn_local(async move {
                if purpose == "presentation" {
                    let event = match studio::open_document(&purpose).await {
                        Ok(Some((name, bytes, token))) => {
                            deckcraft_ui_egui::studio_io::remember_open(request, token);
                            InboxEvent::File(InboxFile { id: request, name, bytes })
                        },
                        Ok(None) => InboxEvent::Cancelled { id: request },
                        Err(error) => { log::error!("Open failed: {error}"); InboxEvent::Cancelled { id: request } },
                    };
                    push_inbox(&inbox, event);
                    ctx.request_repaint();
                    return;
                }
                let event = match studio::open(&purpose).await {
                    Ok(Some((name, bytes))) => InboxEvent::File(InboxFile { id: request, name, bytes }),
                    Ok(None) => InboxEvent::Cancelled { id: request },
                    Err(e) => {
                        log::error!("Document-center open failed: {e}");
                        InboxEvent::Cancelled { id: request }
                    }
                };
                push_inbox(&inbox, event);
                ctx.request_repaint();
            });
        })),
        download: Some(Box::new(deckcraft_ui_egui::studio_io::export)),
        inbox: Some(inbox),
        ..Default::default()
    }
}

fn push_inbox(inbox: &Inbox, event: InboxEvent) {
    inbox.lock().unwrap_or_else(|e| e.into_inner()).push(event);
}
