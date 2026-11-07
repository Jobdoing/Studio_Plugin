use super::*;

#[test]
fn traditional_chinese_locale_selection_and_preference_round_trip() {
    for locale in ["zh-Hant", "zh-TW", "zh_HK.UTF-8", "zh-MO", "zh-Hant-CN"] {
        assert_eq!(Language::from_locale(locale), Language::ZhHant, "{locale}");
    }
    for locale in ["", "en-US", "zh", "zh-CN", "zh-Hans-TW"] {
        assert_eq!(Language::from_locale(locale), Language::En, "{locale}");
    }
    assert_eq!(Language::System.resolve(Some("zh-TW")), Language::ZhHant);
    assert_eq!(Language::En.resolve(Some("zh-TW")), Language::En);
    let old: crate::UiState = serde_json::from_str("{}").unwrap();
    assert_eq!(old.interface_language, Language::System);
    let mut state = old;
    state.interface_language = Language::ZhHant;
    let restored: crate::UiState = serde_json::from_str(&serde_json::to_string(&state).unwrap()).unwrap();
    assert_eq!(restored.interface_language, Language::ZhHant);
}

#[test]
fn language_changes_preserve_document_data_and_command_identifiers() {
    let mut app = crate::SlideApp::new(deckcraft_engine::Session::new(), crate::Services::default());
    app.run("file.new", serde_json::json!({})).unwrap();
    app.run("insert.textBox", serde_json::json!({"text": "File {customer} 測試", "rect": [1, 2, 100, 40]})).unwrap();
    let before = serde_json::to_value(&app.session.active().unwrap().doc).unwrap();
    let ids: Vec<_> = app.session.commands().into_iter().map(|command| command.id).collect();
    for language in ["zh-hant", "en", "zh-TW"] {
        app.run("app.language", serde_json::json!({"language": language})).unwrap();
        assert_eq!(before, serde_json::to_value(&app.session.active().unwrap().doc).unwrap());
        assert_eq!(ids, app.session.commands().into_iter().map(|command| command.id).collect::<Vec<_>>());
        assert_eq!(app.ui.tab, "Home");
    }
    assert_eq!(tr("Paste"), "貼上");
    assert_eq!(tr_context("Home", "@ribbon:Home"), "常用");
    assert_eq!(format("Saved {path}", &["File {customer}.pptx".to_string()]), "已儲存 File {customer}.pptx");
    assert_eq!(tr("User File {customer} 測試"), "User File {customer} 測試");
    assert!(app.run("app.language", serde_json::json!({"language": "unsupported"})).is_err());
    set_current(Language::En);
}

#[test]
fn traditional_chinese_catalog_is_unique_and_preserves_placeholders() {
    let fields =
        |text: &str| -> Vec<String> { text.split('{').skip(1).filter_map(|part| part.split_once('}').map(|(name, _)| name.to_string())).collect() };
    let mut seen = std::collections::HashSet::new();
    for line in CATALOG.lines().filter(|line| !line.is_empty() && !line.starts_with('#')) {
        let (key, value) = line.split_once('\t').unwrap();
        assert!(seen.insert(key), "duplicate key: {key}");
        assert!(!value.trim().is_empty(), "empty translation: {key}");
        assert_eq!(fields(key), fields(value), "{key}");
    }
}

#[test]
fn translated_catalog_covers_current_commands_menus_and_shape_gallery() {
    let mut required: Vec<_> = crate::UI_COMMANDS.iter().map(|command| command.1).collect();
    required.extend(deckcraft_engine::Session::new().commands().into_iter().map(|command| command.label));
    for (name, entries) in crate::menus::menu_tree() {
        required.push(name);
        required.extend(entries.into_iter().filter(|(label, _)| *label != "-").map(|(label, _)| label));
    }
    required.extend(deckcraft_geom::preset::CATALOG.iter().map(|shape| shape.label));
    let missing: Vec<_> = required.into_iter().filter(|key| !catalog().contains_key(*key)).collect();
    assert!(missing.is_empty(), "missing interface labels: {missing:?}");
}

