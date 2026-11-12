// st3alth market API: quotes and unsigned swaps from Jupiter (every Solana DEX), token lookups, prices, trending,
// tokenized stocks, wallet holdings, and a relay for signed transactions. It never holds keys or funds:
// the visitor's wallet signs everything in the browser.
const L = require('./_lib');
const C = require('./_chain');

const SOL = 'So11111111111111111111111111111111111111112', USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', USDT = 'Es9vMFrzaCERmJfrF4H2FYD2WiKqCfsV3N7MdL1XXXcp';
const KNOWN = { sol: SOL, wsol: SOL, usdc: USDC, usdt: USDT };
const KEY = process.env.JUP_API_KEY || '';
const HOSTS = KEY ? ['https://api.jup.ag', 'https://lite-api.jup.ag'] : ['https://lite-api.jup.ag', 'https://api.jup.ag'];
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clean = (s, n = 60) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').slice(0, n);

// Jupiter's keyless gateway is rate limited and Vercel IPs are shared: rotate gateways and back off on 429s
async function jup(path, opt = {}, budget = 20000) {
  const until = Date.now() + budget; let last = null;
  for (let i = 0; ; i++) {
    const host = HOSTS[i % HOSTS.length], left = until - Date.now();
    if (left < 1200) break;
    try {
      const r = await fetch(host + path, { ...opt, signal: AbortSignal.timeout(Math.min(12000, left)), headers: { accept: 'application/json', 'content-type': 'application/json', ...(KEY && host === 'https://api.jup.ag' ? { 'x-api-key': KEY } : {}), ...(opt.headers || {}) } });
      const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
      if (r.ok && j !== null) return j;
      const e = L.err(r.status === 429 ? 429 : r.status >= 500 ? 502 : r.status === 401 || r.status === 403 ? 503 : 400, clean((j && (j.error || j.message || j.errorMessage)) || 'upstream ' + r.status, 180));
      if (e.code === 400) throw e;
      last = e;
    } catch (e) { if (e.code === 400) throw e; last = last || e; }
    if (i % HOSTS.length === HOSTS.length - 1) await new Promise(r => setTimeout(r, Math.min(3000, 600 * (i + 1)) + Math.random() * 400));
  }
  throw last && last.code ? last : L.err(429, 'The router is busy right now. Try again in a moment.');
}

const shape = x => ({
  mint: x.id, name: clean(x.name, 48), sym: clean(x.symbol, 16), icon: /^https:\/\//.test(x.icon || '') ? x.icon : '', dec: num(x.decimals, 0),
  price: num(x.usdPrice, null), mcap: num(x.mcap, null), fdv: num(x.fdv, null), liq: num(x.liquidity, null), holders: num(x.holderCount, null),
  c1h: num(x.stats1h && x.stats1h.priceChange, null), c24h: num(x.stats24h && x.stats24h.priceChange, null),
  v24h: num(x.stats24h && x.stats24h.buyVolume, 0) + num(x.stats24h && x.stats24h.sellVolume, 0),
  verified: !!x.isVerified, organic: num(x.organicScore, null), launchpad: clean(x.launchpad || '', 24), grad: !!x.graduatedPool,
  mintOff: x.audit ? !!x.audit.mintAuthorityDisabled : null, freezeOff: x.audit ? !!x.audit.freezeAuthorityDisabled : null, top10: x.audit ? num(x.audit.topHoldersPercentage, null) : null,
  created: x.createdAt || (x.firstPool && x.firstPool.createdAt) || null, tags: Array.isArray(x.tags) ? x.tags.slice(0, 6) : [],
  c5m: num(x.stats5m && x.stats5m.priceChange, null), v1h: num(x.stats1h && x.stats1h.buyVolume, 0) + num(x.stats1h && x.stats1h.sellVolume, 0), b1h: num(x.stats1h && x.stats1h.numBuys, 0), s1h: num(x.stats1h && x.stats1h.numSells, 0),
  gradAt: x.graduatedAt || null, twitter: /^https:\/\//.test(x.twitter || '') ? x.twitter : '', website: /^https:\/\//.test(x.website || '') ? x.website : '',
  devMints: x.audit ? num(x.audit.devMints, null) : null, bots: x.audit ? num(x.audit.botHoldersPercentage, null) : null,
  bundles: x.audit && x.audit.bundlerStats ? num(x.audit.bundlerStats.totalBundles, null) : null, fees: num(x.fees, null),
  traders: num(x.stats1h && x.stats1h.numTraders, null), netBuyers: num(x.stats1h && x.stats1h.numNetBuyers, null),
});
async function search(q) {
  q = clean(q, 64).trim(); if (!q) throw L.err(400, 'Search for a ticker, a name or a mint.');
  return L.cached('s:' + q.toLowerCase(), 20000, async () => (await jup(`/tokens/v2/search?query=${encodeURIComponent(q)}`) || []).map(shape));
}
// "sol", "$bonk", a mint: the best match, preferring exact tickers, verified tokens and deep liquidity
async function resolve(s) {
  s = String(s || '').trim().replace(/^\$/, ''); if (!s) throw L.err(400, 'Name a token.');
  const k = KNOWN[s.toLowerCase()];
  if (C.isAddr(s) || k) { const mint = k || s; const l = await search(mint); return l.find(t => t.mint === mint) || { mint, name: '', sym: s.slice(0, 6), dec: mint === SOL ? 9 : null }; }
  const l = await search(s); if (!l.length) throw L.err(404, `No token found for "${clean(s, 24)}".`);
  const exact = l.filter(t => t.sym.toLowerCase() === s.toLowerCase());
  const pool = exact.length ? exact : l;
  return pool.slice().sort((a, b) => (b.verified - a.verified) || (num(b.liq) - num(a.liq)))[0];
}
const toRaw = (ui, dec) => { const [i, f = ''] = String(ui).split('.'); const s = (i.replace(/\D/g, '') || '0') + (f.replace(/\D/g, '') + '0'.repeat(dec)).slice(0, dec); return BigInt(s).toString(); };
const toUi = (raw, dec) => Number(BigInt(raw)) / 10 ** dec;

