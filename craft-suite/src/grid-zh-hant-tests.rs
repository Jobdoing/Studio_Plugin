use super::*;

#[test]
fn traditional_chinese_locales_preserve_simplified_and_formula_behavior() {
    for tag in ["zh-Hant", "zh-TW", "zh_HK.UTF-8", "zh-MO", "zh-Hant-CN"] {
        assert_eq!(Language::parse(tag), Some(Language::ZhHant), "{tag}");
    }
    for tag in ["zh", "zh-CN", "zh-Hans", "zh-Hans-TW"] {
        assert_eq!(Language::parse(tag), Some(Language::Zh), "{tag}");
    }
    assert_eq!(Language::ZhHant.formula_locale(), Language::En.formula_locale());
    assert_eq!(Language::Zh.tr("Data"), "数据");
    assert_eq!(Language::ZhHant.tr("Data"), "資料");
    assert_eq!(Language::ZhHant.tr("Paste"), "貼上");
    assert_eq!(Language::ZhHant.tr("Wrap Text"), "自動換列");
    assert_eq!(Language::ZhHant.tr("Notes"), "備註");
    assert_eq!(Language::ZhHant.tr("AutoSave"), "自動儲存");
    assert_eq!(Language::parse(Language::ZhHant.code()), Some(Language::ZhHant));
}

#[test]
fn traditional_chinese_switch_preserves_workbook_and_identifiers() {
    let mut app = crate::SheetApp::new(gridcraft_engine::Session::default(), Default::default());
    app.run("file.new", serde_json::json!({})).unwrap();
    app.run("cell.set", serde_json::json!({"cell": "A1", "input": "File {customer} 測試"})).unwrap();
    let before = serde_json::to_value(&app.session.doc().unwrap().wb).unwrap();
    for language in ["zh-hant", "en", "zh-TW"] {
        app.run("app.language.set", serde_json::json!({"language": language})).unwrap();
        assert_eq!(before, serde_json::to_value(&app.session.doc().unwrap().wb).unwrap());
        let restored: crate::UiState = serde_json::from_str(&serde_json::to_string(&app.ui).unwrap()).unwrap();
        assert_eq!(restored.language, app.ui.language);
    }
    assert_eq!(Language::ZhHant.tr("Sheet1!A1"), "Sheet1!A1");
    assert_eq!(Language::ZhHant.tr("=SUM(A1:A3)"), "=SUM(A1:A3)");
}

#[test]
fn traditional_chinese_catalog_covers_existing_labels_and_placeholders() {
    for (english, _) in ja::CORE.iter().chain(ja::DIALOGS).chain(ja::EXTRA) {
        let translated = zh_hant::translate(english).expect(english);
        let fields = |text: &str| -> Vec<String> {
            text.split('{').skip(1).filter_map(|part| part.split_once('}').map(|(name, _)| name.to_string())).collect()
        };
        assert_eq!(fields(english), fields(translated), "{english}");
        assert!(!translated.is_empty(), "{english}");
    }
}

#[test]
fn traditional_chinese_format_preserves_document_text_and_repeated_fields() {
    let title = "Client {title} | =SUM(A1:A3)";
    assert_eq!(
        zh_hant::format("Do you want to save the changes you made to {title}?", &[("title", title.into())]),
        format!("您要儲存對 {title} 所做的變更嗎？")
    );
    assert_eq!(zh_hant::format("Current value must be between {} and {}.", &[("0", "1".into()), ("1", "10".into())]), "目前值必須介於 1 與 10 之間。");
    assert_eq!(zh_hant::format("Saved macro “{name}” ({steps} step{})", &[("name", "Budget".into()), ("steps", "2".into()), ("0", "s".into())]), "已儲存巨集「Budget」（2 個步驟）");
}

#[test]
fn traditional_chinese_equation_controls_are_translated_when_drawn() {
    let ctx = egui::Context::default();
    crate::SheetApp::setup_context_for_language(&ctx, false, Language::ZhHant);
    let mut app = crate::SheetApp::new(gridcraft_engine::Session::new(), Default::default());
    app.run("file.new", serde_json::json!({})).unwrap();
    app.ui.language = Language::ZhHant;
    set_current(&ctx, Language::ZhHant);
    let mut dialog = crate::equation::open_editor(&app, &serde_json::json!({})).unwrap();
    let output = ctx.run_ui(egui::RawInput {
        screen_rect: Some(egui::Rect::from_min_size(egui::Pos2::ZERO, egui::vec2(900.0, 700.0))),
        ..Default::default()
    }, |ui| {
        crate::equation::editor(&mut app, ui, &mut dialog, &mut false, &mut true);
    });
    fn text(shape: &egui::epaint::Shape, labels: &mut Vec<String>) {
        match shape {
            egui::epaint::Shape::Text(t) => labels.push(t.galley.text().to_owned()),
            egui::epaint::Shape::Vec(shapes) => for s in shapes { text(s, labels); },
            _ => {}
        }
    }
    let mut labels = Vec::new();
    for shape in &output.shapes { text(&shape.shape, &mut labels); }
    output.drop_without_applying_deltas();
    for expected in ["LaTeX：", "預覽", "確定", "取消"] {
        assert!(labels.iter().any(|s| s == expected), "missing {expected}: {labels:?}");
    }
}

#[test]
fn traditional_chinese_code_editor_accessible_name_is_translated() {
    use egui_kittest::kittest::Queryable as _;
    let mut source = "x^2".to_owned();
    let harness = egui_kittest::Harness::builder()
        .with_context_setup(|ctx| {
            crate::SheetApp::setup_context_for_language(ctx, false, Language::ZhHant);
            set_current(ctx, Language::ZhHant);
        })
        .build_ui(|ui| {
            crate::code_editor::code_field(ui, egui::Id::unique("translated_code"), &mut source,
                &crate::code_editor::FieldOptions::new(crate::code_editor::Lang::Latex));
        });
    assert!(harness.query_by_label("程式碼編輯器").is_some());
    assert!(harness.query_by_label("Code Editor").is_none());
}
