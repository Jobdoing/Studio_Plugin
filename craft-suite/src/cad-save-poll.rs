impl CadApp {
    pub(crate) fn settle_studio_saves(&mut self) {
        use cadcraft_engine::studio_save;
        for (request, result) in studio_save::take_finished() {
            let saved = studio_save::settle(&mut self.session, &request, &result);
            if self.studio_close == Some(request.uid) {
                self.studio_close = None;
                if saved && self.closing.as_ref().and_then(|closing| closing.asking) == Some(request.uid) {
                    self.answer_close(Choice::Discard);
                } else {
                    self.closing = None;
                }
            }
            if let Err(error) = result {
                if error != "CANCELLED" { self.open_failed(format!("Save failed: {error}")); }
            }
        }
    }
}
