//! Interface translations only; document text and command identifiers remain unchanged.
// Adapted from DeckCraft PR 34, MIT OR Apache-2.0.
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Language {
    #[default]
    System,
    En,
    #[serde(rename = "zh-hant", alias = "zh-Hant", alias = "zh-TW")]
    ZhHant,
}

impl Language {
    pub const ALL: [Self; 3] = [Self::System, Self::En, Self::ZhHant];

    pub fn label(self) -> &'static str {
        match self {
            Self::System => tr("System language"),
            Self::En => "English",
            Self::ZhHant => "繁體中文",
        }
    }

    pub fn from_locale(locale: &str) -> Self {
        let tag = locale.to_ascii_lowercase().replace('_', "-");
        let parts: Vec<_> = tag.split(['-', '.', '@']).collect();
        if parts.first() == Some(&"zh") && !parts.contains(&"hans") && parts.iter().any(|part| matches!(*part, "hant" | "tw" | "hk" | "mo")) {
            Self::ZhHant
        } else {
            Self::En
        }
    }

    pub fn resolve(self, locale: Option<&str>) -> Self {
        if self == Self::System { Self::from_locale(locale.unwrap_or("")) } else { self }
    }
}

thread_local! {
    static CURRENT: Cell<Language> = const { Cell::new(Language::En) };
}

pub fn current() -> Language {
    CURRENT.get()
}
pub fn set_current(language: Language) {
    CURRENT.set(language);
}

const CATALOG: &str = include_str!("i18n/zh-hant.tsv");
static TRADITIONAL: OnceLock<HashMap<String, String>> = OnceLock::new();

fn catalog() -> &'static HashMap<String, String> {
    TRADITIONAL.get_or_init(|| {
        CATALOG
            .lines()
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .filter_map(|line| line.split_once('\t'))
            .map(|(key, value)| (key.replace("\\n", "\n"), value.replace("\\n", "\n")))
            .collect()
    })
}

pub fn tr(text: &str) -> &str {
    // NOTE(ceiling): Uncatalogued engine diagnostics remain English; add translations at explicit display boundaries as coverage grows.
    if current() == Language::ZhHant { catalog().get(text).map(String::as_str).unwrap_or(text) } else { text }
}

pub fn tr_context<'a>(source: &'a str, key: &str) -> &'a str {
    if current() == Language::ZhHant { catalog().get(key).map(String::as_str).unwrap_or(source) } else { source }
}

pub fn placeholder_prompt(kind: deckcraft_model::PhType) -> &'static str {
    tr(kind.prompt())
}

/// Substitute formatted values without translating their contents.
pub fn format(source: &str, values: &[String]) -> String {
    let text = tr(source);
    let mut out = String::new();
    let mut rest = text;
    let mut index = 0;
    while let Some(start) = rest.find('{') {
        out.push_str(rest.get(..start).unwrap_or(""));
        let tail = rest.get(start + 1..).unwrap_or("");
        if let Some(after) = tail.strip_prefix('{') {
            out.push('{');
            rest = after;
        } else if let Some(end) = tail.find('}') {
            out.push_str(values.get(index).map(String::as_str).unwrap_or(""));
            index += 1;
            rest = tail.get(end + 1..).unwrap_or("");
        } else {
            out.push_str(rest);
            return out;
        }
    }
    out.push_str(&rest.replace("}}", "}"));
    out
}

pub fn count(n: usize, english: &str) -> String {
    format!("{n} {}", tr(english))
}

pub fn recovered(n: usize) -> String {
    format("Recovered {} from the last session", &[count(n, if n == 1 { "unsaved presentation" } else { "unsaved presentations" })])
}

#[cfg(test)]
#[path = "studio_zh_hant_tests.rs"]
mod studio_zh_hant_tests;