#[test]
fn every_explicit_literal_translation_has_a_catalog_entry() {
    for source in [
        include_str!("app.rs"),
        include_str!("app/clipboard.rs"),
        include_str!("app/commands.rs"),
        include_str!("app/control.rs"),
        include_str!("app/files.rs"),
        include_str!("app/frame.rs"),
        include_str!("app/ime.rs"),
        include_str!("app/input.rs"),
        include_str!("app/keys.rs"),
        include_str!("app/playback.rs"),
        include_str!("backstage.rs"),
        include_str!("backstage/files.rs"),
        include_str!("backstage/info.rs"),
        include_str!("backstage/print.rs"),
        include_str!("canvas.rs"),
        include_str!("canvas/context_menu.rs"),
        include_str!("canvas/guides.rs"),
        include_str!("canvas/ime.rs"),
        include_str!("canvas/input.rs"),
        include_str!("canvas/media.rs"),
        include_str!("canvas/overlays.rs"),
        include_str!("canvas/preview.rs"),
        include_str!("canvas/rulers.rs"),
        include_str!("canvas/scroll.rs"),
        include_str!("canvas/squiggles.rs"),
        include_str!("capture.rs"),
        include_str!("clock.rs"),
        include_str!("control.rs"),
        include_str!("dialogs.rs"),
        include_str!("dialogs/about.rs"),
        include_str!("dialogs/alt_text.rs"),
        include_str!("dialogs/body.rs"),
        include_str!("dialogs/columns.rs"),
        include_str!("dialogs/credits.rs"),
        include_str!("dialogs/date_time.rs"),
        include_str!("dialogs/equation.rs"),
        include_str!("dialogs/export.rs"),
        include_str!("dialogs/find.rs"),
        include_str!("dialogs/font.rs"),
        include_str!("dialogs/grid_options.rs"),
        include_str!("dialogs/hyperlink.rs"),
        include_str!("dialogs/language.rs"),
        include_str!("dialogs/paragraph.rs"),
        include_str!("dialogs/photo_album.rs"),
        include_str!("dialogs/preferences.rs"),
        include_str!("dialogs/size_position.rs"),
        include_str!("dialogs/slide_size.rs"),
        include_str!("dialogs/tabs.rs"),
        include_str!("dialogs/theme_colors.rs"),
        include_str!("dialogs/theme_fonts.rs"),
        include_str!("dialogs/trim.rs"),
        include_str!("dialogs/updates_ui.rs"),
        include_str!("dialogs/zoom.rs"),
        include_str!("doc_window.rs"),
        include_str!("eyedropper.rs"),
        include_str!("gpu_lock.rs"),
        include_str!("icons.rs"),
        include_str!("icons/draw.rs"),
        include_str!("icons/geometry.rs"),
        include_str!("ime_hooks.rs"),
        include_str!("lib.rs"),
        include_str!("media.rs"),
        include_str!("menus.rs"),
        include_str!("opening.rs"),
        include_str!("panels.rs"),
        include_str!("panels/animation.rs"),
        include_str!("panels/animtimeline.rs"),
        include_str!("panels/background.rs"),
        include_str!("panels/comments.rs"),
        include_str!("panels/designer.rs"),
        include_str!("panels/effect_presets.rs"),
        include_str!("panels/fillui.rs"),
        include_str!("panels/format_shape.rs"),
        include_str!("panels/notes.rs"),
        include_str!("panels/selpane.rs"),
        include_str!("panels/smartart.rs"),
        include_str!("panels/thesaurus.rs"),
        include_str!("panels/thumbs.rs"),
        include_str!("presenter.rs"),
        include_str!("ribbon.rs"),
        include_str!("ribbon/animations.rs"),
        include_str!("ribbon/arrange.rs"),
        include_str!("ribbon/chart.rs"),
        include_str!("ribbon/design.rs"),
        include_str!("ribbon/draw.rs"),
        include_str!("ribbon/galleries.rs"),
        include_str!("ribbon/home.rs"),
        include_str!("ribbon/insert.rs"),
        include_str!("ribbon/masters.rs"),
        include_str!("ribbon/picture_format.rs"),
        include_str!("ribbon/playback.rs"),
        include_str!("ribbon/qat.rs"),
        include_str!("ribbon/review.rs"),
        include_str!("ribbon/shape_format.rs"),
        include_str!("ribbon/slide_show.rs"),
        include_str!("ribbon/smartart.rs"),
        include_str!("ribbon/table.rs"),
        include_str!("ribbon/title_bar.rs"),
        include_str!("ribbon/transitions.rs"),
        include_str!("ribbon/view.rs"),
        include_str!("services.rs"),
        include_str!("settings.rs"),
        include_str!("show.rs"),
        include_str!("show/keys.rs"),
        include_str!("show/media.rs"),
        include_str!("show/presenter.rs"),
        include_str!("show/render.rs"),
        include_str!("show/ui.rs"),
        include_str!("show/zoom.rs"),
        include_str!("sorter.rs"),
        include_str!("state.rs"),
        include_str!("status.rs"),
        include_str!("studio.rs"),
        include_str!("studio_io.rs"),
        include_str!("textures.rs"),
        include_str!("theme.rs"),
        include_str!("toast.rs"),
        include_str!("uifonts.rs"),
        include_str!("widgets.rs"),
    ] {
        for prefix in ["i18n::tr(\"", "i18n::format(\""] {
            let mut rest = source.split("#[cfg(test)]").next().unwrap_or(source);
            while let Some((_, tail)) = rest.split_once(prefix) {
                let mut escaped = false;
                let end = tail
                    .char_indices()
                    .find_map(|(index, c)| {
                        if escaped {
                            escaped = false;
                            None
                        } else if c == '\\' {
                            escaped = true;
                            None
                        } else if c == '"' {
                            Some(index)
                        } else {
                            None
                        }
                    })
                    .unwrap();
                let key: String = serde_json::from_str(&format!("\"{}\"", &tail[..end])).unwrap();
                assert!(key.is_empty() || catalog().contains_key(&key), "missing interface literal: {key}");
                rest = &tail[end + 1..];
            }
        }
    }
}

