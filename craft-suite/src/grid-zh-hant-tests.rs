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
    for (english, _) in JAPANESE {
        let translated = zh_hant::translate(english).expect(english);
        let fields = |text: &str| -> Vec<String> {
            text.split('{').skip(1).filter_map(|part| part.split_once('}').map(|(name, _)| name.to_string())).collect()
        };
        assert_eq!(fields(english), fields(translated), "{english}");
        assert!(!translated.is_empty(), "{english}");
    }
}
