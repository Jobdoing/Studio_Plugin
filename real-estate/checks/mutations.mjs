import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verify } from './data.mjs';

const source = readFileSync(new URL('../plugin/real-estate/data.mjs', import.meta.url), 'utf8');
const mutations = [
  ['page size', 'PAGE_SIZE = 20', 'PAGE_SIZE = 50'],
  ['special transactions', 'include_special: false', 'include_special: true'],
  ['price conversion', 'optionalNumber(row.unit_price_ping) / 10000', 'optionalNumber(row.unit_price_ping) / 1000'],
  ['missing price', 'row.total_price == null ? null', 'row.total_price == null ? 0'],
  ['Maps protocol', "set('api', '1')", "set('api', '0')"],
];
for (const [name, from, to] of mutations) {
  assert.ok(source.includes(from), `Mutation target missing: ${name}`);
  const mutated = source.replace(from, to);
  const module = await import(`data:text/javascript;base64,${Buffer.from(mutated).toString('base64')}`);
  assert.throws(() => verify(module), `Mutation survived: ${name}`);
}
console.log(`PASS: all ${mutations.length} intentional regressions detected.`);