#[test]
fn bundled_interface_fonts_cover_the_traditional_chinese_catalog() {
    let definitions = crate::theme::font_definitions(&[]);
    let proportional = definitions.families.get(&egui::FontFamily::Proportional).unwrap();
    let tc = proportional.iter().position(|name| name.contains("Noto Sans CJK TC")).expect("bundled Traditional Chinese interface face");
    if let Some(japanese) = proportional.iter().position(|name| name.contains("BIZ UDPGothic")) {
        assert!(tc < japanese, "Traditional Chinese glyph forms must precede Japanese fallback");
    }
    let characters: std::collections::HashSet<_> =
        catalog().values().flat_map(|value| value.chars()).filter(|c| ('\u{3400}'..='\u{9fff}').contains(c)).collect();
    assert!(!characters.is_empty());
    let ctx = egui::Context::default();
    ctx.set_fonts(definitions);
    let mut output = ctx.run_ui(egui::RawInput::default(), |ui| {
        for font in [egui::FontId::proportional(13.0), crate::theme::bold(13.0)] {
            for character in &characters {
                assert!(ui.fonts_mut(|fonts| fonts.has_glyph(&font, *character)), "missing glyph: {character}");
            }
        }
    });
    output.textures_delta.clear();
}

#[test]
fn rendered_file_tab_is_translated_and_status_labels_do_not_overlap() {
    let mut app = crate::SlideApp::new(deckcraft_engine::Session::new(), crate::Services::default());
    app.run("file.new", serde_json::json!({})).unwrap();
    app.ui.interface_language = Language::ZhHant;
    app.backstage = None;
    let ctx = egui::Context::default();
    for _ in 0..3 {
        let mut output = ctx.run_ui(
            egui::RawInput { screen_rect: Some(egui::Rect::from_min_size(egui::Pos2::ZERO, egui::vec2(1440.0, 900.0))), ..Default::default() },
            |ui| {
                app.logic(ui.ctx());
                app.ui(ui);
            },
        );
        output.textures_delta.clear();
        if app.fonts_ready {
            let texts: Vec<_> = output
                .shapes
                .iter()
                .filter_map(|shape| match &shape.shape {
                    egui::Shape::Text(text) => Some(text),
                    _ => None,
                })
                .collect();
            assert!(texts.iter().any(|text| text.galley.job.text == "檔案"));
            assert!(!texts.iter().any(|text| text.galley.job.text == "File"));
            let slide = texts.iter().find(|text| text.galley.job.text.starts_with("第 ")).unwrap();
            let language = texts.iter().find(|text| text.galley.job.text.starts_with("English (United States)")).unwrap();
            assert!(slide.pos.x + slide.galley.size().x < language.pos.x, "translated status labels overlap");
            output.textures_delta.clear();
            set_current(Language::En);
            return;
        }
        output.textures_delta.clear();
    }
    panic!("interface fonts did not become ready");
}