async function quote(qs) {
  const a = await resolve(qs.in), b = await resolve(qs.out);
  if (a.mint === b.mint) throw L.err(400, 'Pick two different tokens.');
  if (a.dec == null || b.dec == null) throw L.err(400, 'That token has no market yet.');
  const amt = String(qs.amount || '').trim(); if (!/^\d*\.?\d+$/.test(amt) || Number(amt) <= 0) throw L.err(400, 'Give an amount, like 0.5.');
  const raw = toRaw(amt, a.dec); if (raw === '0') throw L.err(400, 'That amount is too small.');
  const slip = Math.max(10, Math.min(3000, Math.round(num(qs.slip, 100))));
  const q = await jup(`/swap/v1/quote?inputMint=${a.mint}&outputMint=${b.mint}&amount=${raw}&slippageBps=${slip}&maxAccounts=48`);
  if (!q || !q.outAmount) throw L.err(404, 'No route between those two right now.');
  const route = (q.routePlan || []).map(r => clean(r.swapInfo && r.swapInfo.label, 24)).filter(Boolean);
  return { in: a, out: b, inUi: Number(amt), outUi: toUi(q.outAmount, b.dec), minUi: toUi(q.otherAmountThreshold || q.outAmount, b.dec), impact: num(q.priceImpactPct, 0) * 100, slip, route: [...new Set(route)], quote: q };
}
async function swapTx(b) {
  const owner = String(b.owner || ''); if (!C.isAddr(owner)) throw L.err(400, 'Connect a wallet first.');
  const q = b.quote; if (!q || !q.inputMint || !q.outputMint || !q.outAmount) throw L.err(400, 'Get a fresh quote first.');
  const s = await jup('/swap/v1/swap', { method: 'POST', body: JSON.stringify({ quoteResponse: q, userPublicKey: owner, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, dynamicSlippage: false, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 800000, priorityLevel: 'high' } } }) });
  if (!s || !s.swapTransaction) throw L.err(502, 'The router did not build the swap. Try again.');
  return { tx: s.swapTransaction, lastValid: s.lastValidBlockHeight || null };
}

async function trending(w) {
  w = ['5m', '1h', '6h', '24h'].includes(w) ? w : '1h';
  return L.cached('tr:' + w, 30000, async () => (await jup(`/tokens/v2/toptrending/${w}?limit=30`) || []).map(shape));
}
async function recentPump() {
  return L.cached('recent', 4000, async () => (await jup('/tokens/v2/recent') || []).filter(x => x.launchpad === 'pump.fun').map(shape).slice(0, 30));
}
async function stocks() {
  return L.cached('stocks', 60000, async () => {
    const [a, b] = await Promise.allSettled([jup('/tokens/v2/search?query=xstock'), jup('/tokens/v2/search?query=xStocks')]);
    const seen = new Map();
    for (const r of [a, b]) if (r.status === 'fulfilled') for (const x of r.value || []) if (/xstock/i.test(x.name || '') && !seen.has(x.id)) seen.set(x.id, shape(x));
    return [...seen.values()].sort((x, y) => num(y.mcap) - num(x.mcap)).slice(0, 40);
  });
}
async function prices(ids) {
  ids = String(ids || '').split(',').map(s => s.trim()).filter(C.isAddr).slice(0, 40); if (!ids.length) ids = [SOL];
  return L.cached('p:' + ids.join(','), 15000, async () => { const r = await jup(`/price/v3?ids=${ids.join(',')}`); const o = {}; for (const k of ids) if (r && r[k]) o[k] = { usd: num(r[k].usdPrice, null), c24h: num(r[k].priceChange24h, null) }; return o; });
}
async function holdings(owner) {
  if (!C.isAddr(owner)) throw L.err(400, 'That is not a Solana address.');
  return L.cached('h:' + owner, 60000, async () => {
    const j = await jup(`/ultra/v1/holdings/${owner}`, {}, 9000);
    const toks = [];
    for (const [mint, accts] of Object.entries(j.tokens || {})) { let ui = 0, raw = 0n, dec = 0; for (const x of accts || []) { ui += num(x.uiAmount); raw += BigInt(x.amount || '0'); dec = num(x.decimals); } if (raw > 0n) toks.push({ mint, ui, raw: raw.toString(), dec }); }
    // names and prices for what they hold (top 25 by count of tokens is enough for a terminal)
    const top = toks.slice(0, 25); let px = {};
    try { px = await prices(top.map(t => t.mint).concat(SOL).join(',')); } catch {}
    const info = {}; await Promise.race([Promise.all(top.slice(0, 12).map(async t => { try { const l = await search(t.mint); const x = l.find(y => y.mint === t.mint); if (x) info[t.mint] = x; } catch {} })), new Promise(z => setTimeout(z, 2500))]);
    const sol = num(j.uiAmount, num(j.amount) / 1e9);
    return { sol, solUsd: px[SOL] ? px[SOL].usd : null, tokens: top.map(t => ({ ...t, sym: info[t.mint] ? info[t.mint].sym : '', name: info[t.mint] ? info[t.mint].name : '', usd: px[t.mint] && px[t.mint].usd != null ? px[t.mint].usd * t.ui : null })).sort((a, b) => num(b.usd) - num(a.usd)) };
  });
}

