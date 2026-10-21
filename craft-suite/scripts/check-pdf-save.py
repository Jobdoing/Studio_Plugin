"""Compile and execute the production save poller, including safety mutations."""
import os
import subprocess
import tempfile
from pathlib import Path

suite = Path(__file__).resolve().parents[1]
source = suite / "src/pdf-save.rs"
test = suite / "tests/pdf-save-state.rs"
scratch = Path("/Volumes/Vibe-Temp/Studio5/craft-plugins/checks")
scratch.mkdir(parents=True, exist_ok=True)
rustc = subprocess.check_output(["rustup", "which", "rustc"], text=True).strip()


def run(adapter, destination):
    env = dict(os.environ, PDF_ADAPTER_SOURCE=str(adapter))
    compiled = subprocess.run([rustc, "--edition=2024", "--test", str(test), "-o", str(destination)], env=env, capture_output=True, text=True)
    if compiled.returncode:
        raise RuntimeError(compiled.stderr)
    return subprocess.run([str(destination)], capture_output=True, text=True)


with tempfile.TemporaryDirectory(prefix="pdf-save-", dir=scratch) as temporary:
    directory = Path(temporary)
    baseline = run(source, directory / "baseline")
    if baseline.returncode:
        raise RuntimeError(baseline.stdout + baseline.stderr)
    text = source.read_text()
    mutations = {
        "generation_guard": ('doc.edit_generation() == pending.generation', 'true'),
        "tab_guard": ('view.id == pending.id', 'true'),
        "typing_guard": ('!app.commit_typing_in(pending.id)', 'false'),
        "receipt_name": ('pending.id, pending.bytes, Some(name)', 'pending.id, pending.bytes, None'),
        "cancel_continuation": ('Err(error) if error == "CANCELLED" => {}', 'Err(error) if error == "CANCELLED" => { (pending.after)(app); }'),
        "batch_failure_continuation": ('Some(Err(error)) => app.notify_error(error),\n        }\n    }\n    let result =', 'Some(Err(_error)) => (write.after)(app),\n        }\n    }\n    let result ='),
    }
    for label, (before, after) in mutations.items():
        if text.count(before) != 1:
            raise RuntimeError(f"Mutation target changed: {label}")
        mutated = directory / f"{label}.rs"
        mutated.write_text(text.replace(before, after))
        result = run(mutated, directory / label)
        if result.returncode == 0:
            raise RuntimeError(f"Safety mutation survived: {label}")
    print(f"PdfCraft save adapter: 13 checks passed; {len(mutations)} unsafe mutations rejected")
