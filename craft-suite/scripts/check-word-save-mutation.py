"""Check Studio save receipts against the actual WordApp and kill an identity mutant."""
import os
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]).resolve()
logs = Path(sys.argv[2]).resolve()
suite = Path(__file__).resolve().parents[1]
lib = source / "crates/ui-egui/src/lib.rs"
text = lib.read_text()
start = text.index('    #[test]\n    fn studio_receipt_names_the_saved_document()')
end = text.index('    const UNSAVED:', start)
text = text[:start] + (suite / "src/word-save-tests.rs").read_text() + "\n" + text[end:]
lib.write_text(text)
logs.mkdir(parents=True, exist_ok=True)
env = dict(os.environ)
env["RUSTC"] = subprocess.check_output(["rustup", "which", "rustc"], text=True).strip()
env["CARGO_HOME"] = "/Volumes/Vibe-Temp/Studio5/cache/cargo"
env["CARGO_TARGET_DIR"] = "/Volumes/Vibe-Temp/Studio5/craft-plugins/target-deck-native"
env["CRAFT_FONTS_DIR"] = "/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts"
# NOTE(ceiling): Save tests do not certify release font coverage; check native release fonts separately.
env.pop("CRAFT_FONTS_REQUIRED", None)


def check(label, test_filter):
    log = logs / f"word-{label}.log"
    command = ["cargo", "test", "--manifest-path", str(source / "Cargo.toml"),
               "-p", "wordcraft-ui-egui", "--lib", test_filter, "--locked"]
    with log.open("w") as output:
        result = subprocess.run(command, env=env, stdout=output, stderr=subprocess.STDOUT)
    report = log.read_text()
    for line in report.splitlines():
        if line.startswith("test result:"):
            print(f"{label}: {line}")
    return result.returncode, report


code, _ = check("save-review", "studio_")
if code:
    raise SystemExit(code)
old = "if save.marked_saved && save.document == current\n                            && let Some(filename) = filename"
assert text.count(old) == 1
# Only native test builds bypass identity; the production condition stays equivalent.
mutant = text.replace(old, "if save.marked_saved && (save.document == current || cfg!(test))\n                            && let Some(filename) = filename")
try:
    lib.write_text(mutant)
    code, report = check("save-identity-mutant", "studio_replaced_document_ignores_an_old_filename_receipt")
finally:
    lib.write_text(text)
if code != 101 or "studio_replaced_document_ignores_an_old_filename_receipt ... FAILED" not in report:
    raise RuntimeError("The identity mutant was not killed by the expected assertion")
code, _ = check("save-restored", "studio_")
raise SystemExit(code)
