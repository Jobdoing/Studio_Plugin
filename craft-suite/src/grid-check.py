"""Check save acknowledgements against the real engine and one data-loss mutation."""
import os
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
harness = root / 'crates/engine/tests/studio_grid_save.rs'
expected = Path(__file__).with_name('grid-save.rs').read_text().split('impl crate::SheetApp {')[0]
if harness.read_text() != expected:
    raise RuntimeError('Run prepare-gridcraft.py before checking the exact adapter source')

command = ['cargo', 'test', '--manifest-path', str(root / 'Cargo.toml'), '-p',
           'gridcraft-engine', '--test', 'studio_grid_save', '--locked']
environment = os.environ.copy()
environment.setdefault('CARGO_HOME', '/Volumes/Vibe-Temp/Studio5/cache/cargo')
environment.setdefault('CARGO_TARGET_DIR', '/Volumes/Vibe-Temp/Studio5/craft-plugins/target-grid')
environment['RUSTC'] = subprocess.check_output(['rustup', 'which', 'rustc'], text=True).strip()


def run():
    return subprocess.run(command, env=environment, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


baseline = run()
if baseline.returncode:
    print(baseline.stdout[-7000:])
    sys.exit(baseline.returncode)
if 'test result: ok. 7 passed; 0 failed; 0 ignored;' not in baseline.stdout:
    print(baseline.stdout[-7000:])
    raise RuntimeError('Expected all seven save checks to run without ignored tests')
print('GridCraft save checks: 7 passed')

original = harness.read_text()
guard = '''if error != "CANCELLED" {
                    errors.push(error);
                }
                continue;'''
if original.count(guard) != 1:
    raise RuntimeError('The acknowledgement guard changed; update the targeted mutation')
try:
    harness.write_text(original.replace(guard, guard.replace('                continue;', '')))
    mutant = run()
finally:
    harness.write_text(original)
failed_test = 'tests::rejected_or_cancelled_save_keeps_dirty_and_document_open ... FAILED'
if mutant.returncode == 0 or failed_test not in mutant.stdout:
    print(mutant.stdout[-7000:])
    raise RuntimeError('The tests did not reject the save-without-acknowledgement mutation')
print('Mutation check: removing the failed-save guard was rejected; source restored')

format_guard = 'return title;'
if original.count(format_guard) != 1:
    raise RuntimeError('The source-format guard changed; update the targeted mutation')
try:
    harness.write_text(original.replace(format_guard, 'return std::path::Path::new(&title).with_extension("xlsx").to_string_lossy().into_owned();'))
    mutant = run()
finally:
    harness.write_text(original)
failed_test = 'tests::opened_macro_workbook_keeps_its_format_and_vba_after_acknowledgement ... FAILED'
if mutant.returncode == 0 or failed_test not in mutant.stdout:
    print(mutant.stdout[-7000:])
    raise RuntimeError('The tests did not reject replacing the source format with .xlsx')
print('Mutation check: forcing .xlsx instead of the source format was rejected; source restored')

serialization = 'gridcraft_engine::io::save_bytes(&doc.wb, &name)'
if original.count(serialization) != 1:
    raise RuntimeError('The serialization call changed; update the targeted mutation')
try:
    harness.write_text(original.replace(serialization, 'gridcraft_engine::io::save_bytes(&doc.wb, "forced.xlsx")'))
    mutant = run()
finally:
    harness.write_text(original)
if mutant.returncode == 0 or failed_test not in mutant.stdout:
    print(mutant.stdout[-7000:])
    raise RuntimeError('The tests did not reject VBA removal from the serialized bytes')
print('Mutation check: serializing macro workbooks as macro-free bytes was rejected; source restored')