// ---------------------------------------------------------------- charts: candles from GeckoTerminal (the coin's deepest pool)
const GT = 'https://api.geckoterminal.com/api/v2/networks/solana';
const TF = { '1m': ['minute', 1], '5m': ['minute', 5], '15m': ['minute', 15], '1h': ['hour', 1], '4h': ['hour', 4], '1d': ['day', 1] };
async function gt(path) {
  const r = await fetch(GT + path, { headers: { accept: 'application/json;version=20230302', 'user-agent': 'st3alth/1.0' }, signal: AbortSignal.timeout(9000) });
  if (r.status === 429) throw L.err(429, 'The chart source is busy. Try again in a few seconds.');
  if (!r.ok) throw L.err(r.status === 404 ? 404 : 502, r.status === 404 ? 'No pool for that token yet.' : 'The chart source did not answer.');
  return r.json();
}
async function ohlcv(mint, tf) {
  if (!C.isAddr(mint)) throw L.err(400, 'bad mint');
  const [unit, agg] = TF[tf] || TF['15m'];
  const pool = await L.cached('pool:' + mint, 300000, async () => { const j = await gt(`/tokens/${mint}/pools?page=1`); const p = (j.data || [])[0]; if (!p) throw L.err(404, 'No pool for that token yet.'); return { addr: p.attributes.address, name: clean(p.attributes.name, 40), dex: clean(p.relationships && p.relationships.dex && p.relationships.dex.data && p.relationships.dex.data.id, 24) }; });
  return L.cached(`ohlcv:${mint}:${tf}`, 30000, async () => {
    const j = await gt(`/pools/${pool.addr}/ohlcv/${unit}?aggregate=${agg}&limit=220&currency=usd&token=${mint}`);
    const list = ((j.data && j.data.attributes && j.data.attributes.ohlcv_list) || []).map(r => r.map(Number)).sort((a, b) => a[0] - b[0]);
    return { pool, tf: TF[tf] ? tf : '15m', candles: list };
  });
}

// ---------------------------------------------------------------- limit orders (Jupiter Trigger) and DCA (Jupiter Recurring): the wallet signs
async function trigger(op, b) {
  if (op === 'create') {
    const a = await resolve(b.in), o = await resolve(b.out), maker = String(b.owner || '');
    if (!C.isAddr(maker)) throw L.err(400, 'Connect a wallet first.');
    const making = toRaw(String(b.amount), a.dec), price = num(b.price); if (!(price > 0)) throw L.err(400, 'Give a price, like @ 0.002.');
    // price is "how many output tokens one input token is worth" when buying with SOL: the API wants the amount we take
    const takingUi = b.side === 'buy' ? num(b.amount) / price : num(b.amount) * price;
    const taking = toRaw(takingUi.toFixed(Math.min(o.dec, 9)), o.dec);
    const j = await jup('/trigger/v1/createOrder', { method: 'POST', body: JSON.stringify({ inputMint: a.mint, outputMint: o.mint, maker, payer: maker, params: { makingAmount: making, takingAmount: taking }, computeUnitPrice: 'auto', wrapAndUnwrapSol: true }) });
    if (!j || !j.transaction) throw L.err(502, clean((j && (j.error || j.cause)) || 'The order was not built.', 160));
    return { tx: j.transaction, requestId: j.requestId, order: j.order, in: a, out: o, takingUi };
  }
  if (op === 'execute') { const j = await jup('/trigger/v1/execute', { method: 'POST', body: JSON.stringify({ signedTransaction: String(b.tx || ''), requestId: String(b.requestId || '') }) }); return { sig: j.signature || null, status: j.status || null, error: j.error || null }; }
  if (op === 'list') { const u = String(b.owner || ''); if (!C.isAddr(u)) throw L.err(400, 'Connect a wallet first.'); const j = await jup(`/trigger/v1/getTriggerOrders?user=${u}&orderStatus=active`); return { orders: (j.orders || []).slice(0, 30).map(x => ({ id: x.orderKey, in: x.inputMint, out: x.outputMint, making: x.makingAmount, taking: x.takingAmount, remaining: x.remainingMakingAmount, at: x.createdAt })) }; }
  if (op === 'cancel') { const u = String(b.owner || ''), id = String(b.order || ''); if (!C.isAddr(u) || !C.isAddr(id)) throw L.err(400, 'Give the order id from orders.'); const j = await jup('/trigger/v1/cancelOrder', { method: 'POST', body: JSON.stringify({ maker: u, order: id, computeUnitPrice: 'auto' }) }); if (!j.transaction) throw L.err(502, 'The cancel was not built.'); return { tx: j.transaction, requestId: j.requestId }; }
  throw L.err(400, 'unknown order op');
}
async function recurring(op, b) {
  if (op === 'create') {
    const a = await resolve(b.in), o = await resolve(b.out), user = String(b.owner || '');
    if (!C.isAddr(user)) throw L.err(400, 'Connect a wallet first.');
    const n = Math.max(2, Math.min(100, Math.round(num(b.count, 4)))), every = Math.max(60, Math.min(30 * 86400, Math.round(num(b.every, 3600))));
    const j = await jup('/recurring/v1/createOrder', { method: 'POST', body: JSON.stringify({ user, inputMint: a.mint, outputMint: o.mint, params: { time: { inAmount: Number(toRaw(String(b.amount), a.dec)), numberOfOrders: n, interval: every, minPrice: null, maxPrice: null, startAt: null } } }) });
    if (!j || !j.transaction) throw L.err(502, clean((j && (j.error || j.cause)) || 'The plan was not built.', 160));
    return { tx: j.transaction, requestId: j.requestId, in: a, out: o, count: n, every };
  }
  if (op === 'execute') { const j = await jup('/recurring/v1/execute', { method: 'POST', body: JSON.stringify({ signedTransaction: String(b.tx || ''), requestId: String(b.requestId || '') }) }); return { sig: j.signature || null, status: j.status || null, error: j.error || null, order: j.order || null }; }
  if (op === 'list') { const u = String(b.owner || ''); if (!C.isAddr(u)) throw L.err(400, 'Connect a wallet first.'); const j = await jup(`/recurring/v1/getRecurringOrders?user=${u}&orderStatus=active&recurringType=time&includeFailedTx=false`); const l = (j.time || j.all || j.orders || []); return { plans: l.slice(0, 20).map(x => ({ id: x.orderKey, in: x.inputMint, out: x.outputMint, each: x.inAmountPerCycle, left: x.inDeposited != null && x.inUsed != null ? Number(x.inDeposited) - Number(x.inUsed) : null, every: x.cycleFrequency, at: x.createdAt })) }; }
  if (op === 'cancel') { const u = String(b.owner || ''), id = String(b.order || ''); if (!C.isAddr(u) || !C.isAddr(id)) throw L.err(400, 'Give the plan id from dca list.'); const j = await jup('/recurring/v1/cancelOrder', { method: 'POST', body: JSON.stringify({ order: id, user: u, recurringType: 'time' }) }); if (!j.transaction) throw L.err(502, 'The cancel was not built.'); return { tx: j.transaction, requestId: j.requestId }; }
  throw L.err(400, 'unknown dca op');
}

