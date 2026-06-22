const fetch           = require('node-fetch');
const { kvGetSecret } = require('./kv');

async function getPax8Token() {
  const clientId     = await kvGetSecret('pax8-client-id');
  const clientSecret = await kvGetSecret('pax8-client-secret');
  if (!clientId || !clientSecret) throw new Error('Pax8 credentials not found in Key Vault (pax8-client-id / pax8-client-secret).');
  const res = await fetch('https://api.pax8.com/v1/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, audience: 'https://api.pax8.com', grant_type: 'client_credentials' })
  });
  if (!res.ok) throw new Error(`Pax8 auth failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function pax8Paginate(token, endpoint) {
  let all = [], page = 0;
  while (true) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.pax8.com/v1${endpoint}${sep}page=${page}&size=200`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Pax8 error ${res.status} on ${endpoint}`);
    const data = await res.json();
    const items = data.data || data.content || (Array.isArray(data) ? data : []);
    if (!items.length) break;
    all = all.concat(items);
    page++;
    if (items.length < 200) break;
  }
  return all;
}

const productNameCache    = new Map();
const productDetailsCache = new Map();

async function resolveProductDetails(token, productId) {
  if (!productId) return { name: null, vendorName: null, vendorSku: null };
  if (productDetailsCache.has(productId)) return productDetailsCache.get(productId);
  try {
    const res = await fetch(`https://api.pax8.com/v1/products/${productId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { const empty = { name: null, vendorName: null, vendorSku: null }; productDetailsCache.set(productId, empty); return empty; }
    const p = await res.json();
    const prod = p.data || p;
    const rawSku = prod.vendorSku || prod.sku || prod.partNumber || prod.vendorPartNumber || null;
    let vendorSku = rawSku;
    if (typeof rawSku === 'string' && rawSku.trim().startsWith('{')) {
      try { const parsed = JSON.parse(rawSku); vendorSku = parsed.productId || parsed.skuId || rawSku; } catch {}
    } else if (rawSku && typeof rawSku === 'object') {
      vendorSku = rawSku.productId || rawSku.skuId || JSON.stringify(rawSku);
    }
    const details = {
      name:       prod.name || prod.productName || null,
      vendorName: prod.vendorName || prod.vendor?.name || null,
      vendorSku,
    };
    productDetailsCache.set(productId, details);
    productNameCache.set(productId, details.name);
    return details;
  } catch {
    const empty = { name: null, vendorName: null, vendorSku: null };
    productDetailsCache.set(productId, empty);
    return empty;
  }
}

async function resolveProductName(token, sub) {
  const direct = sub.productName || sub.product?.name || sub.name;
  if (direct) return direct;
  const id = sub.productId || sub.product?.id;
  if (!id) return null;
  if (productNameCache.has(id)) return productNameCache.get(id);
  const details = await resolveProductDetails(token, id);
  return details.name;
}

function clearProductNameCache() { productNameCache.clear(); }

module.exports = { getPax8Token, pax8Paginate, resolveProductName, resolveProductDetails, clearProductNameCache };
