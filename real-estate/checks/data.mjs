import assert from 'node:assert/strict';
import * as data from '../plugin/real-estate/data.mjs';

export function verify(api) {
  const filters = { county: 'Taipei', town: 'A&B', address: 'Road #1 + 2' };
  const url = new URL(api.searchUrl(filters, 20));
  assert.equal(url.origin, 'https://toestate.tw');
  assert.equal(url.pathname, '/api/transactions');
  assert.equal(url.searchParams.get('county'), filters.county);
  assert.equal(url.searchParams.get('town'), filters.town);
  assert.equal(url.searchParams.get('address'), filters.address);
  assert.equal(url.searchParams.get('offset'), '20');
  assert.equal(url.searchParams.get('limit'), '20');
  assert.equal(url.searchParams.get('txn_kind'), 'sale');
  assert.equal(url.searchParams.get('include_special'), 'false');
  assert.equal(url.searchParams.get('include_land'), 'false');
  assert.equal(new URL(api.searchUrl({ ...filters, town: ' ', address: '' })).searchParams.has('town'), false);
  for (const offset of [-20, 1, NaN, 1.5]) assert.throws(() => api.searchUrl(filters, offset));
  for (const invalid of [{ ...filters, county: '' }, { ...filters, address: 'x'.repeat(121) }]) assert.throws(() => api.searchUrl(invalid));
  const transaction = { transaction_id: 123, transaction_date: '2026-06-12', total_price: 12500000, unit_price_ping: 625000, area_ping: 20, floor_num: -1 };
  const rows = api.readTransactions({ items: [transaction] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].totalWan, 1250);
  assert.equal(rows[0].unitWan, 62.5);
  assert.equal(rows[0].area, 20);
  assert.equal(rows[0].floor, -1);
  assert.equal(rows[0].age, null);
  const missing = api.readTransactions({ items: [{ transaction_id: 124, transaction_date: '2026-06-13', total_price: null }] })[0];
  assert.equal(missing.totalWan, null);
  assert.equal(missing.unitWan, null);
  assert.equal(missing.area, null);
  assert.equal(missing.address, '');
  assert.deepEqual(api.readTransactions({ items: [] }), []);
  for (const broken of [null, {}, { items: [transaction, null] }, { items: [{ ...transaction, unit_price_ping: '625000' }] }, { items: [{ ...transaction, total_price: -1 }] }, { items: [{ ...transaction, transaction_date: '2026-02-30' }] }]) {
    assert.throws(() => api.readTransactions(broken), /INVALID_DATA/);
  }
  const map = new URL(api.mapsUrl('Road #1 + 2'));
  assert.equal(map.origin, 'https://www.google.com');
  assert.equal(map.pathname, '/maps/search/');
  assert.equal(map.searchParams.get('api'), '1');
  assert.equal(map.searchParams.get('query'), 'Road #1 + 2');
  assert.equal(map.searchParams.has('key'), false);
  assert.throws(() => api.mapsUrl(' '));
}

verify(data);
console.log('PASS: query parameters, units, missing values, invalid data and key-free Maps URLs.');
