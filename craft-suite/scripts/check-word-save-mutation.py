"""Check Studio save receipts against WordApp and kill identity and revision mutants."""
import os
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]).resolve()
logs = Path(sys.argv[2]).resolve()
suite = Path(__file__).resolve().parents[1]
lib = source / "crates/ui-egui/src/app/files.rs"
text = lib.read_text()
tests = (source / "crates/ui-egui/src/tests.rs").read_text()
start = tests.index('    #[test]\n    fn studio_receipt_names_the_saved_document()')
end = tests.index('    const UNSAVED:', start)
assert tests[start:end].startswith((suite / "src/word-save-tests.rs").read_text() + "\n")
web = (source / "apps/wordcraft-web/src/web.rs").read_text()
assert web.index('crate::prefs::restore(&mut app, stored.as_deref());') < web.index('app.ui.language = "zh-hant".into();')
assert web.count('for document in self.app.session.documents() { ids.push(&document.id.to_string().into()); }') == 1
logs.mkdir(parents=True, exist_ok=True)
env = dict(os.environ)
env["RUSTC"] = subprocess.check_output(["rustup", "which", "rustc"], text=True).strip()
env["CARGO_HOME"] = "/Volumes/Vibe-Temp/Studio5/cache/cargo"
env["CARGO_TARGET_DIR"] = "/Volumes/Vibe-Temp/Craft/targets/port-wordcraft"
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
old = "self.session.rev() == save.revision"
assert text.count(old) == 1
try:
    lib.write_text(text.replace(old, "true"))
    code, report = check("save-revision-mutant", "studio_receipt_cleans_only_the_serialized_revision")
finally:
    lib.write_text(text)
if code != 101 or "studio_receipt_cleans_only_the_serialized_revision ... FAILED" not in report:
    raise RuntimeError("The revision mutant was not killed by the expected assertion")
code, _ = check("save-restored", "studio_")
raise SystemExit(code)
