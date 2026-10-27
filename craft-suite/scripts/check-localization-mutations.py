"""Verify that localization tests reject routing, catalog, and font regressions."""
from pathlib import Path
import os
import subprocess

cache = Path('/Volumes/Vibe-Temp/Craft')
env = dict(os.environ, CARGO_HOME='/Volumes/Vibe-Temp/Studio5/cache/cargo', TMPDIR=str(cache / 'tmp'),
           CRAFT_FONTS_DIR='/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts')
env['RUSTC'] = subprocess.check_output(['rustup', 'which', 'rustc'], text=True).strip()
mutations = [
    ('gridcraft', 'crates/ui-egui/src/i18n.rs', 'return Some(Self::ZhHant);', 'return Some(Self::Zh);', 'traditional_chinese_locales'),
    ('gridcraft', 'crates/ui-egui/src/i18n.rs', 'Self::ZhHant => zh_hant::translate(text)', 'Self::ZhHant => zh::translate(text)', 'traditional_chinese_locales'),
    ('deckcraft', 'crates/ui-egui/src/lib.rs', '"zh-hant" | "zh-Hant" | "zh-TW" => i18n::Language::ZhHant', '"zh-hant" | "zh-Hant" | "zh-TW" => i18n::Language::En', 'language_changes_preserve'),
    ('deckcraft', 'crates/ui-egui/src/theme.rs', 'f.family == "Noto Sans CJK TC" &&', 'f.family == "missing TC face" &&', 'bundled_interface_fonts_cover'),
    ('deckcraft', 'crates/ui-egui/src/ribbon.rs', 'let label = crate::i18n::tr("File");', 'let label = "File";', 'rendered_file_tab'),
    ('deckcraft', 'crates/ui-egui/src/status.rs', 'left_rect.max.x + 12.0', 'rect.min.x + 120.0', 'rendered_file_tab'),
]
for index, (editor, name, before, after, test) in enumerate(mutations, 1):
    path = cache / editor / name
    original = path.read_bytes()
    text = original.decode()
    assert text.count(before) == 1, (editor, before)
    env['CARGO_TARGET_DIR'] = str(cache / 'targets' / editor)
    log = cache / 'logs' / f'mutation-{index}.log'
    try:
        path.write_text(text.replace(before, after))
        with log.open('w') as stream:
            result = subprocess.run(['cargo', 'test', '-p', f'{editor}-ui-egui', '--lib', test],
                                    cwd=cache / editor, env=env, stdout=stream, stderr=subprocess.STDOUT)
        output = log.read_text()
        assert result.returncode != 0 and 'test result: FAILED' in output, f'Mutation {index} survived or did not compile: {log}'
        print(f'Mutation {index}: detected ({editor}, {test})', flush=True)
    finally:
        path.write_bytes(original)
    assert path.read_bytes() == original
print(f'All {len(mutations)} mutations detected; original sources restored')
