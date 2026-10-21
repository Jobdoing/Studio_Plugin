"""Run real PdfCraft UI draft/save roundtrips and reject data-loss mutations."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(sys.argv[1]).resolve()
ui = root / 'crates/ui-egui/src'
expected = Path(__file__).with_name('pdf-draft.rs').read_bytes()
if (ui / 'studio_drafts.rs').read_bytes() != expected:
    raise RuntimeError('Run prepare-pdfcraft.py before checking the actual adapter source')
command = ['cargo', 'test', '--manifest-path', str(root / 'Cargo.toml'), '-p',
           'pdfcraft-ui-egui', '--lib', 'studio_draft_tests', '--locked']
environment = os.environ.copy()
environment.update({
    'CARGO_HOME': '/Volumes/Vibe-Temp/Studio5/cache/cargo',
    'CARGO_TARGET_DIR': '/Volumes/Vibe-Temp/Studio5/craft-plugins/target',
    'TMPDIR': '/Volumes/Vibe-Temp/Studio5/craft-plugins/checks',
    'CRAFT_FONTS_DIR': '/Volumes/Vibe-Temp/Studio5/craft-plugins/fonts',
    'CRAFT_FONTS_REQUIRED': '1',
})
environment['RUSTC'] = subprocess.check_output(['rustup', 'which', 'rustc'], text=True).strip()


def run():
    with tempfile.TemporaryDirectory(prefix='pdfcraft-draft-check-', dir=environment['TMPDIR']) as scratch:
        return subprocess.run(command, env={**environment, 'TMPDIR': scratch}, text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


baseline = run()
if baseline.returncode:
    print(baseline.stdout[-7000:])
    sys.exit(baseline.returncode)
if 'test result: ok. 9 passed; 0 failed; 0 ignored;' not in baseline.stdout:
    print(baseline.stdout[-7000:])
    raise RuntimeError('Expected all nine real UI draft checks without ignored tests')
print('PdfCraft real UI draft/save checks: 9 passed')

file = ui / 'editing.rs'
original = file.read_text()
mutations = [
    ('draft close protection', '            || v.content.has_unsaved_draft(doc.added())', '',
     'drawable_draft_blocks_close_and_cancel_keeps_the_draft'),
    ('draft serialization', ' && self.studio_commit_content_draft(id)', '',
     'save_commits_the_requested_tabs_draft_and_reopens_its_actual_pdf_text'),
    ('paragraph text/style serialization', ' && self.studio_commit_line_editor(id)', '',
     'existing_paragraph_text_and_style_are_saved_and_reopened'),
    ('comment serialization', ' && self.studio_commit_comment_drafts(id)', '',
     'all_comment_text_drafts_save_and_reopen_in_the_pdf'),
    ('bookmark title serialization', ' && self.studio_commit_bookmark_draft(id)', '',
     'bookmark_title_draft_is_saved_on_its_original_document'),
]
for label, before, after, test in mutations:
    if original.count(before) != 1:
        raise RuntimeError(f'Mutation anchor changed: {label}')
    try:
        file.write_text(original.replace(before, after))
        mutant = run()
    finally:
        file.write_text(original)
    if mutant.returncode == 0 or f'{test} ... FAILED' not in mutant.stdout:
        print(mutant.stdout[-7000:])
        raise RuntimeError(f'The real UI checks did not reject the {label} mutation')
    print(f'Mutation rejected: {label}; original source restored')