// ---------------------------------------------------------------- send SOL or any token: an unsigned transfer the wallet signs
async function sendBuild(b) {
  const from = String(b.from || ''), to = String(b.to || ''); if (!C.isAddr(from)) throw L.err(400, 'Connect a wallet first.'); if (!C.isAddr(to)) throw L.err(400, 'That is not a Solana address.'); if (from === to) throw L.err(400, 'Send it somewhere else.');
  const t = await resolve(b.token || 'sol'), W = C.w3(), { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } = W;
  const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 60000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })];
  const fromPk = new PublicKey(from), toPk = new PublicKey(to); let human;
  if (t.mint === SOL) {
    const lamports = BigInt(toRaw(String(b.amount), 9)); if (lamports <= 0n) throw L.err(400, 'Give an amount.');
    ixs.push(SystemProgram.transfer({ fromPubkey: fromPk, toPubkey: toPk, lamports })); human = `${b.amount} SOL`;
  } else {
    const T = require('@solana/spl-token'); const mint = new PublicKey(t.mint);
    const info = await C.rpc(c => c.getAccountInfo(mint)); if (!info) throw L.err(404, 'That token does not exist.');
    const prog = info.owner; const dec = info.data[44];
    const src = T.getAssociatedTokenAddressSync(mint, fromPk, true, prog), dst = T.getAssociatedTokenAddressSync(mint, toPk, true, prog);
    ixs.push(T.createAssociatedTokenAccountIdempotentInstruction(fromPk, dst, toPk, mint, prog));
    ixs.push(T.createTransferCheckedInstruction(src, mint, dst, fromPk, BigInt(toRaw(String(b.amount), dec)), dec, [], prog)); human = `${b.amount} ${t.sym || 'tokens'}`;
  }
  const { blockhash, lastValidBlockHeight } = await C.rpc(c => c.getLatestBlockhash('confirmed'));
  const msg = new TransactionMessage({ payerKey: fromPk, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  return { tx: Buffer.from(new VersionedTransaction(msg).serialize()).toString('base64'), human, token: t, lastValidBlockHeight };
}

// ---------------------------------------------------------------- holders, and a heartbeat for the status line
async function holders(q) {
  const t = await resolve(q), W = C.w3(), mint = new W.PublicKey(t.mint);
  return L.cached('holders:' + t.mint, 60000, async () => {
    const [big, sup] = await Promise.all([C.rpc(c => c.getTokenLargestAccounts(mint, 'confirmed')), C.rpc(c => c.getTokenSupply(mint, 'confirmed'))]);
    const accts = (big.value || []).slice(0, 20), total = Number(sup.value.uiAmount) || 0;
    const infos = await C.rpc(c => c.getMultipleParsedAccounts(accts.map(a => a.address)));
    return { token: t, supply: total, holders: accts.map((a, i) => { const p = infos.value[i] && infos.value[i].data && infos.value[i].data.parsed; return { account: a.address.toBase58(), owner: p ? p.info.owner : null, ui: Number(a.uiAmount) || 0, pct: total ? (Number(a.uiAmount) / total) * 100 : null }; }) };
  });
}
async function ping() {
  return L.cached('ping', 4000, async () => {
    const t0 = Date.now(); let slot = null, rpcMs = null, jupOk = null;
    try { slot = await C.rpc(c => c.getSlot('confirmed')); rpcMs = Date.now() - t0; } catch {}
    const tps = await L.cached('tps', 20000, async () => { const r = await C.rpc(c => c.getRecentPerformanceSamples(3)); const ok = (r || []).filter(x => x.samplePeriodSecs > 0); if (!ok.length) return null; const nv = ok.every(x => x.numNonVoteTransactions != null); return Math.round(ok.reduce((a, x) => a + (nv ? x.numNonVoteTransactions : x.numTransactions) / x.samplePeriodSecs, 0) / ok.length); }).catch(() => null);
    const epoch = await L.cached('epoch', 30000, async () => { const e = await C.rpc(c => c.getEpochInfo('confirmed')); return { n: e.epoch, i: e.slotIndex, len: e.slotsInEpoch }; }).catch(() => null);
    try { const t1 = Date.now(); const p = await prices(SOL); jupOk = Date.now() - t1; return { slot, rpcMs, jupMs: jupOk, tps, epoch, sol: p[SOL] ? p[SOL].usd : null, solC24: p[SOL] ? p[SOL].c24h : null }; } catch { return { slot, rpcMs, jupMs: null, tps, epoch, sol: null }; }
  });
}

// ---------------------------------------------------------------- inspect: a transaction, an account, the fee market
const PROGRAMS = {
  '11111111111111111111111111111111': 'system', 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'token', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': 'token-2022',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'associated token', 'ComputeBudget111111111111111111111111111111': 'compute budget', 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': 'memo',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'jupiter', '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'pump.fun', 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA': 'pumpswap',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'raydium amm', 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'raydium clmm', 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'raydium cpmm',
  'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj': 'raydium launchlab', 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'orca', 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'meteora dlmm',
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': 'meteora pools', 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG': 'meteora damm v2', 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ': 'pump fees',
  'j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X': 'jupiter limit', 'DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M': 'jupiter dca',
};
async function inspectTx(sig) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) throw L.err(400, 'That is not a transaction signature.');
  return L.cached('tx:' + sig, 60000, async () => {
    const t = await C.rpc(c => c.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }));
    if (!t) throw L.err(404, 'Not found yet. It may still be confirming, or it never landed.');
    const keys = t.transaction.message.accountKeys.map(k => ({ key: k.pubkey.toBase58(), signer: k.signer, writable: k.writable }));
    const progs = [...new Set(t.transaction.message.instructions.map(i => i.programId.toBase58()))].map(p => ({ id: p, name: PROGRAMS[p] || null }));
    const sol = keys.map((k, i) => ({ key: k.key, d: (t.meta.postBalances[i] - t.meta.preBalances[i]) / 1e9 })).filter(x => Math.abs(x.d) > 1e-9).slice(0, 12);
    const tk = {}; for (const b of t.meta.preTokenBalances || []) tk[b.accountIndex] = { mint: b.mint, owner: b.owner, pre: Number(b.uiTokenAmount.uiAmount) || 0, post: 0 };
    for (const b of t.meta.postTokenBalances || []) { const r = tk[b.accountIndex] || { mint: b.mint, owner: b.owner, pre: 0 }; r.post = Number(b.uiTokenAmount.uiAmount) || 0; tk[b.accountIndex] = r; }
    const tokens = Object.values(tk).map(x => ({ ...x, d: x.post - x.pre })).filter(x => Math.abs(x.d) > 0).slice(0, 12);
    const logs = (t.meta.logMessages || []).filter(l => /Program log: Instruction:|failed|error/i.test(l)).slice(0, 12).map(l => clean(l, 140));
    return { sig, slot: t.slot, time: t.blockTime, fee: t.meta.fee / 1e9, err: t.meta.err ? JSON.stringify(t.meta.err).slice(0, 160) : null, cu: t.meta.computeUnitsConsumed || null, signers: keys.filter(k => k.signer).map(k => k.key), programs: progs, sol, tokens, logs, version: t.version };
  });
}
async function account(addr) {
  if (!C.isAddr(addr)) throw L.err(400, 'That is not a Solana address.');
  return L.cached('acct:' + addr, 15000, async () => {
    const W = C.w3(), pk = new W.PublicKey(addr);
    const [info, sigs] = await Promise.all([C.rpc(c => c.getParsedAccountInfo(pk, 'confirmed')), C.rpc(c => c.getSignaturesForAddress(pk, { limit: 20 }, 'confirmed')).catch(() => [])]);
    const v = info.value; let kind = 'empty', detail = {};
    if (v) {
      const owner = v.owner.toBase58(), p = v.data && v.data.parsed;
      if (v.executable) kind = 'program';
      else if (p && p.type === 'mint') { kind = 'token mint'; detail = { decimals: p.info.decimals, supply: p.info.supply, mintAuthority: p.info.mintAuthority || null, freezeAuthority: p.info.freezeAuthority || null }; }
      else if (p && p.type === 'account') { kind = 'token account'; detail = { mint: p.info.mint, owner: p.info.owner, amount: p.info.tokenAmount.uiAmountString }; }
      else if (owner === '11111111111111111111111111111111') kind = 'wallet';
      else kind = 'data account';
      detail.owner = detail.owner || owner; detail.ownerName = PROGRAMS[owner] || null;
    }
    return { addr, kind, sol: v ? v.lamports / 1e9 : 0, detail, recent: sigs.map(s => ({ sig: s.signature, time: s.blockTime, err: !!s.err })), first: sigs.length ? sigs[sigs.length - 1].blockTime : null };
  });
}
async function fees() {
  return L.cached('fees', 8000, async () => {
    const W = C.w3(), hot = ['58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2', 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE', 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'].map(a => new W.PublicKey(a));
    const r = await C.rpc(c => c.getRecentPrioritizationFees({ lockedWritableAccounts: hot }));
    const v = r.map(x => x.prioritizationFee).sort((a, b) => a - b), q = k => v.length ? v[Math.min(v.length - 1, Math.floor(k * v.length))] : 0;
    return { slots: v.length, p25: q(.25), p50: q(.5), p75: q(.75), p90: q(.9), max: v.length ? v[v.length - 1] : 0 };
  });
}

