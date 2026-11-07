"""Exercise production save settlement and kill identity, revision and close mutants."""
import os
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]).resolve()
logs = Path(sys.argv[2]).resolve()
logs.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, CARGO_HOME="/Volumes/Vibe-Temp/Studio5/cache/cargo",
           CARGO_TARGET_DIR="/Volumes/Vibe-Temp/Craft/targets/port-cadcraft",
           CRAFT_FONTS_DIR="/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts",
           TMPDIR="/Volumes/Vibe-Temp/Craft/tmp")
env["RUSTC"] = subprocess.check_output(["rustup", "which", "rustc"], text=True).strip()


def check(label):
    with (logs / f"{label}.log").open("w") as output:
        result = subprocess.run(["cargo", "test", "--locked", "-p", "cadcraft-ui-egui", "--lib", "studio_save_tests"],
                                cwd=source, env=env, stdout=output, stderr=subprocess.STDOUT)
    report = (logs / f"{label}.log").read_text()
    print(label + ": " + " | ".join(line for line in report.splitlines() if line.startswith("test result:")))
    return result.returncode, report


code, report = check("baseline")
if code:
    print(report[-3000:])
    raise SystemExit(code)
mutants = [
    ("identity", "crates/engine/src/studio_save.rs", "doc.uid == request.uid", "true", "receipt_targets_original_document_and_ignores_closed_document"),
    ("revision", "crates/engine/src/studio_save.rs", "doc.revision != request.revision", "false", "later_edits_and_revision_changes_remain_unsaved"),
    ("close", "crates/ui-egui/src/closing.rs", "if saved && self.closing.as_ref()", "if true && self.closing.as_ref()", "pending_close_waits_for_receipt_and_stops_on_error_or_new_edits"),
]
for label, relative, old, new, test in mutants:
    path = source / relative
    original = path.read_text()
    assert original.count(old) == 1
    try:
        path.write_text(original.replace(old, new))
        code, report = check(label)
    finally:
        path.write_text(original)
    assert code == 101 and f"studio_save_tests::{test} ... FAILED" in report, f"Mutant not killed by assertion: {label}"
code, report = check("restored")
if code:
    print(report[-3000:])
raise SystemExit(code)
