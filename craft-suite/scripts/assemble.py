"""Assemble a modified editor web build; this does not sign or publish it."""
import gzip
import json
import shutil
import sys
from pathlib import Path

editor = sys.argv[1]
source, build, output, font_dir = (Path(p).resolve() for p in sys.argv[2:])
suite = Path(__file__).resolve().parents[1]
upstream = json.loads((suite / "upstream.json").read_text())[editor]
title = {"wordcraft": "WordCraft", "deckcraft": "DeckCraft", "gridcraft": "GridCraft", "pdfcraft": "PdfCraft"}[editor]
language = {"wordcraft": "zh-Hant", "deckcraft": "en", "gridcraft": "zh-Hans", "pdfcraft": "zh-Hant"}[editor]
canvas_id = "pdfcraft" if editor == "pdfcraft" else f"{editor}_canvas"
loading = "" if editor == "pdfcraft" else f'<div id="{editor}_loading">Loading {title}…</div>'
if output.exists():
    raise RuntimeError("Output already exists; choose a fresh staging directory")
output.mkdir(parents=True)
for path in build.iterdir():
    if path.suffix == ".js":
        shutil.copyfile(path, output / path.name)
for name in ("documents.mjs", "picker.mjs", "runtime.mjs"):
    shutil.copyfile(suite / "src" / name, output / name)
js, = build.glob("*.js")
wasm, = build.glob("*.wasm")
(output / (wasm.name + ".gz")).write_bytes(gzip.compress(wasm.read_bytes(), mtime=0))
(output / "boot.mjs").write_text(f'''import './runtime.mjs';
import init from './{js.name}';
const response = await fetch('./{wasm.name}.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({{ module_or_path: bytes }});
''')
(output / "plugin.json").write_text(json.dumps({
    "id": editor, "title": title, "kind": "app", "scope": "project", "desktop_only": True,
    "version": upstream["tag"].removeprefix("v"), "uses": {"studio-docs": {"access": "write"}},
}, indent=2) + "\n")
(output / "index.html").write_text(f'''<!doctype html>
<html lang="{language}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><link rel="stylesheet" href="/studio-kit.css">
<link rel="stylesheet" href="editor.css"><script src="/studio-plugin.js"></script>
<script type="module" src="boot.mjs"></script></head>
<body><main class="craft-editor"><section class="craft-surface"><canvas id="{canvas_id}"></canvas>
{loading}</section>
<footer><button class="craft-credits kit-button" type="button">Licenses and credits</button></footer>
</main></body></html>
''')
(output / "editor.css").write_text('''.craft-editor { height: 100%; width: 100%; display: grid; grid-template-rows: minmax(0, 1fr) auto; overflow: hidden; }
.craft-editor .craft-surface { position: relative; min-height: 0; }
.craft-editor canvas { width: 100%; height: 100%; display: block; }
.craft-editor .craft-surface div { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.craft-editor footer { text-align: right; }
.craft-editor .craft-license-dialog { max-width: 90%; max-height: 80%; }
.craft-editor .craft-license-dialog pre { white-space: pre-wrap; overflow: auto; }
''')
for name in ("LICENSE-MIT", "LICENSE-APACHE", "NOTICE", "ATTRIBUTION.md"):
    shutil.copyfile(source / name, output / name)
licenses = output / "licenses"
licenses.mkdir()
for path in (source / "assets").rglob("*"):
    if path.is_file() and (path.name.startswith(("OFL", "LICENSE", "COPYRIGHT")) or path.suffix == ".pat"):
        target = licenses / path.relative_to(source / "assets")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
shutil.copyfile(font_dir / "OFL.txt", licenses / "OFL-NotoSansCJKtc.txt")
(output / "CREDITS.txt").write_text(f'''Based on {title} by the ArtCraft Team and {title} contributors.
Copyright (c) 2026 ArtCraft Team and the {title} contributors.
Upstream: https://github.com/storytold/{editor}/tree/{upstream['commit']}
License: MIT OR Apache-2.0; full texts and original NOTICE are included.
Studio modifications: document-center and local file I/O, confirmed asynchronous saves, available Chinese defaults
and Noto Sans CJK TC where needed (OFL-1.1). This is an independently modified Studio plugin.
The upstream team does not endorse or support this integration.
The restricted ArtCraft brand artwork is not included in this package.
The desktop editor uses WebAssembly, WebGL2/WebGPU and the browser's gzip DecompressionStream.
''')
print(f"Assembled {output}; not signed or published")
