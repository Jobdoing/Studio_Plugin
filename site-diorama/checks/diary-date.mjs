import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export function checkDiaryDate(blocks) {
  for (const block of blocks) {
    assert.equal(block.scope, 'project');
    assert.match(block.sql, /AND CAST\(record_date AT TIME ZONE 'Asia\/Taipei' AS DATE\) = DATE '2026-06-01'/);
    assert.match(block.sql, /WHERE is_business_log AND NOT is_deleted/);
  }
}
const blocks = ['summary', 'detail'].map(kind => JSON.parse(readFileSync(new URL(`../plugin/site-diorama/blocks/site-diorama-diary-${kind}.json`, import.meta.url))));
checkDiaryDate(blocks);
for (const index of [0, 1]) {
  const changed = structuredClone(blocks);
  changed[index].sql = changed[index].sql.replace(" = DATE '2026-06-01'", " = DATE '2026-06-02'");
  assert.throws(() => checkDiaryDate(changed), undefined, 'Wrong diary date must fail');
}
console.log('PASS: summary and details use the selected project and June 1, 2026; date mutations detected.');
