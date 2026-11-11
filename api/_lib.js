// st3alth server helpers: responses, bodies, rate limits, a small in-memory cache. No database: st3alth keeps nothing.

function send(res, code, obj, cache = 'no-store') {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (/s-maxage/.test(cache)) { res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate'); res.setHeader('CDN-Cache-Control', cache.replace(/max-age=0,\s*/, '')); }
  else res.setHeader('Cache-Control', cache);
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.end(JSON.stringify(obj));
}
const CACHE = (s, swr = s * 3) => `public, max-age=0, s-maxage=${s}, stale-while-revalidate=${swr}`;
function query(req) { if (req.query) return req.query; return Object.fromEntries(new URL(req.url, 'http://x').searchParams); }
async function body(req, max = 4 * 1024 * 1024) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString('utf8')); } catch { return {}; } }
  const chunks = []; let n = 0;
  for await (const c of req) { chunks.push(c); n += c.length; if (n > max) return {}; }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
function ip(req) { return String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim(); }
const hits = new Map();
function limited(key, n, ms) {
  const now = Date.now(), a = (hits.get(key) || []).filter(t => now - t < ms); a.push(now); hits.set(key, a);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return a.length > n;
}
function err(code, msg, extra) { const e = new Error(msg); e.code = code; e.extra = extra; return e; }
async function getJson(url, opt = {}, ms = 8000) {
  const r = await fetch(url, { ...opt, headers: { accept: 'application/json', 'user-agent': 'st3alth/1.0', ...(opt.headers || {}) }, signal: AbortSignal.timeout(ms) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, ok: r.ok, json: j };
}
const mem = new Map();
// a warm instance can live for hours: once a minute, forget answers nobody has needed for 15 minutes
let pruned = 0;
async function cached(key, ms, fn) {
  const now = Date.now();
  if (mem.size > 500 && now - pruned > 60000) { pruned = now; for (const [k, v] of mem) if (v.has && !v.p && now - v.t > 900000) mem.delete(k); }
  const c = mem.get(key);
  if (c && c.has && Date.now() - c.t < ms) return c.v;
  if (c && c.p) return c.p;
  const p = (async () => {
    try { const v = await fn(); mem.set(key, { t: Date.now(), v, has: true }); return v; }
    catch (e) { if (c && c.has) { mem.set(key, { t: c.t, v: c.v, has: true }); return c.v; } mem.delete(key); throw e; }
  })();
  mem.set(key, { ...(c || {}), p }); return p;
}

module.exports = { send, CACHE, query, body, ip, limited, err, getJson, cached };
