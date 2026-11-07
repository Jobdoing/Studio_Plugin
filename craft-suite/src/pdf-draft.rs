use crate::{PdfCraftApp, content_ui::ContentView};
use pdfcraft_engine::{Added, DocId};

impl crate::comments::CommentView {
    pub(crate) fn has_studio_drafts(&self, info: Option<&pdfcraft_render::DocInfo>) -> bool {
        let contents = |page, index| {
            info.and_then(|info| {
                info.annotations
                    .iter()
                    .find(|annotation| annotation.page == page && annotation.index == index)
            })
            .and_then(|annotation| annotation.contents.as_deref())
            .unwrap_or("")
        };
        self.composer
            .as_ref()
            .is_some_and(|draft| match draft.kind {
                crate::comments::ComposerKind::Edit(index) => {
                    draft.text.trim_end() != contents(draft.page, index)
                }
                _ => !draft.text.trim().is_empty(),
            })
            || self
                .editing
                .as_ref()
                .is_some_and(|(page, index, text)| text != contents(*page, *index))
            || !self.reply.trim().is_empty()
            || !self.add_box.trim().is_empty()
    }
}

impl ContentView {
    pub(crate) fn has_unsaved_draft(&self, added: &[Added]) -> bool {
        // NOTE(ceiling): Detection materializes a draft edit; use a borrowed comparison if very large drafts become a bottleneck.
        let mut probe = Self::default();
        probe.draft = self.draft.clone();
        probe.finish_draft(added).is_some()
    }
}

impl PdfCraftApp {
    pub(crate) fn studio_has_bookmark_draft(&self, id: DocId) -> bool {
        self.studio_bookmark_owner == Some(id)
            && self.bookmark_rename.as_ref().is_some_and(|(path, text)| {
                self.session
                    .get(id)
                    .and_then(|doc| crate::editing::bookmark_at(&doc.info.outline, path))
                    .is_none_or(|bookmark| bookmark.title != *text)
            })
    }

    pub(crate) fn studio_commit_bookmark_draft(&mut self, id: DocId) -> bool {
        if self.studio_bookmark_owner != Some(id) {
            return true;
        }
        if self.active_ids().map(|(_, active)| active) != Some(id) {
            return false;
        }
        let changed = self.studio_has_bookmark_draft(id);
        if let Some((path, title)) = self.bookmark_rename.take() {
            if changed
                && !self.apply_edit(pdfcraft_engine::Edit::RenameBookmark {
                    path: path.clone(),
                    title: title.clone(),
                })
            {
                self.bookmark_rename = Some((path, title));
                return false;
            }
        }
        self.studio_bookmark_owner = None;
        true
    }

    pub(crate) fn studio_commit_comment_drafts(&mut self, id: DocId) -> bool {
        let Some((index, active)) = self.active_ids() else {
            return false;
        };
        if active != id {
            return false;
        }
        let Some(doc) = self.session.get(id) else {
            return false;
        };
        if !self.views[index]
            .comments
            .has_studio_drafts(Some(&doc.info))
        {
            return true;
        }
        let comments = &self.views[index].comments;
        let exists = |page, index| {
            doc.info
                .annotations
                .iter()
                .any(|annotation| annotation.page == page && annotation.index == index)
        };
        let stale_inline = comments
            .editing
            .as_ref()
            .is_some_and(|(page, index, _)| !exists(*page, *index));
        let stale_composer = comments
            .composer
            .as_ref()
            .is_some_and(|draft| match draft.kind {
                crate::comments::ComposerKind::Edit(index) => !exists(draft.page, index),
                crate::comments::ComposerKind::Replace => comments.replace.is_none(),
                _ => false,
            });
        let stale_reply = !comments.reply.trim().is_empty()
            && !comments
                .selected
                .is_some_and(|(page, index)| exists(page, index));
        if stale_inline || stale_composer || stale_reply {
            self.notify("The comment being edited is no longer available. Keep or cancel its draft before saving.");
            return false;
        }
        let original = self.views[index].comments.clone();
        let view = &mut self.views[index];
        let mut edits = Vec::new();
        if view.comments.composer.as_ref().is_some_and(|draft| {
            !draft.text.trim().is_empty()
                || matches!(draft.kind, crate::comments::ComposerKind::Edit(_))
        }) {
            edits.extend(crate::comments::finish_composer(
                view,
                &doc.info,
                &self.comment_prefs,
            ));
        }
        edits.extend(crate::comments_panel::finish_inline_comment(view));
        if let Some((page, index)) = view.comments.selected {
            if let Some(annotation) = doc
                .info
                .annotations
                .iter()
                .find(|annotation| annotation.page == page && annotation.index == index)
            {
                edits.extend(crate::comments_panel::finish_reply(
                    view,
                    annotation,
                    &self.comment_prefs,
                ));
            }
        }
        edits.extend(crate::comments_panel::finish_add_box(
            view,
            &doc.info,
            &self.comment_prefs,
        ));
        if !edits.is_empty()
            && !self.apply_edit(pdfcraft_engine::Edit::Batch {
                label: "Commit comment drafts".into(),
                edits,
            })
        {
            self.views[index].comments = original;
            return false;
        }
        true
    }

}
