import assert from 'node:assert/strict';
import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const calculate = globalThis.toolboxCalculate;
const examples = globalThis.toolboxExamples;

// Every tool has one example, and each spec-derived expected value matches the calculation.
assert.deepEqual(Object.keys(examples).sort(), Object.keys(calculate).sort());
for (const [tool, { note, values, expect }] of Object.entries(examples)) {
  assert.ok(note && Object.keys(expect).length, `${tool}: example needs a note and expected values`);
  const result = calculate[tool](values);
  for (const [key, want] of Object.entries(expect)) {
    const got = result[key];
    assert.ok(Math.abs(got - want) <= Math.max(1e-6, Math.abs(want) * 1e-6), `${tool}.${key}: ${got} != ${want}`);
  }
}
console.log(`All ${Object.keys(examples).length} tool examples match their expected values.`);
