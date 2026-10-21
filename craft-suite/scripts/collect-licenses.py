"""Keep dependency license texts for the actual web dependency graph, not other workspace apps."""
import json
import re
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

metadata, package, output = sys.argv[1:]
data = json.loads(Path(metadata).read_text())
nodes = {row["id"]: row for row in data["resolve"]["nodes"]}
root = next(row["id"] for row in data["packages"] if row["name"] == package)
todo, reachable = [root], set()
while todo:
    key = todo.pop()
    if key in reachable:
        continue
    reachable.add(key)
    todo.extend(dep["pkg"] for dep in nodes[key]["deps"] if any(kind["kind"] != "dev" for kind in dep["dep_kinds"]))
output = Path(output)
inventory, missing = [], []
upstream_texts = {}
for row in data["packages"]:
    if row["id"] not in reachable:
        continue
    source = Path(row["manifest_path"]).parent
    target = output / f'{row["name"]}-{row["version"]}'
    found = []
    # Workspace crates often inherit the repository-root license.
    for parent in [source, *list(source.parents)[:4]]:
        for path in parent.iterdir():
            if path.is_file() and re.search(r"license|copying|notice|copyright|ofl|attribution", path.name, re.I):
                found.append(path)
        if found:
            break
    # Bundled font/material licenses can live below the crate root as well.
    found.extend(path for path in source.rglob("*") if path.is_file() and re.search(r"license|copying|notice|copyright|ofl|attribution", str(path.relative_to(source)), re.I))
    if row.get("license_file"):
        found.append(Path(row["license_file"]))
    found = list(dict.fromkeys(found))
    if not found:
        # Some published crates omit their repository-root license. Fetch only the
        # exact revision recorded in the crate archive, never an unpinned main.
        vcs_file = source / ".cargo_vcs_info.json"
        repository = row["repository"] or ""
        match = re.fullmatch(r"https://github.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)(?:/.*)?", repository)
        revision = json.loads(vcs_file.read_text())["git"]["sha1"] if vcs_file.exists() else ""
        if not match or not re.fullmatch(r"[a-f0-9]{40}", revision):
            missing.append(f'{row["name"]}-{row["version"]}')
            continue
        key = (match[1].removesuffix(".git"), revision)
        if key not in upstream_texts:
            texts = {}
            for name in ("LICENSE", "LICENSE.txt", "LICENSE.md", "LICENSE-MIT", "LICENSE-APACHE", "LICENSE-MIT.txt", "LICENSE-APACHE.txt", "COPYING"):
                url = f"https://raw.githubusercontent.com/{key[0]}/{revision}/{name}"
                try:
                    with urllib.request.urlopen(url, timeout=30) as response:
                        content = response.read()
                        if b"<html" in content[:500].lower():
                            raise RuntimeError(f"License endpoint returned HTML: {url}")
                        texts[name] = content
                except urllib.error.HTTPError as error:
                    if error.code != 404:
                        raise
            upstream_texts[key] = texts
        texts = upstream_texts[key]
        if not texts:
            missing.append(f'{row["name"]}-{row["version"]}')
            continue
        target.mkdir(parents=True, exist_ok=True)
        for name, content in texts.items():
            (target / name).write_bytes(content)
        inventory.append({"name": row["name"], "version": row["version"], "license": row["license"], "repository": repository, "revision": revision, "texts": list(texts)})
        continue
    target.mkdir(parents=True, exist_ok=True)
    files = []
    for index, path in enumerate(found):
        name = f"{index:03d}-{path.name}"
        shutil.copyfile(path, target / name)
        files.append(name)
    inventory.append({"name": row["name"], "version": row["version"], "license": row["license"], "repository": row["repository"], "texts": files})
output.mkdir(parents=True, exist_ok=True)
packages = {(row["name"], row["version"]): row for row in data["packages"]}
sources = ["Dependency source availability", "", "Full license texts are retained next to this file.",
           "Registry source archives are the exact published crate versions, without Studio modifications.",
           "For a dual license offering Apache-2.0 or GPL, this distribution uses Apache-2.0.", ""]
for entry in inventory:
    row = packages[(entry["name"], entry["version"])]
    entry["source"] = row["source"]
    if (row["source"] or "").startswith("registry+"):
        entry["source_url"] = f'https://crates.io/api/v1/crates/{entry["name"]}/{entry["version"]}/download'
    sources.append(f'{entry["name"]} {entry["version"]} ({entry["license"]}): {entry.get("source_url") or entry["source"] or entry["repository"]}')
(output / "SOURCES.txt").write_text('\n'.join(sources) + '\n')
(output / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
if missing:
    raise RuntimeError("License texts not found: " + ", ".join(missing))
print(f"Retained license texts for {len(inventory)} web dependency packages")
