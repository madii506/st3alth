// st3alth chain side: every read goes through the server (Helius first when HELIUS_API_KEY is set), so a visitor's IP
// never touches a public RPC. web3.js for the calls; the official pump SDK only to read bonding curves.
const crypto = require('crypto');
const L = require('./_lib');
const MOCK = !!process.env.ST3_MOCK;           // local dev only: no network, fake chain answers
let W3, P;
const w3 = () => W3 || (W3 = require('@solana/web3.js'));
const pump = () => P || (P = require('@pump-fun/pump-sdk'));
const HKEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC = HKEY ? `https://mainnet.helius-rpc.com/?api-key=${HKEY}` : '';
const RPCS = [HELIUS_RPC, process.env.RPC_URL, 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'].filter(Boolean);
const INITIAL_REAL_TOKENS = 793100000000000n;   // pump curve: 793.1M tokens (6 decimals) sold before graduation

function timedFetch(ms) { return (url, opt = {}) => fetch(url, { ...opt, signal: AbortSignal.timeout(ms) }); }
let conns = null;
function connections() {
  if (!conns) { const { Connection } = w3(); conns = RPCS.map(u => new Connection(u, { commitment: 'confirmed', disableRetryOnRateLimit: true, fetch: timedFetch(10000) })); }
  return conns;
}
async function rpc(fn) {
  let last;
  for (const c of connections()) { try { return await fn(c); } catch (e) { last = e; } }
  const m = String(last && last.message || last || '');
  throw L.err(502, 'Solana RPC is busy right now. Try again in a moment.', { detail: m.slice(0, 160) });
}
// raw JSON-RPC to Helius (for its own methods, like getPriorityFeeEstimate); falls back to the plain RPCs for standard ones
async function rawRpc(method, params, ms = 8000) {
  for (const u of RPCS) {
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(ms) });
      const j = await r.json(); if (j && j.result !== undefined) return j.result;
    } catch {}
  }
  throw L.err(502, 'Solana RPC is busy right now. Try again in a moment.');
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58enc(buf) { let n = 0n; for (const b of buf) n = n * 256n + BigInt(b); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of buf) { if (b === 0) s = '1' + s; else break; } return s; }
function b58dec(str) { let n = 0n; for (const c of str) { const i = B58.indexOf(c); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i); } const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; } for (const c of str) { if (c === '1') out.unshift(0); else break; } return Uint8Array.from(out); }
function isAddr(s) { if (typeof s !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false; try { return b58dec(s).length === 32; } catch { return false; } }

const M = { sigs: new Map() };
async function broadcast(rawB64) {
  if (MOCK) { return true; }
  const raw = Buffer.from(rawB64, 'base64');
  await rpc(c => c.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 2 }));
  return true;
}
async function statusOf(sig) {
  if (MOCK) { const s = M.sigs.get(sig) || { at: Date.now() }; M.sigs.set(sig, s); return Date.now() - s.at > 1500 ? { done: true, err: null } : null; }
  const r = await rpc(c => c.getSignatureStatuses([sig], { searchTransactionHistory: true }));
  const s = r.value[0]; if (!s) return null;
  if (s.err) return { done: true, err: JSON.stringify(s.err) };
  if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return { done: true, err: null };
  return null;
}
async function coinStats(mints) {
  if (!mints.length) return {};
  if (MOCK) return Object.fromEntries(mints.map(m => { const h = crypto.createHash('sha256').update(m).digest(); return [m, { mcapLamports: 27_000_000_000 + h.readUInt32BE(0) % 60_000_000_000, progress: (h[4] % 100) / 100, complete: h[5] % 9 === 0 }]; }));
  return L.cached('stats:' + mints.join(','), 25000, async () => {
    const { PublicKey } = w3(); const S = pump();
    const out = {};
    for (let i = 0; i < mints.length; i += 100) {
      const part = mints.slice(i, i + 100);
      const infos = await rpc(c => c.getMultipleAccountsInfo(part.map(m => S.bondingCurvePda(new PublicKey(m))), 'confirmed'));
      infos.forEach((info, j) => {
        if (!info) return;
        try {
          const bc = S.PUMP_SDK.decodeBondingCurve(info);
          const mcap = S.bondingCurveMarketCap({ mintSupply: bc.tokenTotalSupply, virtualQuoteReserves: bc.virtualQuoteReserves, virtualTokenReserves: bc.virtualTokenReserves });
          const real = BigInt(bc.realTokenReserves.toString());
          const progress = bc.complete ? 1 : Math.max(0, Math.min(1, Number(INITIAL_REAL_TOKENS - real) / Number(INITIAL_REAL_TOKENS)));
          out[part[j]] = { mcapLamports: Number(mcap.toString()), progress, complete: !!bc.complete };
        } catch {}
      });
    }
    return out;
  });
}
async function solUsd() {
  if (MOCK) return 182.4;
  return L.cached('solusd', 60000, async () => {
    const r = await L.getJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {}, 5000);
    const v = r.json && r.json.solana && r.json.solana.usd; if (!v) throw new Error('no price'); return v;
  }).catch(() => null);
}
module.exports = { rpc, rawRpc, w3, MOCK, HKEY, b58enc, b58dec, isAddr, broadcast, statusOf, coinStats, solUsd };
