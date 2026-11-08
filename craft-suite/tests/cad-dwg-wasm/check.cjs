const fs = require('node:fs');
const { verify } = require('./node/studio_dwg_check.js');
const input = fs.readFileSync(`${__dirname}/native.dwg`);
const output = verify(input);
fs.writeFileSync(`${__dirname}/wasm.dwg`, output);
console.log(JSON.stringify({ status: 'passed', runtime: 'Node WASM', inputBytes: input.length, outputBytes: output.length }));
