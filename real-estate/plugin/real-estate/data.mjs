export const PAGE_SIZE = 20;

export function searchUrl(filters, offset = 0) {
  const values = {};
  for (const [key, max] of [['county', 12], ['town', 20], ['address', 120]]) {
    if (typeof filters[key] !== 'string' || filters[key].trim().length > max) throw new Error('INVALID_FILTERS');
    values[key] = filters[key].trim();
  }
  if (!values.county || !Number.isSafeInteger(offset) || offset < 0 || offset % PAGE_SIZE !== 0) throw new Error('INVALID_FILTERS');
  const url = new URL('https://toestate.tw/api/transactions');
  for (const [key, value] of Object.entries(values)) if (value) url.searchParams.set(key, value);
  for (const [key, value] of Object.entries({ txn_kind: 'sale', include_special: false, include_land: false, limit: PAGE_SIZE, offset })) {
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

function optionalNumber(value, signed = false) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || (!signed && value < 0)) throw new Error('INVALID_DATA');
  return value;
}

export function readTransactions(data) {
  if (!data || !Array.isArray(data.items) || data.items.length > PAGE_SIZE) throw new Error('INVALID_DATA');
  // Fail the whole page on malformed records; never quietly drop a transaction.
  return data.items.map(row => {
    if (!row || !Number.isSafeInteger(row.transaction_id) || row.transaction_id <= 0 ||
        typeof row.transaction_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.transaction_date) ||
        !Number.isFinite(Date.parse(row.transaction_date)) || new Date(row.transaction_date).toISOString().slice(0, 10) !== row.transaction_date) {
      throw new Error('INVALID_DATA');
    }
    return {
      id: row.transaction_id, date: row.transaction_date,
      address: typeof row.address_norm === 'string' ? row.address_norm : '',
      community: typeof row.community_name === 'string' ? row.community_name : '',
      buildingType: typeof row.building_type === 'string' ? row.building_type : '',
      totalWan: row.total_price == null ? null : optionalNumber(row.total_price) / 10000,
      unitWan: row.unit_price_ping == null ? null : optionalNumber(row.unit_price_ping) / 10000,
      area: optionalNumber(row.area_ping), floor: optionalNumber(row.floor_num, true), age: optionalNumber(row.age_years),
    };
  });
}

export function mapsUrl(address) {
  if (typeof address !== 'string' || !address.trim()) throw new Error('INVALID_ADDRESS');
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', address.trim());
  return url.href;
}
