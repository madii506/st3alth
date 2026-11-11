// Wallet connect, done by hand with the Wallet Standard: wallets announce themselves, we list them, connect,
// and hand them raw transaction bytes to sign. No wallet library and no outside script.
const WALLETS = [], seenL = new Set(), curL = new Set();
const usable = w => w && w.features && w.features['standard:connect'] && (w.chains || []).some(c => String(c).startsWith('solana:')) && (w.features['solana:signTransaction'] || w.features['solana:signAndSendTransaction']);
const api = Object.freeze({ register(...ws) { for (const w of ws) if (usable(w) && !WALLETS.includes(w)) WALLETS.push(w); seenL.forEach(f => f(WALLETS.slice())); return () => {}; } });
try { addEventListener('wallet-standard:register-wallet', e => { try { e.detail(api); } catch {} }); } catch {}
try { dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api })); } catch {}

let CUR = null;
const fire = () => curL.forEach(f => { try { f(CUR); } catch {} });
export const wallets = () => WALLETS.slice();
export const onWallets = f => { seenL.add(f); return () => seenL.delete(f); };
export const current = () => CUR;
export const onChange = f => { curL.add(f); f(CUR); return () => curL.delete(f); };

export async function connect(w) {
  const r = await w.features['standard:connect'].connect();
  const accounts = (r && r.accounts && r.accounts.length ? r.accounts : w.accounts) || [];
  const acc = accounts.find(a => (a.chains || []).some(c => String(c).startsWith('solana:'))) || accounts[0];
  if (!acc) throw new Error('The wallet did not share an account.');
  CUR = { wallet: w, account: acc, address: acc.address, name: w.name, icon: w.icon };
  const ev = w.features['standard:events'];
  if (ev && !w.__haloOn) { w.__haloOn = true; ev.on('change', ch => { if (!CUR || CUR.wallet !== w || !ch.accounts) return; if (!ch.accounts.length) { CUR = null; fire(); } else { const a = ch.accounts[0]; CUR = { ...CUR, account: a, address: a.address }; fire(); } }); }
  fire(); return CUR;
}
export async function disconnect() {
  const w = CUR && CUR.wallet; CUR = null; fire();
  try { if (w && w.features['standard:disconnect']) await w.features['standard:disconnect'].disconnect(); } catch {}
}
export async function signTx(bytes) {
  if (!CUR) throw new Error('Connect a wallet first.');
  const f = CUR.wallet.features['solana:signTransaction'];
  if (!f) throw new Error('This wallet cannot sign a launch here. Try Phantom, Solflare or Backpack.');
  const out = await f.signTransaction({ account: CUR.account, transaction: bytes, chain: 'solana:mainnet' });
  const o = Array.isArray(out) ? out[0] : out;
  return new Uint8Array(o.signedTransaction);
}
export async function signMessage(bytes) {
  if (!CUR) throw new Error('Connect a wallet first.');
  const f = CUR.wallet.features['solana:signMessage'];
  if (!f) throw new Error('This wallet cannot sign a message here. Try Phantom, Solflare or Backpack.');
  const out = await f.signMessage({ account: CUR.account, message: bytes });
  const o = Array.isArray(out) ? out[0] : out;
  return new Uint8Array(o.signature);
}

// ---- raw transaction bytes: [shortvec n][n × 64-byte signatures][message]
function shortvec(b, i) { let len = 0, size = 0; for (;;) { const v = b[i + size]; len |= (v & 0x7f) << (size * 7); size++; if (!(v & 0x80)) break; } return [len, size]; }
export function parts(bytes) {
  const [n, s] = shortvec(bytes, 0), msg = bytes.subarray(s + n * 64);
  let i = msg[0] & 0x80 ? 1 : 0; const nReq = msg[i]; i += 3;
  const [nk, ks] = shortvec(msg, i); i += ks;
  const keys = []; for (let k = 0; k < nk; k++) keys.push(msg.subarray(i + k * 32, i + k * 32 + 32));
  return { n, sigStart: s, msg, nReq, keys };
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
// the coin's mint key was made in this browser; it signs last, over exactly what the wallet signed
export function addSignature(bytes, pub32, secret64) {
  const p = parts(bytes), idx = p.keys.findIndex(k => same(k, pub32));
  if (idx < 0 || idx >= p.nReq) throw new Error('The coin key is not part of this launch.');
  const out = new Uint8Array(bytes); out.set(nacl.sign.detached(p.msg, secret64), p.sigStart + idx * 64); return out;
}
export const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
