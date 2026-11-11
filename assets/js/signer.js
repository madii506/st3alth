// st3alth · who signs: your wallet (Wallet Standard, by hand) or a burner born in this tab.
// A burner's secret never leaves the page; it is gone when the tab closes unless you save the key file.
import * as WAL from './wallet98.js?v=4';
import { b58, unb64, b64, unb58 } from './core.js?v=4';
export { WAL };
let BURN = null, USE = 'wallet';
const subs = new Set(); const fire = () => subs.forEach(f => { try { f(state()); } catch {} });
WAL.onChange(() => fire());
export const onSigner = f => { subs.add(f); f(state()); return () => subs.delete(f); };
export function state() {
  const w = WAL.current();
  return { wallet: w ? { address: w.address, name: w.name } : null, burner: BURN ? { address: BURN.pub, saved: BURN.saved } : null, use: USE, active: USE === 'burner' && BURN ? BURN.pub : w ? w.address : null };
}
export function newBurner() { const kp = nacl.sign.keyPair(); BURN = { pub: b58(kp.publicKey), kp, saved: false }; fire(); return BURN.pub; }
export function adoptBurner(kp) { BURN = { pub: b58(kp.publicKey), kp, saved: false }; fire(); return BURN.pub; }
export function loadBurner(text) {
  text = String(text || '').trim(); const sec = text.startsWith('[') ? Uint8Array.from(JSON.parse(text)) : unb58(text);
  const kp = sec.length === 32 ? nacl.sign.keyPair.fromSeed(sec) : nacl.sign.keyPair.fromSecretKey(sec);
  BURN = { pub: b58(kp.publicKey), kp, saved: true }; fire(); return BURN.pub;
}
export function saveBurner() {
  if (!BURN) throw new Error('No burner yet. Type burner new.');
  const blob = new Blob([JSON.stringify(Array.from(BURN.kp.secretKey))], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `st3alth-burner-${BURN.pub.slice(0, 6)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  BURN.saved = true; fire();
}
export function forgetBurner() { BURN = null; if (USE === 'burner') USE = 'wallet'; fire(); }
export function use(k) { if (k === 'burner' && !BURN) throw new Error('No burner yet. Type burner new.'); USE = k === 'burner' ? 'burner' : 'wallet'; fire(); }
export const active = () => state().active;
export const activeKind = () => (USE === 'burner' && BURN) ? 'burner' : 'wallet';
export const burnerPub = () => BURN && BURN.pub;
// sign a base64 transaction as the active signer; returns base64 of the signed bytes
export async function sign(txB64, kind = activeKind()) {
  const bytes = unb64(txB64);
  if (kind === 'burner') { if (!BURN) throw new Error('No burner.'); return b64(WAL.addSignature(bytes, BURN.kp.publicKey, BURN.kp.secretKey)); }
  if (!WAL.current()) throw new Error('Connect a wallet first. Type connect.');
  try { return b64(await WAL.signTx(bytes)); }
  catch (e) { throw new Error(/reject|denied|cancel|declin/i.test(String(e && e.message)) ? 'You cancelled in your wallet. Nothing was sent.' : (e && e.message) || 'The wallet did not sign.'); }
}
// the usual solana wallets first, so a browser with metamask too still opens phantom
const WPREF = ['phantom', 'solflare', 'backpack', 'jupiter', 'glow', 'okx'];
const wrank = w => { const i = WPREF.findIndex(k => String(w.name || '').toLowerCase().includes(k)); return i < 0 ? 99 : i; };
export async function connectAny(i = 0) {
  const ws = WAL.wallets().slice().sort((a, b) => wrank(a) - wrank(b)); if (!ws.length) throw new Error('No Solana wallet found in this browser. Phantom, Solflare and Backpack all work.');
  return WAL.connect(ws[Math.min(i, ws.length - 1)]);
}
