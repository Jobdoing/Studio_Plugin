"""Check the proposed upgrade script without loading or mutating the live workspace."""
from pathlib import Path
import runpy
import sys
import tempfile
from unittest.mock import patch

proposal = Path(sys.argv[1]).resolve()
namespace = runpy.run_path(str(proposal))
replace = namespace["replace_candidates"]
with tempfile.TemporaryDirectory(prefix="cad-upgrade-check-", dir="/Volumes/Vibe-Temp/Craft/tmp") as directory:
    root = Path(directory)
    source = root / "candidate"
    source.mkdir()
    (source / "payload").write_text("new")
    existing = root / "existing"
    existing.mkdir()
    (existing / "payload").write_text("original")
    new = root / "cad-viewer"
    pins = root / "pins.json"
    pins.write_text("{}")
    rename = Path.rename

    def fail_pins(path, target):
        if path.name == "new" and target == pins:
            raise OSError("Injected pin replacement failure")
        return rename(path, target)

    try:
        with patch.object(Path, "rename", fail_pins):
            replace([(source, existing), (source, new)], pins, {"cadcraft": "reviewed"})
    except OSError as error:
        assert str(error) == "Injected pin replacement failure"
    else:
        raise AssertionError("The injected transaction failure did not run")
    assert (existing / "payload").read_text() == "original"
    assert not new.exists()
    assert pins.read_text() == "{}"
    assert not list(root.glob(".upgrade-*"))
    replace([(source, existing), (source, new)], pins, {"cadcraft": "reviewed"})
    assert (existing / "payload").read_text() == "new"
    assert (new / "payload").read_text() == "new"
    assert '"cadcraft": "reviewed"' in pins.read_text()
    assert not list(root.glob(".upgrade-*"))
print("upgrade.py proposal: new-target adoption and rollback checks passed")
