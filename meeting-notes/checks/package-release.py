"""Build reproducible, unsigned plugin and developer-run backend archives."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import zipfile

root = Path(__file__).resolve().parents[1]
plugin = root / "plugin" / "meeting-notes"
version = json.loads((plugin / "plugin.json").read_text())["version"]
if len(sys.argv) != 2:
    raise SystemExit("Usage: python3 package-release.py <output-directory>")
output = Path(sys.argv[1])
output.mkdir(parents=True, exist_ok=True)


def content(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"Invalid release file: {path.name}")
    if path.name == ".env" or path.name == "plugin.sig":
        raise ValueError(f"Private or signed file in unsigned source: {path.name}")
    return path.read_bytes()


def plugin_zip():
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w") as archive:
        for path in sorted(plugin.rglob("*")):
            if path.is_dir() and not path.is_symlink():
                continue
            entry = zipfile.ZipInfo(path.relative_to(plugin).as_posix(), (1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content(path), compress_type=zipfile.ZIP_STORED)
    return result.getvalue()


def backend_tar():
    result = io.BytesIO()
    files = ["server.mjs", "backend/server.mjs", "backend/auth.mjs", "backend/speech.mjs",
             "backend/.env.example", "plugin/meeting-notes/model.mjs", "README.md", "docs/platform-recording.md"]
    with gzip.GzipFile(fileobj=result, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as archive:
            for name in sorted(files):
                data = content(root / name)
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                entry.mode = 0o644
                entry.uid = entry.gid = entry.mtime = 0
                archive.addfile(entry, io.BytesIO(data))
    return result.getvalue()


checksums = []
for name, build in [(f"meeting-notes-{version}.zip", plugin_zip),
                    (f"meeting-notes-backend-{version}.tar.gz", backend_tar)]:
    data = build()
    if data != build():
        raise RuntimeError(f"Non-reproducible archive: {name}")
    (output / name).write_bytes(data)
    checksums.append(f"{hashlib.sha256(data).hexdigest()}  {name}\n")
(output / "SHA256SUMS").write_text("".join(checksums))
print(f"Unsigned release {version}: ZIP and backend tar.gz built with fixed metadata; rebuild comparison passed.")
