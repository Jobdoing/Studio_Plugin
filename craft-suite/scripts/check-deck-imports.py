"""Run Deck's real-engine checks and three focused regression mutations."""
import os
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]).resolve()
logs = source.parents[2] / "logs"
logs.mkdir(exist_ok=True)
command = ["cargo", "test", "--manifest-path", str(source / "Cargo.toml"),
           "-p", "deckcraft-ui-egui", "-p", "deckcraft-pptx", "-p", "deckcraft-engine",
           "--lib", "studio_", "--locked"]


def check(label, failure=False):
    path = logs / f"deck-import-{label}.log"
    with path.open("w") as output:
        result = subprocess.run(command, stdout=output, stderr=subprocess.STDOUT, env=os.environ)
    text = path.read_text()
    if failure:
        assert result.returncode != 0 and "test result: FAILED" in text, f"Mutation escaped or failed to compile: {path}"
    elif result.returncode != 0:
        print(f"Check failed ({result.returncode}): {path}", file=sys.stderr)
        raise SystemExit(result.returncode)
    print(f"{label}: {'caught' if failure else 'passed'}")


check("baseline")
mutations = [
    ("all-documents", "crates/ui-egui/src/studio_io.rs",
     'save(app, "deckcraft", false);', 'save(app, "deckcraft", false);\n        break;', 1),
    ("fill-target", "crates/ui-egui/src/panes.rs",
     'app.pick_and_run("picture", "shape.fill", &json!({"ids": ids}))',
     'app.pick_and_run("picture", "shape.fill", &json!({}))', 1),
    ("macro-rejection", "crates/pptx/src/opc.rs",
     'return Err(PptxError::Unsupported("Macro-enabled presentations are not supported".into()));',
     'let _unsupported_macro = true;', 2),
]
for label, name, old, new, count in mutations:
    path = source / name
    original = path.read_text()
    assert original.count(old) == count, f"Unexpected source for {label}"
    try:
        path.write_text(original.replace(old, new))
        check(label, failure=True)
    finally:
        path.write_text(original)
check("restored")
