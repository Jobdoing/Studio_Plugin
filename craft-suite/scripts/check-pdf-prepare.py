"""Verify that the checked-in preparation script reproduces the compiled sources."""
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

archive, compiled = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
suite = Path(__file__).resolve().parents[1]
ui = Path("crates/ui-egui/src")
paths = [ui / f"{name}.rs" for name in [
    "lib", "editing", "files", "create_ui", "measure_ui", "print_ui",
    "create_multiple_ui", "export_ui", "actions_ui", "ocr_ui", "content_ui",
    "stamps_ui", "fill_sign", "widgets", "edit_text_ui", "comments", "comments_panel", "commands",
]]
paths += [Path(name) for name in ["crates/fonts/build.rs", "crates/fonts/src/craft.rs", "apps/pdfcraft-web/src/main.rs"]]
scratch = Path("/Volumes/Vibe-Temp/Studio5/craft-plugins/checks")
scratch.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="pdf-prepare-", dir=scratch) as temporary:
    fresh = Path(temporary) / compiled.name
    with zipfile.ZipFile(archive) as upstream:
        for path in paths:
            destination = fresh / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(upstream.read(f"{compiled.name}/{path}"))
    result = subprocess.run([sys.executable, str(suite / "scripts/prepare-pdfcraft.py"), str(fresh)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    paths += [ui / "studio.rs", ui / "studio_io.rs", ui / "studio_drafts.rs"]
    different = [str(path) for path in paths if (fresh / path).read_bytes() != (compiled / path).read_bytes()]
    if different:
        raise RuntimeError("Prepared source differs from build input: " + ", ".join(different))
    print(f"PdfCraft preparation reproduced all {len(paths)} modified/generated source files")
