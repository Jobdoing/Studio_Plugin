"""Verify that localization tests reject routing, catalog, and font regressions."""
from pathlib import Path
import os
import subprocess
import sys

cache = Path('/Volumes/Vibe-Temp/Craft')
env = dict(os.environ, CARGO_HOME='/Volumes/Vibe-Temp/Studio5/cache/cargo', TMPDIR=str(cache / 'tmp'),
           CRAFT_FONTS_DIR='/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts')
env['RUSTC'] = subprocess.check_output(['rustup', 'which', 'rustc'], text=True).strip()
mutations = [
    ('gridcraft', 'crates/ui-egui/src/i18n.rs', 'return Some(Self::ZhHant);', 'return Some(Self::Zh);', 'traditional_chinese_locales'),
    ('gridcraft', 'crates/ui-egui/src/i18n.rs', 'Self::ZhHant => zh_hant::translate(text)', 'Self::ZhHant => zh::translate(text)', 'traditional_chinese_locales'),
    ('gridcraft', 'crates/ui-egui/src/equation.rs', 'studio_language.tr("LaTeX:")', '"LaTeX:"', 'traditional_chinese_equation_controls'),
    ('gridcraft', 'crates/ui-egui/src/i18n/zh_hant.rs', 'output.push_str(value);', 'output.push_str(&values.first().unwrap().1);', 'traditional_chinese_format'),
    ('gridcraft', 'crates/ui-egui/src/code_editor.rs', 'out.response.response.accessible_name(name)', 'out.response.response.accessible_name(options.name)', 'traditional_chinese_code_editor_accessible'),
    ('deckcraft', 'crates/ui-egui/src/app/commands.rs', '"zh-hant" | "zh-Hant" | "zh-TW" => i18n::Language::ZhHant', '"zh-hant" | "zh-Hant" | "zh-TW" => i18n::Language::En', 'language_changes_preserve'),
    ('deckcraft', 'crates/ui-egui/src/theme.rs', 'f.family == "Noto Sans CJK TC" &&', 'f.family == "missing TC face" &&', 'bundled_interface_fonts_cover'),
    ('deckcraft', 'crates/ui-egui/src/ribbon.rs', 'let label = crate::i18n::tr("File");', 'let label = "File";', 'rendered_file_tab'),
    ('deckcraft', 'crates/ui-egui/src/status.rs', 'sr.max.x + 16.0', 'rect.min.x + 120.0', 'rendered_file_tab'),
]
completed = 0
for index, (editor, name, before, after, test) in enumerate(mutations, 1):
    if len(sys.argv) > 1 and editor != 'gridcraft':
        continue
    root = Path(sys.argv[1]).resolve() if editor == 'gridcraft' and len(sys.argv) > 1 else cache / editor
    path = root / name
    original = path.read_bytes()
    text = original.decode()
    assert text.count(before) == 1, (editor, before)
    if editor == 'gridcraft' and len(sys.argv) > 1:
        env = dict(os.environ, RUSTC=subprocess.check_output(['rustup', 'which', 'rustc'], text=True).strip())
    else:
        env['CARGO_TARGET_DIR'] = str(cache / 'targets' / editor)
    log = cache / 'logs' / f'mutation-{index}.log'
    if editor == 'gridcraft' and len(sys.argv) > 1:
        log = cache / 'logs' / 'port-grid' / f'localization-mutation-{index}.log'
        log.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.write_text(text.replace(before, after))
        with log.open('w') as stream:
            command = ['cargo', 'test', '-p', f'{editor}-ui-egui', '--lib', test]
            if editor == 'gridcraft':
                command.insert(2, '--locked')
            result = subprocess.run(command,
                                    cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT)
        output = log.read_text()
        assert result.returncode != 0 and 'test result: FAILED' in output, f'Mutation {index} survived or did not compile: {log}'
        print(f'Mutation {index}: detected ({editor}, {test})', flush=True)
    finally:
        path.write_bytes(original)
    assert path.read_bytes() == original
    completed += 1
print(f'All {completed} mutations detected; original sources restored')
