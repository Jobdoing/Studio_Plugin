"""Fail on missing upstream keys, duplicates, or changed translation placeholders."""
from pathlib import Path
import re
import sys


def catalog(path):
    entries = {}
    for number, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        context, key, value = line.split("\t")
        assert value, f"Empty translation: {path}:{number}"
        assert (context, key) not in entries, f"Duplicate key: {path}:{number}"
        entries[context, key] = value
    return entries


if __name__ == "__main__":
    upstream = catalog(Path(sys.argv[1]) / "crates/ui-egui/src/i18n/zh.tsv")
    translated = catalog(Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[1] / "src/cad-zh-hant.tsv")
    missing = upstream.keys() - translated.keys()
    for context, key in sorted(missing):
        print(f"Missing CAD translation: {context!r} {key!r}", file=sys.stderr)
    assert not missing, f"{len(missing)} missing CAD translations"
    for key, value in upstream.items():
        assert sorted(re.findall(r"\{[^{}]+\}", value)) == sorted(re.findall(r"\{[^{}]+\}", translated[key])), f"Changed placeholders: {key}"
        if key[0] == "@plural":
            assert value.count("|") == translated[key].count("|"), f"Changed plural forms: {key}"
    print(f"CAD Traditional Chinese catalog: {len(upstream)} upstream keys covered")