// the live tape: the last trades of any coin, newest first (jupiter's trade feed)
async function trades(mint) {
  if (!C.isAddr(mint)) throw L.err(400, 'Name a token by its mint.');
  return L.cached('trades:' + mint, 2500, async () => {
    const r = await fetch('https://datapi.jup.ag/v1/txs/' + mint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw L.err(r.status === 429 ? 429 : 502, 'The trade feed is busy. Trying again shortly.');
    const j = await r.json();
    return ((j && j.txs) || []).slice(0, 40).map(x => ({
      t: Date.parse(x.timestamp) || null, side: x.type === 'sell' ? 'sell' : 'buy', sol: num(x.nativeVolume, null), usd: num(x.usdVolume, null), amt: num(x.amount, null),
      price: num(x.usdPrice, null), sig: /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(x.txHash || '') ? x.txHash : '', who: C.isAddr(x.traderAddress) ? x.traderAddress : '', mev: !!x.isMev,
      tags: Array.isArray(x.walletCategories) ? x.walletCategories.slice(0, 3).map(c => clean(c, 18)) : [],
    }));
  });
}
// the scanner's first source: jupiter's own gems feed (new / about to graduate / graduated, each with its bonding curve,
// audit and bundler numbers). the token lists below are the fallback, with the curve read from the chain.
async function gems() {
  const f = { launchpads: ['pump.fun'] };
  const r = await fetch('https://datapi.jup.ag/v1/pools/gems', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ recent: f, aboutToGraduate: f, graduated: f }), signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('gems ' + r.status);
  const j = await r.json();
  const one = (p, grad) => {
    const t = shape(p.baseAsset); const bc = Number(p.bondingCurve);
    t.progress = grad ? 1 : Number.isFinite(bc) ? Math.max(0, Math.min(1, bc / 100)) : null; t.grad = !!grad;
    if (grad) t.gradAt = p.createdAt || t.gradAt; t.liq = num(p.liquidity, t.liq); if (!t.created) t.created = p.createdAt || null;
    return t;
  };
  const pools = k => ((j && j[k] && j[k].pools) || []).filter(p => p && p.baseAsset && p.baseAsset.id);
  const out = { fresh: pools('recent').map(p => one(p, false)), soon: pools('aboutToGraduate').map(p => one(p, false)).sort((a, b) => (b.progress || 0) - (a.progress || 0)), grad: pools('graduated').map(p => one(p, true)).filter(t => (t.mcap || 0) >= 3000) };
  if (!out.fresh.length && !out.soon.length && !out.grad.length) throw new Error('gems empty');
  return out;
}
// the scanner keeps every coin born while you watch; once a coin leaves jupiter's newest-30 window its numbers come from
// here: one batched token lookup (market cap, holders, trades, audit) plus one chain read of where it sits on the curve.
// each coin's numbers are reused for 8 s, so many viewers watching the same births cost one lookup.
const STATS = new Map();
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
async function freshStats(ids) {
  const want = [...new Set(String(ids || '').split(','))].filter(C.isAddr).slice(0, 100);
  const now = Date.now(), need = want.filter(m => { const s = STATS.get(m); return !s || now - s.t > 8000; });
  if (need.length) {
    const [list, cur] = await Promise.all([within(jup('/tokens/v2/search?query=' + need.join(','), {}, 6000).catch(() => null), 7000), within(C.coinStats(need).catch(() => null), 5000)]);
    const by = new Map((Array.isArray(list) ? list : []).filter(x => x && x.id).map(x => [x.id, x]));
    for (const m of need) {
      const x = by.get(m), c = cur && cur[m]; if (!x && !c) continue;
      const t = x ? shape(x) : { mint: m };
      if (c) { t.progress = c.progress; if (c.complete) t.grad = true; }
      STATS.set(m, { t: now, v: t });
    }
    if (STATS.size > 4000) for (const [k, s] of STATS) if (now - s.t > 120000) STATS.delete(k);
  }
  return want.map(m => STATS.get(m)).filter(Boolean).map(s => s.v);
}
async function pulse() {
  return L.cached('pulse', 3500, async () => {
    try { return { at: Date.now(), src: 'jupiter', ...(await gems()) }; } catch {}
    const src = await Promise.allSettled([jup('/tokens/v2/recent'), jup('/tokens/v2/toptrending/5m?limit=100'), jup('/tokens/v2/toptrending/1h?limit=100'), jup('/tokens/v2/toporganicscore/5m?limit=100')]);
    const all = new Map();
    for (const r of src) if (r.status === 'fulfilled') for (const x of r.value || []) if (x.launchpad === 'pump.fun' && !all.has(x.id)) all.set(x.id, shape(x));
    const list = [...all.values()], live = list.filter(t => !t.grad).slice(0, 120);
    let cur = {}; try { cur = await C.coinStats(live.map(t => t.mint)); } catch {}
    for (const t of list) { const c = cur[t.mint]; t.progress = t.grad ? 1 : c ? c.progress : null; if (c && c.complete) t.grad = true; }
    const age = t => t.created ? Date.now() - new Date(t.created).getTime() : 9e15;
    const fresh = list.filter(t => !t.grad && (t.progress == null || t.progress < .3)).sort((a, b) => age(a) - age(b)).slice(0, 30);
    const soon = list.filter(t => !t.grad && t.progress != null && t.progress >= .3).sort((a, b) => b.progress - a.progress).slice(0, 30);
    const grad = list.filter(t => t.grad).sort((a, b) => new Date(b.gradAt || b.created || 0) - new Date(a.gradAt || a.created || 0)).slice(0, 30);
    return { at: Date.now(), src: 'chain', fresh, soon, grad };
  });
}
// token pictures. every source is raced at once and the first real image wins: for ipfs pictures that is pump.fun's own
// pinata gateway (it pins every coin image the moment it is made), filebase, pinata, ipfs.io and dweb; small resized copies
// (pinata's image optimizer, wsrv) are preferred for a moment before a full-size original is accepted.
const CIDRX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/;
function cidOf(u) {
  let m = /^ipfs:\/\/(?:ipfs\/)?([^/?#]+)(\/[^?#]*)?/.exec(u) || /\/ipfs\/([^/?#]+)(\/[^?#]*)?/.exec(u) || /^https:\/\/([a-z2-7]{50,})\.ipfs\.[^/]+(\/[^?#]*)?/.exec(u);
  return m && CIDRX.test(m[1]) ? m[1] + (m[2] && m[2] !== '/' ? m[2] : '') : null;
}
const sniffImg = (buf, ct) => buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : buf.subarray(0, 4).toString() === 'RIFF' ? 'image/webp' : buf.subarray(0, 3).toString() === 'GIF' ? 'image/gif'
  : /svg/.test(ct) || /^\s*<(\?xml|svg)/.test(buf.subarray(0, 120).toString()) ? 'image/svg+xml' : /^image\/(avif|bmp|x-icon|vnd\.microsoft\.icon)/.test(ct) ? ct : null;
async function grab(url, ms, kind) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'user-agent': 'Mozilla/5.0 (st3alth)', accept: kind === 'json' ? 'application/json,*/*' : 'image/avif,image/webp,image/*,*/*' }, redirect: 'follow' });
  if (!r.ok) throw new Error(String(r.status));
  const buf = Buffer.from(await r.arrayBuffer()), ct = String(r.headers.get('content-type') || '');
  if (kind === 'json') { if (buf.length > 200000) throw new Error('big'); return JSON.parse(buf.toString('utf8')); }
  if (buf.length < 40 || buf.length > 6_000_000) throw new Error('size'); const t = sniffImg(buf, ct); if (!t) throw new Error('not an image');
  return { buf, ct: t };
}
const ipfsUrls = cid => [`https://pump.mypinata.cloud/ipfs/${cid}`, `https://ipfs.filebase.io/ipfs/${cid}`, `https://gateway.pinata.cloud/ipfs/${cid}`, `https://ipfs.io/ipfs/${cid}`, `https://dweb.link/ipfs/${cid}`, `https://4everland.io/ipfs/${cid}`];
const wsrv = u => `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=96&h=96&fit=cover&output=webp&q=82&n=-1`;
// race: small copies win outright; a full-size original waits up to `grace` ms for a small one before it is taken
function race(small, big, ms = 9000, grace = 1600) {
  return new Promise(done => {
    let left = small.length + big.length, bigHit = null, timer = null, over = false;
    const end = v => { if (!over) { over = true; clearTimeout(timer); done(v); } };
    const fail = () => { if (--left <= 0) end(bigHit); };
    small.forEach(u => grab(u, ms, 'img').then(end, fail));
    big.forEach(u => grab(u, ms, 'img').then(v => { if (v.buf.length <= 250000) end(v); else { if (!bigHit) { bigHit = v; timer = setTimeout(() => end(bigHit), grace); } fail(); } }, fail));
    setTimeout(() => end(bigHit), ms + 500);
  });
}
async function fetchImg(u) {
  const cid = cidOf(u);
  if (cid) { const pin = `https://pump.mypinata.cloud/ipfs/${cid}`; const urls = ipfsUrls(cid); if (!/\/\/(ipfs\.io|dweb\.link|gateway\.pinata\.cloud|pump\.mypinata\.cloud|ipfs\.filebase\.io|4everland\.io)\//.test(u) && /^https:\/\//.test(u)) urls.unshift(u);
    return race([`${pin}?img-width=96&img-height=96&img-fit=cover&img-format=webp`, wsrv(pin)], urls); }
  return race([wsrv(u)], [u]);
}
// a coin with no picture listed yet: read its metadata link straight from the chain (metaplex, or the token-2022
// metadata extension that new pump.fun coins use), fetch that json from the fastest gateway, and use its image
async function grabJson(u) {
  const cid = cidOf(u);
  const urls = cid ? ipfsUrls(cid) : [u];
  return Promise.any(urls.map(x => grab(x, 7000, 'json')));
}
async function metaUri(mint) {
  const { PublicKey } = C.w3(); const MPL = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'), m = new PublicKey(mint);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('metadata'), MPL.toBuffer(), m.toBuffer()], MPL);
  const [a, b] = await C.rpc(c => c.getMultipleAccountsInfo([pda, m], 'confirmed'));
  const rd = (d, o) => { const n = d.readUInt32LE(o); if (n > 400 || o + 4 + n > d.length) throw new Error('bad'); return [d.subarray(o + 4, o + 4 + n).toString('utf8').replace(/\0/g, '').trim(), o + 4 + n]; };
  try { if (a && a.data && a.data.length > 80) { const [, o1] = rd(a.data, 65); const [, o2] = rd(a.data, o1); const [uri] = rd(a.data, o2); if (uri) return uri; } } catch {}
  try { if (b && b.data && b.data.length > 170) { const d = b.data; let o = 166; while (o + 4 <= d.length) { const t = d.readUInt16LE(o), l = d.readUInt16LE(o + 2); if (t === 19) { const [, p1] = rd(d, o + 4 + 64); const [, p2] = rd(d, p1); const [uri] = rd(d, p2); return uri || null; } if (!t && !l) break; o += 4 + l; } } } catch {}
  return null;
}
async function iconOf(mint) {
  return L.cached('icon:' + mint, 3600000, async () => {
    const uri = await metaUri(mint); if (!uri) return null;
    const j = await grabJson(/^ipfs:\/\//.test(uri) ? 'https://ipfs.io/ipfs/' + uri.slice(7) : uri);
    const im = j && typeof j.image === 'string' ? j.image.trim() : ''; return /^(https:\/\/|ipfs:\/\/)/.test(im) ? im : null;
  });
}
module.exports = async (req, res) => {
  const qs = L.query(req), op = String(qs.op || '');
  try {
    // pictures have their own, larger allowance below: a busy scanner asks for dozens a minute
    if (op !== 'img' && L.limited('m:' + L.ip(req), 150, 60000)) throw L.err(429, 'Slow down a little.');
    if (op === 'search') return L.send(res, 200, { ok: true, tokens: (await search(qs.q)).slice(0, 12) }, L.CACHE(20));
    if (op === 'token') { const t = await resolve(qs.q); return L.send(res, 200, { ok: true, token: t }, L.CACHE(15)); }
    if (op === 'quote') return L.send(res, 200, { ok: true, ...(await quote(qs)) });
    if (op === 'swap' && req.method === 'POST') return L.send(res, 200, { ok: true, ...(await swapTx(await L.body(req, 64 * 1024))) });
    if (op === 'relay' && req.method === 'POST') {
      const b = await L.body(req, 64 * 1024); const tx = String(b.tx || '');
      if (!/^[A-Za-z0-9+/=]{100,3000}$/.test(tx)) throw L.err(400, 'That is not a signed transaction.');
      const raw = Buffer.from(tx, 'base64'); let n = 0, sh = 0, i = 0; for (;;) { const v = raw[i++]; n |= (v & 0x7f) << sh; if (!(v & 0x80)) break; sh += 7; }
      if (n < 1 || raw.length < i + 64) throw L.err(400, 'That transaction is not signed.');
      const sig = C.b58enc(raw.subarray(i, i + 64)); await C.broadcast(tx); return L.send(res, 200, { ok: true, sig });
    }
    if (op === 'sig') { const s = String(qs.sig || ''); if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(s)) throw L.err(400, 'bad signature'); return L.send(res, 200, { ok: true, status: await C.statusOf(s) }); }
    if (op === 'trending') return L.send(res, 200, { ok: true, w: qs.w || '1h', tokens: await trending(qs.w) }, L.CACHE(30));
    if (op === 'recent') return L.send(res, 200, { ok: true, tokens: await recentPump() }, L.CACHE(4));
    if (op === 'fresh') return L.send(res, 200, { ok: true, tokens: await freshStats(qs.ids) }, L.CACHE(5));
    if (op === 'stocks') return L.send(res, 200, { ok: true, tokens: await stocks() }, L.CACHE(60));
    if (op === 'price') return L.send(res, 200, { ok: true, prices: await prices(qs.ids) }, L.CACHE(15));
    if (op === 'holdings') return L.send(res, 200, { ok: true, ...(await holdings(String(qs.owner || ''))) });
    if (op === 'ohlcv') return L.send(res, 200, { ok: true, ...(await ohlcv(String(qs.mint || ''), String(qs.tf || '15m'))) }, L.CACHE(20));
    if (op === 'holders') return L.send(res, 200, { ok: true, ...(await holders(qs.q)) }, L.CACHE(30));
    if (op === 'img') {
      if (L.limited('img:' + L.ip(req), 600, 60000)) throw L.err(429, 'slow down');
      let u = String(qs.u || '').trim(); const mint = String(qs.m || '');
      if (u && /^ipfs:\/\//.test(u)) u = 'https://ipfs.io/ipfs/' + u.replace(/^ipfs:\/\/(ipfs\/)?/, '');
      if (u) { let x; try { x = new URL(u); } catch { u = ''; } if (x && (x.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[)/.test(x.hostname))) u = ''; }
      let got = u ? await fetchImg(u) : null;
      if (!got && C.isAddr(mint)) { try { const alt = await iconOf(mint); if (alt && alt !== u) got = await fetchImg(alt); } catch {} }
      if (!got) { res.statusCode = 404; res.setHeader('cache-control', 'public, max-age=10, s-maxage=10'); return res.end(); }
      res.statusCode = 200; res.setHeader('content-type', got.ct); res.setHeader('cache-control', 'public, max-age=604800, s-maxage=2592000, immutable'); res.setHeader('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'"); res.setHeader('x-content-type-options', 'nosniff'); return res.end(got.buf);
    }
    if (op === 'trades') return L.send(res, 200, { ok: true, trades: await trades(String(qs.mint || '')) }, L.CACHE(2));
    if (op === 'pulse') return L.send(res, 200, { ok: true, ...(await pulse()) }, L.CACHE(3));
    if (op === 'tx') return L.send(res, 200, { ok: true, ...(await inspectTx(String(qs.sig || ''))) }, L.CACHE(30));
    if (op === 'account') return L.send(res, 200, { ok: true, ...(await account(String(qs.addr || ''))) });
    if (op === 'fees') return L.send(res, 200, { ok: true, ...(await fees()) }, L.CACHE(8));
    if (op === 'ping') return L.send(res, 200, { ok: true, ...(await ping()) });
    if (op === 'limit' && req.method === 'POST') { const b = await L.body(req, 64 * 1024); return L.send(res, 200, { ok: true, ...(await trigger(String(b.op || ''), b)) }); }
    if (op === 'dca' && req.method === 'POST') { const b = await L.body(req, 64 * 1024); return L.send(res, 200, { ok: true, ...(await recurring(String(b.op || ''), b)) }); }
    if (op === 'sendbuild' && req.method === 'POST') return L.send(res, 200, { ok: true, ...(await sendBuild(await L.body(req, 16 * 1024))) });
    return L.send(res, 404, { ok: false, error: 'Unknown op.' });
  } catch (e) {
    const code = e.code && Number.isInteger(e.code) ? e.code : 500;
    if (code === 500) console.error(e);
    return L.send(res, code, { ok: false, error: code === 500 ? 'Something broke on our side. Try again.' : e.message });
  }
};
