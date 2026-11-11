// st3alth privacy API: what a stranger can link to a wallet, read through Helius.
//   trace   funding chain (who funded whom, up to 3 hops), counterparties with labels, habits, a score
//   funded  just the funding chain        ident  the label Helius has for an address (exchange, protocol, …)
//   net     is Helius on, how fast, the slot, a priority fee estimate     wbal  balances with prices and logos
// It never holds keys or funds. With no HELIUS_API_KEY every op says so; on Helius's free plan the wallet labels and
// funded-by are not available (they answer 403), and trace falls back to what the transfers alone can show.
const L = require('./_lib');
const C = require('./_chain');
const KEY = process.env.HELIUS_API_KEY || '';
const HOST = 'https://api.helius.xyz';
const SOL = 'So11111111111111111111111111111111111111112';

async function hel(path, { method = 'GET', body, ms = 9000 } = {}, tries = 3) {
  if (!KEY) throw L.err(503, 'Helius is not set up on this server yet.');
  const r = await fetch(HOST + path, { method, headers: { 'X-Api-Key': KEY, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(ms) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  if (r.status === 404) return null;
  if (r.status === 429 && tries > 1) { await new Promise(z => setTimeout(z, 650 * (4 - tries) + Math.random() * 450)); return hel(path, { method, body, ms }, tries - 1); }
  if (!r.ok) throw L.err(r.status === 403 ? 403 : r.status === 429 ? 429 : r.status === 400 ? 400 : 502, String((j && (j.error || j.message)) || 'helius ' + r.status).slice(0, 160));
  return j;
}
// the paid wallet endpoints answer 403 on the free plan; remember that for a while instead of asking every time
let PLAN = { wallet: null, at: 0 };
const planOk = () => PLAN.wallet !== false || Date.now() - PLAN.at > 600000;
async function paid(fn) {
  if (!planOk()) return null;
  try { const v = await fn(); PLAN = { wallet: true, at: Date.now() }; return v; }
  catch (e) { if (e.code === 403) { PLAN = { wallet: false, at: Date.now() }; return null; } throw e; }
}
const idCache = new Map();
async function identity(addr) {
  if (idCache.has(addr)) return idCache.get(addr);
  const v = await paid(() => hel(`/v1/wallet/${addr}/identity`)).catch(() => null);
  const out = v ? { name: v.name || null, type: v.type || null, category: v.category || null, tags: v.tags || [], domains: v.domainNames || [] } : null;
  idCache.set(addr, out); if (idCache.size > 20000) idCache.delete(idCache.keys().next().value); return out;
}
async function identities(addrs) {
  const want = [...new Set(addrs)].filter(a => !idCache.has(a)).slice(0, 100);
  if (want.length) {
    const v = await paid(() => hel('/v1/wallet/batch-identity', { method: 'POST', body: { addresses: want } })).catch(() => null);
    const list = Array.isArray(v) ? v : v && (v.data || v.results || v.identities) || [];
    const got = new Set();
    for (const x of list) if (x && x.address) { got.add(x.address); idCache.set(x.address, { name: x.name || null, type: x.type || null, category: x.category || null, tags: x.tags || [], domains: x.domainNames || [] }); }
    if (v) for (const a of want) if (!got.has(a)) idCache.set(a, null);
  }
  return Object.fromEntries(addrs.map(a => [a, idCache.get(a) || null]));
}
const fundCache = new Map();
async function fundedBy(addr) {
  if (fundCache.has(addr)) return fundCache.get(addr);
  const v = await paid(() => hel(`/v1/wallet/${addr}/funded-by`));
  const out = v && v.funder ? { addr: v.funder, name: v.funderName || null, type: v.funderType || null, amount: v.amount, date: v.date || (v.timestamp ? new Date(v.timestamp * 1000).toISOString() : null), sig: v.signature || null } : null;
  if (v !== undefined) fundCache.set(addr, out);
  return out;
}
async function transfers(addr, pages = 3) {
  const out = []; let cursor = null, more = false;
  for (let i = 0; i < pages; i++) {
    const j = await hel(`/v1/wallet/${addr}/transfers?limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    if (!j) break; out.push(...(j.data || [])); more = !!(j.pagination && j.pagination.hasMore); cursor = j.pagination && j.pagination.nextCursor;
    if (!more || !cursor) break;
  }
  return { list: out, more };
}
const isCex = id => !!id && (/exchange/i.test(id.type || '') || /centrali[sz]ed exchange/i.test(id.category || ''));
const kind = id => !id ? null : isCex(id) ? 'cex' : /bridge/i.test(id.category || '') ? 'bridge' : /defi|amm|dex|protocol|stake|vault/i.test((id.category || '') + ' ' + (id.type || '')) ? 'defi' : /scam|hack|exploit|rug/i.test(id.category || '') ? 'risk' : 'known';

// ---------------------------------------------------------------- names: .sol domains, read straight from the name service
// (no paid plan needed: the domain account and its reverse record are plain accounts on chain)
const NAME_PROG = 'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX', SOL_TLD = '58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx', REV_CLASS = '33m47vH6Eav6jJBNabXxsNs5PP1MqCrLWXv86Xm2nBWU';
const hashName = s => require('crypto').createHash('sha256').update('SPL Name Service' + s).digest();
function nameKey(hashed, cls, parent) { const W = C.w3(); return W.PublicKey.findProgramAddressSync([hashed, cls ? new W.PublicKey(cls).toBuffer() : Buffer.alloc(32), parent ? new W.PublicKey(parent).toBuffer() : Buffer.alloc(32)], new W.PublicKey(NAME_PROG))[0].toBase58(); }
async function resolveSol(name) {
  const n = String(name).toLowerCase().replace(/\.sol$/, ''); if (!/^[a-z0-9_-]{1,63}$/.test(n)) return null;
  return L.cached('rs:' + n, 600000, async () => {
    const r = await C.rawRpc('getAccountInfo', [nameKey(hashName(n), null, SOL_TLD), { encoding: 'base64', commitment: 'confirmed' }], 8000);
    if (!r || !r.value) return null; return C.b58enc(Buffer.from(r.value.data[0], 'base64').subarray(32, 64));
  });
}
async function namesOf(owner) {
  return L.cached('ns:' + owner, 900000, async () => {
    const list = await C.rawRpc('getProgramAccounts', [NAME_PROG, { encoding: 'base64', dataSlice: { offset: 0, length: 0 }, filters: [{ memcmp: { offset: 0, bytes: SOL_TLD } }, { memcmp: { offset: 32, bytes: owner } }] }], 12000);
    const keys = (list || []).map(x => x.pubkey).slice(0, 12); if (!keys.length) return [];
    const r = await C.rawRpc('getMultipleAccounts', [keys.map(k => nameKey(hashName(k), REV_CLASS, null)), { encoding: 'base64', commitment: 'confirmed' }], 8000);
    return ((r && r.value) || []).map(v => { try { if (!v) return null; const d = Buffer.from(v.data[0], 'base64').subarray(96), n = d.readUInt32LE(0); const s = d.subarray(4, 4 + n).toString('utf8'); return /^[\w-]{1,63}$/.test(s) ? s + '.sol' : null; } catch { return null; } }).filter(Boolean);
  });
}

// ---------------------------------------------------------------- bundle: the 20 biggest holders of a coin, who funded each, and who is secretly the same person
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch(() => null); } })); return out; }
const isSol = x => x.mint === SOL || /^SOL$/i.test(x.symbol || '');
async function firstFunding(owner) {        // the oldest incoming SOL we can see, how old the wallet looks, and who it touched
  return L.cached('ff:' + owner, 900000, async () => {
    const j = await hel(`/v1/wallet/${owner}/transfers?limit=100`), list = (j && j.data) || [], more = !!(j && j.pagination && j.pagination.hasMore);
    const ins = list.filter(x => x.direction === 'in' && isSol(x) && x.counterparty && x.counterparty !== owner), o = ins[ins.length - 1];
    const ts = list.map(x => x.timestamp).filter(Boolean);
    return { n: list.length, more, first: ts.length ? Math.min(...ts) : null, funder: o ? { addr: o.counterparty, amount: +o.amount || 0, t: o.timestamp || null, sig: o.signature || null, sure: !more } : null,
      cps: [...new Set(list.map(x => x.counterparty).filter(Boolean))].slice(0, 200) };
  });
}
async function isBusy(addr) {               // an exchange hot wallet, a bot or a router: a hundred transfers inside six hours
  return L.cached('busy:' + addr, 3600000, async () => {
    const j = await hel(`/v1/wallet/${addr}/transfers?limit=100`), list = (j && j.data) || [];
    if (list.length < 100) return false; const ts = list.map(x => x.timestamp).filter(Boolean); return ts.length > 50 && Math.max(...ts) - Math.min(...ts) < 6 * 3600;
  });
}
async function devOf(mint) {
  const W = C.w3(), pda = W.PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), new W.PublicKey(mint).toBuffer()], new W.PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'))[0].toBase58();
  const r = await C.rawRpc('getAccountInfo', [pda, { encoding: 'base64', commitment: 'confirmed' }], 8000);
  if (!r || !r.value) return null; const d = Buffer.from(r.value.data[0], 'base64'); if (d.length < 81) return null;
  const k = C.b58enc(d.subarray(49, 81)); return k === '11111111111111111111111111111111' ? null : { addr: k, curve: pda };
}
async function bundle(mint) {
  return L.cached('bd:' + mint, 300000, async () => {
    const W = C.w3(), pk = new W.PublicKey(mint);
    const [big, sup] = await Promise.all([C.rpc(c => c.getTokenLargestAccounts(pk, 'confirmed')), C.rpc(c => c.getTokenSupply(pk, 'confirmed'))]);
    const accts = (big.value || []).slice(0, 20), total = Number(sup.value.uiAmount) || 0;
    if (!accts.length) throw L.err(404, 'No holders found for that coin.');
    const infos = await C.rpc(c => c.getMultipleParsedAccounts(accts.map(a => a.address)));
    const byOwner = new Map();
    accts.forEach((a, i) => {
      const p = infos.value[i] && infos.value[i].data && infos.value[i].data.parsed, owner = p && p.info && p.info.owner, ui = Number(a.uiAmount) || 0; if (!owner || !ui) return;
      const h = byOwner.get(owner) || { owner, ui: 0, pct: 0, pool: !W.PublicKey.isOnCurve(new W.PublicKey(owner).toBytes()) }; h.ui += ui; h.pct = total ? h.ui / total * 100 : 0; byOwner.set(owner, h);
    });
    const holders = [...byOwner.values()].sort((a, b) => b.ui - a.ui), people = holders.filter(h => !h.pool);
    const [ff, dev] = await Promise.all([pool(people, 3, h => firstFunding(h.owner)), devOf(mint).catch(() => null)]);
    if (dev) { const f = byOwner.has(dev.addr) ? null : await firstFunding(dev.addr).catch(() => null); dev.funder = f ? f.funder : null; }
    people.forEach((h, i) => { const f = ff[i]; h.n = f ? f.n : null; h.more = f ? f.more : null; h.first = f ? f.first : null; h.funder = f ? f.funder : null; h.cps = f ? f.cps : []; });
    // a funder behind two or more holders is the classic bundle: one wallet splits SOL into many, each buys
    const by = new Map(); for (const h of people) if (h.funder) { const k = h.funder.addr; if (!by.has(k)) by.set(k, []); by.get(k).push(h); }
    if (dev && byOwner.has(dev.addr)) { const i = people.findIndex(h => h.owner === dev.addr); if (i >= 0 && ff[i]) dev.funder = ff[i].funder; }
    const shared = [...new Set([...by.keys()].filter(k => by.get(k).length > 1 || byOwner.has(k)).concat(dev && dev.funder ? [dev.funder.addr] : []))];
    const busy = Object.fromEntries((await pool(shared, 4, async k => [k, await isBusy(k)])).filter(Boolean));
    const ids = await identities(shared).catch(() => ({}));
    const noise = k => busy[k] || (ids[k] && (isCex(ids[k]) || kind(ids[k]) === 'defi'));
    // union-find: same private funder, a direct transfer between two holders, or one holder funding another
    const P = new Map(people.map(h => [h.owner, h.owner])), find = x => { while (P.get(x) !== x) { P.set(x, P.get(P.get(x))); x = P.get(x); } return x; }, join = (a, b) => { if (P.has(a) && P.has(b)) P.set(find(a), find(b)); };
    for (const [k, l] of by) if (!noise(k)) { for (let i = 1; i < l.length; i++) join(l[0].owner, l[i].owner); if (P.has(k)) join(k, l[0].owner); }
    // the dev: whoever it funded, and whoever shares its funder, is the dev's crowd
    let devOut = null;
    if (dev) {
      const funded = people.filter(h => h.funder && h.funder.addr === dev.addr), sib = dev.funder && !noise(dev.funder.addr) ? people.filter(h => h.owner !== dev.addr && h.funder && h.funder.addr === dev.funder.addr) : [];
      const crew = [...funded, ...sib].map(h => h.owner); if (P.has(dev.addr)) crew.forEach(o => join(dev.addr, o)); else for (let i = 1; i < crew.length; i++) join(crew[0], crew[i]);
      const me = byOwner.get(dev.addr);
      devOut = { addr: dev.addr, holder: !!me, pct: me ? me.pct : 0, funded: funded.map(h => h.owner), siblings: sib.map(h => h.owner), funder: dev.funder ? dev.funder.addr : null, funderBusy: !!(dev.funder && busy[dev.funder.addr]) };
    }
    const set = new Set(people.map(h => h.owner)), seenL = new Set(), links = [];
    for (const h of people) for (const c of h.cps) if (set.has(c) && c !== h.owner) { const key = [h.owner, c].sort().join(':'); if (!seenL.has(key)) { seenL.add(key); links.push([h.owner, c]); join(h.owner, c); } }
    const groups = new Map(); for (const h of people) { const r = find(h.owner); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(h); }
    const clusters = [...groups.values()].filter(g => g.length > 1).map(g => {
      const fs = [...new Set(g.map(h => h.funder && h.funder.addr).filter(k => k && !noise(k) && by.get(k) && (by.get(k).length > 1 || set.has(k))))], ts = g.filter(h => h.funder && fs.includes(h.funder.addr)).map(h => h.funder.t).filter(Boolean);
      const dv = !!devOut && g.some(h => h.owner === devOut.addr || devOut.funded.includes(h.owner) || devOut.siblings.includes(h.owner));
      return { members: g.map(h => h.owner), pct: g.reduce((a, h) => a + h.pct, 0), funders: fs, spread: ts.length > 1 ? Math.max(...ts) - Math.min(...ts) : null, direct: g.some(h => links.some(l => l.includes(h.owner))), dev: dv };
    }).sort((a, b) => b.pct - a.pct);
    clusters.forEach((c, i) => c.members.forEach(m => { byOwner.get(m).cluster = i; }));
    const now = Date.now() / 1000, fresh = people.filter(h => h.first && !h.more && now - h.first < 3 * 86400);
    const clustered = clusters.reduce((a, c) => a + c.pct, 0), sum = l => l.reduce((a, h) => a + h.pct, 0);
    const out = {
      mint, supply: total, at: Date.now(), plan: PLAN.wallet === false ? 'basic' : 'full',
      holders: holders.map(h => ({ owner: h.owner, pct: h.pct, pool: h.pool, n: h.n ?? null, more: h.more ?? null, first: h.first ?? null, cluster: h.cluster ?? -1, fresh: fresh.includes(h),
        funder: h.funder ? { addr: h.funder.addr, t: h.funder.t, amount: h.funder.amount, sure: h.funder.sure, busy: !!busy[h.funder.addr], label: ids[h.funder.addr] && ids[h.funder.addr].name || null } : null })),
      links, clusters, dev: devOut,
      stats: { dev: devOut ? (devOut.pct + people.filter(h => devOut.funded.includes(h.owner) || devOut.siblings.includes(h.owner)).reduce((a, h) => a + h.pct, 0)) : null, holders: holders.length, people: people.length, pools: sum(holders.filter(h => h.pool)), top10: sum(holders.slice(0, 10).filter(h => !h.pool)), clustered, fresh: sum(fresh), unknown: people.filter(h => !h.funder).length },
    };
    out.grade = clustered >= 35 ? 'heavily bundled' : clustered >= 15 ? 'bundled' : clustered >= 5 ? 'some links' : 'clean';
    return out;
  });
}

// ---------------------------------------------------------------- follow: the newest moves of a wallet, for a live tail
async function moves(addr) {
  return L.cached('mv:' + addr, 8000, async () => {
    const j = await hel(`/v1/wallet/${addr}/transfers?limit=25`), list = (j && j.data) || [];
    const ids = await identities(list.map(x => x.counterparty).filter(Boolean)).catch(() => ({}));
    return { addr, at: Date.now(), moves: list.map(x => ({ sig: x.signature, t: x.timestamp, dir: x.direction, amount: +x.amount || 0, sym: x.symbol || (x.mint === SOL ? 'SOL' : null), mint: x.mint, cp: x.counterparty || null, label: x.counterparty && ids[x.counterparty] ? ids[x.counterparty].name || null : null })) };
  });
}

// ---------------------------------------------------------------- the trace
async function trace(addr) {
  return L.cached('tr:' + addr, 600000, async () => {
    const within = (p, ms, v) => Promise.race([p.catch(() => v), new Promise(r => setTimeout(() => r(v), ms))]);
    const [id0, tr, names] = await Promise.all([identity(addr), transfers(addr, 3), within(namesOf(addr), 4500, [])]);
    const self = id0 || (names.length ? { name: null, type: null, category: null, tags: [], domains: names } : null);
    if (self && names.length && !(self.domains || []).length) self.domains = names;
    // the funding chain, hop by hop, until it reaches an exchange or runs out (3 hops at most)
    const chain = []; let cur = addr;
    for (let hop = 0; hop < 3; hop++) {
      let f = await fundedBy(cur).catch(() => null);
      if (!f && hop === 0) {                       // free plan: the oldest incoming SOL we can see stands in for it
        const ins = tr.list.filter(x => x.direction === 'in' && (x.mint === SOL || /^SOL$/i.test(x.symbol || '')));
        const o = ins[ins.length - 1]; if (o) f = { addr: o.counterparty, name: null, type: null, amount: o.amount, date: new Date(o.timestamp * 1000).toISOString(), sig: o.signature, guess: !!tr.more };
      }
      if (!f) break;
      const id = f.name ? { name: f.name, type: f.type, category: f.type } : await identity(f.addr);
      chain.push({ ...f, label: id, kind: kind(id) || (f.type ? (/exchange/i.test(f.type) ? 'cex' : 'known') : null) });
      if (chain[chain.length - 1].kind === 'cex' || chain.some((c, i) => i < chain.length - 1 && c.addr === f.addr)) break;
      cur = f.addr;
    }
    // counterparties: who this wallet sends to and hears from
    const cp = new Map(), hours = Array(24).fill(0), days = Array(7).fill(0), mints = new Set();
    let solIn = 0, solOut = 0, first = null, last = null;
    for (const x of tr.list) {
      const k = x.counterparty; if (!k || k === addr) continue;
      const c = cp.get(k) || { addr: k, nIn: 0, nOut: 0, solIn: 0, solOut: 0, last: 0, first: 9e15 }; cp.set(k, c);
      const sol = x.mint === SOL || /^SOL$/i.test(x.symbol || ''), a = +x.amount || 0;
      if (x.direction === 'in') { c.nIn++; if (sol) { c.solIn += a; solIn += a; } if ((sol && a > 0 && a < .0001) || (!sol && a === 0)) c.dust = (c.dust || 0) + 1; } else { c.nOut++; if (sol) { c.solOut += a; solOut += a; } }
      c.last = Math.max(c.last, x.timestamp || 0); c.first = Math.min(c.first, x.timestamp || 9e15);
      if (x.timestamp) { const d = new Date(x.timestamp * 1000); hours[d.getUTCHours()]++; days[d.getUTCDay()]++; first = Math.min(first || 9e15, x.timestamp); last = Math.max(last || 0, x.timestamp); }
      if (!sol && x.mint) mints.add(x.mint);
    }
    const top = [...cp.values()].sort((a, b) => (b.nIn + b.nOut) - (a.nIn + a.nOut) || (b.solIn + b.solOut) - (a.solIn + a.solOut)).slice(0, 40);
    const ids = await identities(top.map(c => c.addr));
    for (const c of top) { c.label = ids[c.addr] || null; c.kind = kind(c.label); c.both = c.nIn > 0 && c.nOut > 0; }
    const out = { addr, self, chain, counterparties: top, more: tr.more, threats: threatsOf([...cp.values()]),
      stats: { transfers: tr.list.length, first, last, hours, days, tokens: mints.size, solIn, solOut, counterparties: cp.size },
      plan: PLAN.wallet === false ? 'basic' : 'full' };
    Object.assign(out, score(out));
    return out;
  });
}
// approvals: token accounts that let someone else move your tokens (an spl "delegate"). Drainers ask for one and wait.
// one signature revokes them all: plain spl Revoke instructions, built unsigned here, signed in the browser.
const TOKEN_PROGS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
async function approvals(owner) {
  const res = await Promise.all(TOKEN_PROGS.map(p => C.rawRpc('getTokenAccountsByOwner', [owner, { programId: p }, { encoding: 'jsonParsed', commitment: 'confirmed' }], 9000).catch(() => null)));
  if (res.every(r => !r)) throw L.err(502, 'Could not read the token accounts right now. Try again.');
  const list = []; let checked = 0;
  res.forEach((r, i) => { for (const a of (r && r.value) || []) { checked++; const inf = a.account && a.account.data && a.account.data.parsed && a.account.data.parsed.info; if (inf && inf.delegate) list.push({ account: a.pubkey, mint: inf.mint, delegate: inf.delegate, amount: inf.delegatedAmount ? inf.delegatedAmount.uiAmountString : null, balance: inf.tokenAmount ? inf.tokenAmount.uiAmountString : null, program: TOKEN_PROGS[i] }); } });
  const ids = KEY && list.length ? await identities(list.map(x => x.delegate)).catch(() => ({})) : {};
  for (const x of list) x.label = ids[x.delegate] || null;
  return { owner, approvals: list.slice(0, 40), checked };
}
async function revokeBuild(b) {
  const owner = String(b.owner || ''); if (!C.isAddr(owner)) throw L.err(400, 'Connect a wallet first.');
  const want = Array.isArray(b.accounts) ? b.accounts.map(String) : null, ap = await approvals(owner);
  const pick = ap.approvals.filter(x => !want || want.includes(x.account)).slice(0, 16); if (!pick.length) throw L.err(400, 'Nothing to revoke: no approvals on this wallet.');
  const W = C.w3(), T = require('@solana/spl-token'), { PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } = W, me = new PublicKey(owner);
  const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 10000 + pick.length * 5000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })];
  for (const x of pick) ixs.push(T.createRevokeInstruction(new PublicKey(x.account), me, [], new PublicKey(x.program)));
  const { blockhash, lastValidBlockHeight } = await C.rpc(c => c.getLatestBlockhash('confirmed'));
  const msg = new TransactionMessage({ payerKey: me, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  return { tx: Buffer.from(new VersionedTransaction(msg).serialize()).toString('base64'), n: pick.length, lastValidBlockHeight };
}
// threats: wallets working against this one. address poisoning = a look-alike of someone you pay (same first and last
// four characters) sends you something tiny, so its address sits in your history, waiting to be copied by mistake.
function threatsOf(list) {
  const out = [], groups = new Map(), key = a => a.slice(0, 4) + a.slice(-4);
  for (const c of list) { const k = key(c.addr); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const real = g.slice().sort((a, b) => b.nOut - a.nOut || (b.nIn + b.nOut) - (a.nIn + a.nOut))[0];
    if (!real.nOut) continue;
    for (const c of g) if (c !== real && !c.nOut) out.push({ kind: 'poison', real: real.addr, fake: c.addr, n: c.nIn, last: c.last });
  }
  const dust = list.filter(c => c.dust && !c.nOut && !out.some(o => o.fake === c.addr));
  if (dust.length) out.push({ kind: 'dust', n: dust.reduce((a, c) => a + c.dust, 0), from: dust.length, last: Math.max(...dust.map(c => c.last || 0)), addrs: dust.slice(0, 5).map(c => c.addr) });
  return out.slice(0, 8);
}
// the score: how much a stranger can already link to this wallet. every point comes with a reason.
function score(t) {
  const leaks = []; let s = 0;
  const add = (pts, sev, title, detail) => { s += pts; leaks.push({ pts, sev, title, detail }); };
  const cexAt = t.chain.findIndex(c => c.kind === 'cex');
  if (cexAt === 0) add(35, 'hi', `funded straight from ${t.chain[0].label && t.chain[0].label.name || 'an exchange'}`, 'an exchange knows who withdrew this SOL. one subpoena links this wallet to a name.');
  else if (cexAt === 1) add(25, 'hi', `two hops from ${t.chain[1].label && t.chain[1].label.name || 'an exchange'}`, 'the wallet that funded you was itself funded by an exchange. that is one hop of cover, not much.');
  else if (cexAt === 2) add(15, 'mid', `three hops from ${t.chain[2].label && t.chain[2].label.name || 'an exchange'}`, 'the chain back to an exchange is short enough to follow by hand.');
  else if (t.chain.length) add(6, 'lo', 'funding source visible', 'anyone can see which wallet sent the first SOL. no exchange in the first hops.');
  if (t.self && (t.self.domains || []).length) add(20, 'hi', `named: ${t.self.domains.slice(0, 2).join(', ')}`, 'a .sol name points at this wallet. names are public and searchable.');
  else if (t.self && t.self.name) add(18, 'hi', `labelled: ${t.self.name}`, 'this address already carries a public label.');
  const cexOut = t.counterparties.filter(c => c.kind === 'cex' && c.nOut > 0);
  if (cexOut.length) add(15, 'hi', `sent to ${cexOut.length === 1 ? (cexOut[0].label.name || 'an exchange') : cexOut.length + ' exchanges'}`, 'deposits to an exchange tie this wallet to the account that received them.');
  const both = t.counterparties.filter(c => c.both && c.kind !== 'defi' && c.kind !== 'cex');
  if (both.length) add(Math.min(15, both.length * 3), both.length > 2 ? 'mid' : 'lo', `${both.length} two-way link${both.length > 1 ? 's' : ''}`, 'wallets that both send to and receive from you look like your own, or a friend. clustering starts here.');
  const tot = t.stats.hours.reduce((a, b) => a + b, 0);
  if (tot >= 20) {
    let best = 0; for (let i = 0; i < 24; i++) { let w = 0; for (let k = 0; k < 8; k++) w += t.stats.hours[(i + k) % 24]; best = Math.max(best, w); }
    if (best / tot > .8) add(10, 'mid', 'a daily rhythm', `${Math.round(best / tot * 100)}% of activity falls inside the same 8 hours (utc). that hints at a time zone.`);
  }
  if (t.stats.transfers >= 250) add(5, 'lo', 'a long history', 'hundreds of transfers give an analyst a lot to correlate.');
  s = Math.min(100, s);
  const grade = s < 25 ? 'ghost' : s < 50 ? 'low profile' : s < 75 ? 'traceable' : 'exposed';
  if (!leaks.length) leaks.push({ pts: 0, sev: 'lo', title: 'nothing obvious', detail: 'no exchange in the first hops, no name, no two-way links in the transfers we could see.' });
  return { score: s, grade, leaks };
}

// ---------------------------------------------------------------- mock (local dev only): believable, deterministic
function mock(op, q) {
  const crypto = require('crypto'), H = s => crypto.createHash('sha256').update(String(s)).digest();
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', fake = s => { const h = H(s); let o = ''; for (let i = 0; i < 44; i++) o += B58[h[i % 32] % 58 ^ (i % 3)] || 'x'; return o.slice(0, 44); };
  if (op === 'net') return { helius: true, wallet: true, ms: 38, slot: 381204551, fee: 12000 };
  const a = String(q.addr || q.owner || 'self'), h = H(a), now = Math.floor(Date.now() / 1000);
  const cex = { name: 'Binance 1', type: 'exchange', category: 'Centralized Exchange', tags: [], domains: [] };
  const chain = [{ addr: fake(a + 'f0'), name: null, type: null, amount: 2.4, date: new Date((now - 86400 * 41) * 1000).toISOString(), sig: fake('s0'), label: null, kind: null },
    { addr: fake(a + 'f1'), name: 'Binance 1', type: 'exchange', amount: 12.0, date: new Date((now - 86400 * 44) * 1000).toISOString(), sig: fake('s1'), label: cex, kind: 'cex' }];
  if (op === 'funded') return { addr: a, chain };
  if (op === 'moves') { const k = Math.floor(Date.now() / 20000), names = ['Binance 1', null, 'Jupiter Aggregator', null, 'pump.fun', null, null, 'Coinbase 4'];
    return { addr: a, at: Date.now(), moves: Array.from({ length: 25 }, (_, i) => { const g = H(a + (k - i)); return { sig: fake('mv' + a + (k - i)) + fake('mw' + (k - i)).slice(0, 44), t: now - i * 20, dir: g[0] % 2 ? 'in' : 'out', amount: +(g[1] / 30).toFixed(3), sym: g[2] % 3 ? 'SOL' : 'USDC', mint: null, cp: fake('cp' + (g[3] % 9)), label: names[g[3] % names.length] }; }) }; }
  if (op === 'approvals') return { owner: a, checked: 9, approvals: [
    { account: fake(a + 'ta1'), mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', delegate: fake(a + 'drainer'), amount: '18446744073709.551615', balance: '250', program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', label: null },
    { account: fake(a + 'ta2'), mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', delegate: fake(a + 'dca'), amount: '1500000', balance: '4310000', program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', label: { name: 'Jupiter DCA', type: 'protocol', category: 'DeFi', tags: [] } }] };
  if (op === 'ident') return { addr: a, identity: h[0] % 3 === 0 ? cex : null };
  if (op === 'bundle') {   // three planted clusters, one exchange-funded crowd, a pool and some loners
    const m = String(q.mint || 'mint'), t = now, fund = [fake(m + 'F1'), fake(m + 'F2'), fake(m + 'F3')], cexw = fake(m + 'cex');
    const plan = [['pool', 21.4], [0, 6.1], [0, 4.8], [0, 4.4], [0, 3.9], [1, 3.2], [1, 2.9], ['x', 2.6], [2, 2.2], [2, 2.0], ['x', 1.9], ['c', 1.7], ['c', 1.5], ['x', 1.4], ['c', 1.2], ['x', 1.1], [1, 1.0], ['x', .9], ['x', .8], ['c', .7]];
    const holders = plan.map(([k, pct], i) => { const o = fake(m + 'h' + i), g = H(o);
      if (k === 'pool') return { owner: fake(m + 'pool'), pct, pool: true, n: null, more: null, first: null, cluster: -1, fresh: false, funder: null };
      const fu = typeof k === 'number' ? { addr: fund[k], t: t - 3600 * 5 - (k * 600) - i * 7, amount: +(1 + g[0] / 60).toFixed(2), sure: true, busy: false, label: null }
        : k === 'c' ? { addr: cexw, t: t - 86400 * (2 + g[1] % 40), amount: +(g[2] / 20).toFixed(2), sure: true, busy: true, label: null }
        : g[3] % 3 ? { addr: fake(o + 'f'), t: t - 86400 * (5 + g[4] % 200), amount: +(g[5] / 30).toFixed(2), sure: g[6] % 2 === 0, busy: false, label: null } : null;
      return { owner: o, pct, pool: false, n: typeof k === 'number' ? 3 + g[7] % 4 : 20 + g[8] % 80, more: typeof k === 'number' ? false : g[9] % 2 === 0, first: typeof k === 'number' ? t - 3600 * 5 : t - 86400 * (9 + g[10] % 300), cluster: -1, fresh: typeof k === 'number', funder: fu };
    });
    const clusters = [0, 1, 2].map(k => { const mem = holders.filter((h, i) => plan[i][0] === k); return { members: mem.map(h => h.owner), pct: mem.reduce((a, h) => a + h.pct, 0), funders: [fund[k]], spread: 60 * (2 + k * 3), direct: k === 1 }; });
    clusters.forEach((c, i) => c.members.forEach(o => { holders.find(h => h.owner === o).cluster = i; }));
    const links = [[clusters[1].members[0], clusters[1].members[1]]], sum = l => l.reduce((a, h) => a + h.pct, 0), clustered = clusters.reduce((a, c) => a + c.pct, 0);
    const devA = fund[0]; clusters[0].dev = true; clusters[1].dev = false; clusters[2].dev = false;
    const dev = { addr: devA, holder: false, pct: 0, funded: clusters[0].members, siblings: [], funder: fake(m + 'devf'), funderBusy: false };
    return { mint: m, supply: 1e9, at: Date.now(), plan: 'basic', holders, links, clusters, dev,
      stats: { dev: clusters[0].pct, holders: holders.length, people: holders.length - 1, pools: 21.4, top10: sum(holders.slice(0, 10).filter(h => !h.pool)), clustered, fresh: sum(holders.filter(h => h.fresh)), unknown: holders.filter(h => !h.pool && !h.funder).length },
      grade: clustered >= 35 ? 'heavily bundled' : clustered >= 15 ? 'bundled' : clustered >= 5 ? 'some links' : 'clean' };
  }
  const names = [['Jupiter Aggregator', 'defi'], ['pump.fun', 'defi'], ['Coinbase 4', 'cex'], ['Raydium', 'defi'], null, null, null, null, null, null];
  const counterparties = Array.from({ length: 26 }, (_, i) => { const g = H(a + i), nm = names[g[0] % names.length], nIn = g[1] % 7, nOut = g[2] % 9 + (i < 4 ? 3 : 0);
    const pool = i === 4 || i === 6, L = pool ? null : nm;   // two private wallets every mock trace shares, so link has something to find locally
    return { addr: pool ? fake('shared-pool' + i) : fake(a + 'c' + i), nIn, nOut, solIn: +(g[3] / 40).toFixed(2), solOut: +(g[4] / 30).toFixed(2), first: now - g[5] * 9000, last: now - g[6] * 3000,
      label: L ? { name: L[0], type: L[1] === 'cex' ? 'exchange' : 'protocol', category: L[1] === 'cex' ? 'Centralized Exchange' : 'DeFi', tags: [] } : null, kind: L ? L[1] : null, both: nIn > 0 && nOut > 0 }; })
    .sort((x, y) => (y.nIn + y.nOut) - (x.nIn + x.nOut));
  const hours = Array.from({ length: 24 }, (_, i) => Math.max(0, Math.round(14 * Math.exp(-Math.pow((i - 19) / 3.2, 2)) + (h[i % 32] % 3))));
  const paid = counterparties.find(c => c.nOut > 0 && !c.label) || counterparties[0], all = counterparties.concat([
    { addr: paid.addr.slice(0, 4) + fake(a + 'poison').slice(4, 40) + paid.addr.slice(-4), nIn: 3, nOut: 0, solIn: .000003, solOut: 0, first: now - 86400 * 2, last: now - 3600 * 5, label: null, kind: null, both: false, dust: 3 },
    { addr: fake(a + 'dust1'), nIn: 2, nOut: 0, solIn: .000002, solOut: 0, first: now - 86400 * 6, last: now - 86400, label: null, kind: null, both: false, dust: 2 }]);
  const t = { addr: a, self: h[1] % 4 === 0 ? { name: null, type: null, category: null, tags: [], domains: ['quiet.sol'] } : null, chain, counterparties, more: true, threats: threatsOf(all),
    stats: { transfers: 300, first: now - 86400 * 40, last: now - 3600, hours, days: [12, 40, 44, 51, 47, 60, 46], tokens: 37, solIn: 31.2, solOut: 29.8, counterparties: 112 }, plan: 'full' };
  return Object.assign(t, score(t));
}

module.exports = async (req, res) => {
  const qs = L.query(req), op = String(qs.op || '');
  try {
    if (L.limited('s:' + L.ip(req), 60, 60000)) throw L.err(429, 'Slow down a little.');
    if (C.MOCK && ['net', 'trace', 'funded', 'ident', 'approvals', 'moves', 'bundle'].includes(op)) { await new Promise(r => setTimeout(r, op === 'trace' ? 700 : 120)); return L.send(res, 200, { ok: true, ...mock(op, qs) }); }
    if (op === 'net') {
      return L.send(res, 200, { ok: true, ...(await L.cached('net', 8000, async () => {
        const t0 = Date.now(); let slot = null, ms = null, fee = null;
        try { slot = await C.rawRpc('getSlot', [{ commitment: 'confirmed' }], 5000); ms = Date.now() - t0; } catch {}
        if (C.HKEY) { try { const f = await C.rawRpc('getPriorityFeeEstimate', [{ accountKeys: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'], options: { includeAllPriorityFeeLevels: true } }], 5000); fee = f && f.priorityFeeLevels ? f.priorityFeeLevels.high : null; } catch {} }
        return { helius: !!C.HKEY, wallet: !!KEY && PLAN.wallet !== false, ms, slot, fee };
      })) }, L.CACHE(8));
    }
    if (op === 'bundle') {
      const m = String(qs.mint || '').trim(); if (!C.isAddr(m)) throw L.err(400, 'That is not a token mint.');
      if (!KEY) throw L.err(503, 'Helius is not set up on this server yet, so bundle checks are off. Add HELIUS_API_KEY in Vercel.');
      if (L.limited('b:' + L.ip(req), 6, 60000)) throw L.err(429, 'A bundle check reads twenty wallets. Give it a minute.');
      return L.send(res, 200, { ok: true, ...(await bundle(m)) }, L.CACHE(60));
    }
    if (op === 'approvals') { const o = String(qs.owner || qs.addr || '').trim(); if (!C.isAddr(o)) throw L.err(400, 'That is not a Solana address.'); return L.send(res, 200, { ok: true, ...(await approvals(o)) }, L.CACHE(5)); }
    if (op === 'revoke') { if (req.method !== 'POST') throw L.err(405, 'POST only.'); if (C.MOCK) throw L.err(501, 'mock: revoke is built against mainnet only.'); return L.send(res, 200, { ok: true, ...(await revokeBuild(await L.body(req, 16 * 1024))) }); }
    const addr = String(qs.addr || '').trim();
    if (['trace', 'funded', 'ident', 'moves'].includes(op)) {
      if (!C.isAddr(addr) && !/^[a-z0-9-]{1,63}\.(sol|bonk|abc|poor|backpack)$/i.test(addr)) throw L.err(400, 'That is not a Solana address or a .sol name.');
      if (!KEY) throw L.err(503, `Helius is not set up on this server yet, so ${op === 'ident' ? 'labels are' : op === 'funded' ? 'funding lookups are' : op === 'moves' ? 'follow is' : 'trace is'} off. Add HELIUS_API_KEY in Vercel.`);
    }
    if (op === 'moves') { if (L.limited('mv:' + L.ip(req), 40, 60000)) throw L.err(429, 'Following too fast. Give it a minute.'); return L.send(res, 200, { ok: true, ...(await moves(addr)) }, L.CACHE(5)); }
    if (op === 'trace') {
      let a = addr;
      if (!C.isAddr(a)) { const id = await hel(`/v1/wallet/${encodeURIComponent(a)}/identity`).catch(() => null); a = id && id.address || (/\.sol$/i.test(a) ? await resolveSol(a).catch(() => null) : null); if (!a) throw L.err(404, `No wallet found for ${addr}.`); }
      if (L.limited('t:' + L.ip(req), 8, 60000)) throw L.err(429, 'A trace reads a lot of history. Give it a minute.');
      return L.send(res, 200, { ok: true, ...(await trace(a)) }, L.CACHE(120));
    }
    if (op === 'funded') {
      const chain = []; let cur = addr;
      for (let i = 0; i < 4; i++) { const f = await fundedBy(cur); if (!f) break; const id = f.name ? { name: f.name, type: f.type } : await identity(f.addr); chain.push({ ...f, label: id, kind: kind(id) }); if (kind(id) === 'cex') break; cur = f.addr; }
      return L.send(res, 200, { ok: true, addr, chain, plan: PLAN.wallet === false ? 'basic' : 'full' }, L.CACHE(300));
    }
    if (op === 'ident') return L.send(res, 200, { ok: true, addr, identity: await identity(addr), plan: PLAN.wallet === false ? 'basic' : 'full' }, L.CACHE(300));
    throw L.err(404, 'Unknown operation.');
  } catch (e) {
    return L.send(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { ok: false, error: e.code ? e.message : 'Something went wrong. Try again.', detail: e.extra && e.extra.detail });
  }
};
