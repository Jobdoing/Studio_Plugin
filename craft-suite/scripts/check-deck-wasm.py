"""Check Deck's native PID call remains excluded from the browser build."""
from pathlib import Path
import re
import sys

source = Path(sys.argv[1]).resolve()
text = (source / "crates/engine/src/recovery.rs").read_text()
body = text.split("pub fn instance_id() -> u64 {", 1)[1].split("fn lock_path", 1)[0]
guarded = re.compile(r'#\[cfg\(not\(target_arch = "wasm32"\)\)\]\s*h\.write_u32\(std::process::id\(\)\);')
assert len(guarded.findall(body)) == 1, "The instance PID call must be native-only"
assert "std::process::id()" not in guarded.sub("", body), "An unguarded PID call would panic in the browser"
assert not guarded.search(body.replace('#[cfg(not(target_arch = "wasm32"))]', "")), "Removing the guard must fail this check"
print("Deck WASM PID source guard passed; real browser startup must also pass")
