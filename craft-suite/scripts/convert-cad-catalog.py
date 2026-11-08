"""Regenerate the TC catalog from upstream with reviewed Taiwan CAD terminology."""
from pathlib import Path
import subprocess
import sys

original = (Path(sys.argv[1]) / "crates/ui-egui/src/i18n/zh.tsv").read_text()
converted = subprocess.check_output(["/opt/homebrew/bin/opencc", "-c", "s2twp.json"], input=original, text=True)
terms = {
    "函式": "函數", "專案": "項目", "畫素": "像素", "引數": "參數",
    "多段線": "聚合線", "多邊形線": "聚合線", "標注": "標註",
}
lines = [
    "# CADCraft Traditional Chinese interface catalog, converted from upstream i18n/zh.tsv.",
    "# License: MIT OR Apache-2.0 (the upstream LICENSE-MIT and LICENSE-APACHE).",
    "# OpenCC s2twp.json conversion with reviewed Taiwan software and CAD terminology.",
    "# UTF-8: context<TAB>English source<TAB>Traditional Chinese translation.",
    "# English keys, placeholders and plural separators are preserved from upstream.",
]
for before, after in zip(original.splitlines(), converted.splitlines(), strict=True):
    if before.startswith("#") or not before.strip():
        continue
    context, key, _ = before.split("\t")
    translation = after.split("\t")[2]
    for old, new in terms.items():
        translation = translation.replace(old, new)
    if "block" in key.lower():
        translation = translation.replace("塊", "圖塊").replace("圖圖塊", "圖塊")
    translation = translation.replace("圖塊參照", "圖塊參考").replace("圖塊引用", "圖塊參考")
    lines.append("\t".join((context, key, translation)))
output = Path(__file__).resolve().parents[1] / "src/cad-zh-hant.tsv"
output.write_text("\n".join(lines) + "\n")
print(f"Converted {len(lines) - 5} CAD catalog keys")
