// st3alth · vanity grinder (a worker): makes ed25519 keys in this tab until one starts or ends with your letters.
// it uses the browser's own ed25519 when there is one (fast), tweetnacl otherwise. nothing leaves the tab.
const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(b) {
  const d = [0];
  for (let i = 0; i < b.length; i++) { let c = b[i]; for (let j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } }
  let s = ''; for (let i = 0; i < b.length && b[i] === 0; i++) s += '1';
  for (let i = d.length - 1; i >= 0; i--) s += A[d[i]];
  return s;
}
let stop = false;
onmessage = async e => {
  const m = e.data; if (m.stop) { stop = true; return; }
  const ci = !!m.ci, P = ci ? m.pre.toLowerCase() : m.pre, S = ci ? m.suf.toLowerCase() : m.suf;
  const test = a => { const x = ci ? a.toLowerCase() : a; return (!P || x.startsWith(P)) && (!S || x.endsWith(S)); };
  const sub = self.crypto && self.crypto.subtle; let web = !!sub;
  if (web) { try { await sub.generateKey({ name: 'Ed25519' }, true, ['sign']); } catch { web = false; } }
  if (!web) importScripts('/assets/nacl-fast.min.js');
  let n = 0, last = performance.now(), sample = '';
  while (!stop) {
    if (web) {
      const ks = await Promise.all(Array.from({ length: 64 }, () => sub.generateKey({ name: 'Ed25519' }, true, ['sign'])));
      const raws = await Promise.all(ks.map(k => sub.exportKey('raw', k.publicKey)));
      for (let i = 0; i < ks.length; i++) {
        const a = b58(new Uint8Array(raws[i])); n++; if (i === 0) sample = a;
        if (test(a)) { const p8 = new Uint8Array(await sub.exportKey('pkcs8', ks[i].privateKey)); postMessage({ n, sample: a, hit: a, seed: Array.from(p8.slice(-32)) }); stop = true; return; }
      }
    } else {
      const seed = new Uint8Array(32);
      for (let i = 0; i < 48; i++) {
        crypto.getRandomValues(seed); const kp = nacl.sign.keyPair.fromSeed(seed), a = b58(kp.publicKey); n++; if (i === 0) sample = a;
        if (test(a)) { postMessage({ n, sample: a, hit: a, seed: Array.from(seed) }); stop = true; return; }
      }
    }
    const t = performance.now(); if (t - last > 120) { postMessage({ n, sample }); n = 0; last = t; }
  }
};
