"""Apply the reviewed localization patch after both existing Studio preparation passes."""
from pathlib import Path
import shutil
import subprocess
import sys
import tomllib

editor, directory = sys.argv[1:]
assert editor in ('gridcraft', 'deckcraft'), 'Only GridCraft and DeckCraft need this pass'
source = Path(directory).resolve()
suite = Path(__file__).resolve().parents[1]
expected = {'gridcraft': '0.9.0', 'deckcraft': '0.8.0'}[editor]
actual = tomllib.loads((source / 'Cargo.toml').read_text())['workspace']['package']['version']
if actual != expected:
    raise RuntimeError(f'Expected {editor} {expected}; got {actual}')
patch = suite / 'patches' / f'{editor}-zh-hant.patch'
subprocess.run(['git', 'apply', '--check', str(patch)], cwd=source, check=True)
subprocess.run(['git', 'apply', str(patch)], cwd=source, check=True)
ui = source / 'crates/ui-egui/src'
files = {
    'gridcraft': [('grid-zh-hant.rs', 'i18n/zh_hant.rs'), ('grid-zh-hant-tests.rs', 'studio_zh_hant_tests.rs')],
    'deckcraft': [('deck-i18n.rs', 'i18n.rs'), ('deck-zh-hant.tsv', 'i18n/zh-hant.tsv'), ('deck-zh-hant-tests.rs', 'studio_zh_hant_tests.rs')],
}
for original, target in files[editor]:
    output = ui / target
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(suite / 'src' / original, output)
print(f'Applied Traditional Chinese interface to {editor} {actual}')
