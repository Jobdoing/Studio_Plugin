"""Check every upstream interface catalog against the Studio Traditional Chinese catalog."""
import json
from pathlib import Path
import re
import sys

root = Path(sys.argv[1]).resolve()
directory = root / 'crates/ui-egui/src/i18n'
literal = r'"((?:[^"\\]|\\.)*)"'


def decode(value):
    value = re.sub(r'\\u\{([0-9a-fA-F]+)\}', lambda m: chr(int(m[1], 16)), value)
    return json.loads('"' + value + '"')


def keys(text):
    text = text.split('#[cfg(test)]')[0]
    text = re.sub(r'^\s*//[^\n]*', '', text, flags=re.M)
    return [decode(m[1]) for m in re.finditer(r'(?:^\s*|\(\s*)' + literal + r'\s*=>', text, re.M)] + [
        decode(m[1]) for m in re.finditer(r'\(\s*' + literal + r'\s*,', text)
    ]


reference = set()
for path in directory.glob('*.rs'):
    if path.name == 'zh_hant.rs' or 'functions' in path.stem:
        continue
    source = path.read_text()
    if 'fn translate' in source:
        reference.update(keys(source))
catalog = keys((directory / 'zh_hant.rs').read_text())
assert len(catalog) == len(set(catalog)), 'Duplicate Traditional Chinese keys'
missing = reference.difference(catalog)
assert not missing, f'Missing upstream interface keys: {sorted(missing)}'
print(f'GridCraft interface catalogs: {len(reference)} upstream keys covered; {len(catalog)} Traditional Chinese keys; no duplicates')
