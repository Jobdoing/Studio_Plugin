"""Generate an upstream DWG fixture, execute the real WASM codec and reopen natively."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tomllib

source, output = (Path(value).resolve() for value in sys.argv[1:])
suite = Path(__file__).resolve().parents[1]
assert output.is_relative_to(Path("/Volumes/Vibe-Temp/Craft")) and not output.exists()
probe = source / "apps/studio-dwg-check"
assert not probe.exists()
env = dict(os.environ, CARGO_HOME="/Volumes/Vibe-Temp/Studio5/cache/cargo",
           CARGO_TARGET_DIR="/Volumes/Vibe-Temp/Craft/targets/port-cadcraft",
           TMPDIR="/Volumes/Vibe-Temp/Craft/tmp",
           CRAFT_FONTS_DIR="/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts")
env["RUSTC"] = subprocess.check_output(["rustup", "which", "rustc"], text=True).strip()
output.mkdir(parents=True)


def run(label, command):
    with (output / f"{label}.log").open("w") as log:
        result = subprocess.run(command, cwd=source, env=env, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        print((output / f"{label}.log").read_text()[-3000:])
        raise SystemExit(result.returncode)


# Verify extracted files against the exact registry archive rather than trust a cache name.
registry, = Path(env["CARGO_HOME"]).glob("registry/src/*/acadrust-0.6.6")
archive = Path(env["CARGO_HOME"]) / "registry/cache" / registry.parent.name / "acadrust-0.6.6.crate"
assert hashlib.sha256(archive.read_bytes()).hexdigest() == "8923c99ea1f151cb7fc17ce2fc14f8b1e330fa22611e535602d985c0cc3c89a2"
with tarfile.open(archive) as package:
    files = [member for member in package if member.isfile()]
    for member in files:
        relative = Path(member.name).relative_to("acadrust-0.6.6")
        assert (registry / relative).read_bytes() == package.extractfile(member).read(), f"Modified acadrust file: {relative}"
print(f"Unmodified acadrust 0.6.6 verified: {len(files)} archive files", flush=True)

lock = source / "Cargo.lock"
original = lock.read_bytes()
before = tomllib.loads(original.decode())["package"]
try:
    shutil.copytree(suite / "tests/cad-dwg-wasm", probe)
    # Add only the disposable check member; all previously locked packages must remain identical.
    run("metadata", ["cargo", "metadata", "--offline", "--format-version=1"])
    after = tomllib.loads(lock.read_text())["package"]
    assert [package for package in after if package["name"] != "studio-dwg-check"] == before
    native = ["cargo", "run", "--locked", "--offline", "-p", "studio-dwg-check", "--bin", "studio-dwg-check", "--"]
    run("generate", native + ["generate", str(output / "native.dwg")])
    run("wasm-build", ["cargo", "build", "--locked", "--offline", "--release", "-p", "studio-dwg-check", "--lib", "--target", "wasm32-unknown-unknown"])
    bindgen = "/Volumes/Vibe-Temp/Studio5/craft-plugins/tools/wasm-bindgen-0.2.129/wasm-bindgen"
    wasm = str(Path(env["CARGO_TARGET_DIR"]) / "wasm32-unknown-unknown/release/studio_dwg_check.wasm")
    for target in ["web", "nodejs"]:
        directory = output / ("web" if target == "web" else "node")
        run(f"bindgen-{target}", [bindgen, "--target", target, "--out-dir", str(directory), wasm])
    for name in ["check.cjs", "index.html"]:
        shutil.copyfile(probe / name, output / name)
    run("node-wasm", ["node", str(output / "check.cjs")])
    print((output / "node-wasm.log").read_text().strip(), flush=True)
    run("native-reopen", native + ["verify", str(output / "wasm.dwg")])
    print("Native reopen of WASM-written DWG: passed", flush=True)
finally:
    lock.write_bytes(original)
    if probe.exists():
        shutil.rmtree(probe)
print(f"Browser check ready: {output / 'index.html'}; temporary workspace member removed", flush=True)
