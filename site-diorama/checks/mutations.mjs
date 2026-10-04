import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkData } from './data.mjs';

const source = readFileSync(new URL('../plugin/site-diorama/data.mjs', import.meta.url), 'utf8');
const mutations = [
  ['open count becomes total', "value, overdue", "value: total, overdue"],
  ['invalid population accepted', 'if (value > total)', 'if (false)'],
  ['null becomes zero', 'Number.isSafeInteger(value)', 'Number.isSafeInteger(value ?? 0)'],
  ['all-projects query allowed', "project.project_handle === '__all__'", 'false'],
  ['scope omitted from query', '{ project_handle: project.project_handle }', '{}']
];
for (const [name, before, after] of mutations) {
  assert.ok(source.includes(before), `Mutation target missing: ${name}`);
  const api = await import(`data:text/javascript;base64,${Buffer.from(source.replace(before, after)).toString('base64')}`);
  assert.throws(() => checkData(api), undefined, `Mutation survived: ${name}`);
}
console.log('PASS: all 5 intentional regressions detected.');
