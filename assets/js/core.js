// st3alth · core: the output engine, formatting, the api, history, completion, the palette.
export const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
export const ago = t => { if (!t) return '—'; const s = Math.max(1, (Date.now() - new Date(t).getTime()) / 1000); return s < 60 ? `${s | 0}s` : s < 3600 ? `${s / 60 | 0}m` : s < 86400 ? `${s / 3600 | 0}h` : `${s / 86400 | 0}d`; };
export const usd = (n, d) => { if (n == null || !isFinite(n)) return '—'; const a = Math.abs(n); return (n < 0 ? '-' : '') + '$' + (a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : a.toFixed(d ?? (a < 1 ? 2 : 0))); };
export const price = n => { if (n == null || !isFinite(n)) return '—'; if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 }); if (n >= 1) return '$' + n.toFixed(3); if (n >= .01) return '$' + n.toFixed(4); const z = Math.floor(-Math.log10(n)); return '$0.' + (z > 4 ? `0<sub>${z}</sub>` + Math.round(n * 10 ** (z + 3)) : '0'.repeat(z) + Math.round(n * 10 ** (z + 3))); };
export const pct = (n, d = 1) => n == null || !isFinite(n) ? '<span class="f">—</span>' : `<span class="${n >= 0 ? 'up' : 'dn'}">${n >= 0 ? '+' : ''}${n.toFixed(d)}%</span>`;
export const amt = n => { if (n == null || !isFinite(n)) return '—'; const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : a >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) : String(Number(n.toPrecision(4))); };
export const img = (u, m) => u || m ? `/api/img?${u ? 'u=' + encodeURIComponent(u) : ''}${m ? (u ? '&' : '') + 'm=' + encodeURIComponent(m) : ''}` : '/assets/favicon.svg';
// a coin picture that never gives up: while the real picture is on its way (or still being pinned) the coin shows its own
// pixel mark, made from its mint, and the picture is asked for again a few times
export function ident(seed) {
  let h = 2166136261; for (const ch of String(seed || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const on = []; for (let i = 0; i < 15; i++) if ((h >>> i) & 1) { const x = i % 3, y = (i / 3) | 0; on.push([x, y]); if (x < 2) on.push([4 - x, y]); }
  const shade = ['#eeebe4', '#cdc8bf', '#a8a399'][(h >>> 16) % 3];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 7 7' shape-rendering='crispEdges'><rect width='7' height='7' fill='#121212'/>${on.map(([x, y]) => `<rect x='${x + 1}' y='${y + 1}' width='1' height='1' fill='${shade}'/>`).join('')}</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
export const psHtml = d => `st3alth:${esc(d)}$`;
export const pic = (t, cls = 'ic') => { const u = img(t.icon, t.mint); return `<img${cls ? ` class="${cls}"` : ''} src="${u}" data-src="${u}" data-m="${esc(t.mint || '')}" alt="" loading="lazy" decoding="async">`; };
const WAIT = [2500, 6000, 12000, 24000, 45000];
export function imgErr(t) {
  if (!t.dataset.m) { if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = '/assets/favicon.svg'; } return; }
  if (t.src.startsWith('data:')) return;
  const n = +(t.dataset.n || 0); t.src = ident(t.dataset.m); t.classList.add('idt');
  clearTimeout(t._rt); if (n >= WAIT.length) return;
  t._rt = setTimeout(() => { if (!t.isConnected || !t.dataset.src) return; t.dataset.n = n + 1; t.src = t.dataset.src + '&r=' + (n + 1); }, WAIT[n]);
}
export function imgSet(t, u) { if (!t || t.dataset.src === u) return; clearTimeout(t._rt); t.dataset.src = u; t.dataset.n = 0; t.src = u; }
export function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }
// the $ST3ALTH coin: empty until launch (set it here and the top bar shows it)
export const CA = '';
export async function copy(t) { try { await navigator.clipboard.writeText(t); toast('copied'); } catch { toast('select it and copy'); } }

export async function api(op, { method = 'GET', body, params } = {}) {
  const u = '/api/' + op + (params ? '?' + new URLSearchParams(params) : '');
  let r; try { r = await fetch(u, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('No connection. Check your internet and try again.'); }
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok || j.ok === false) { const e = new Error(j.error || `Request failed (${r.status}).`); e.detail = j.detail; e.status = r.status; throw e; }
  return j;
}

// base58 / base64
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58(bytes) { let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of bytes) { if (b === 0) s = '1' + s; else break; } return s; }
export function unb58(str) { let n = 0n; for (const c of str) { const i = B58.indexOf(c); if (i < 0) throw new Error('bad'); n = n * 58n + BigInt(i); } const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; } for (const c of str) { if (c === '1') out.unshift(0); else break; } return new Uint8Array(out); }
export const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
export const isAddr = s => { if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s || '')) return false; try { return unb58(s).length === 32; } catch { return false; } };

// ---------------------------------------------------------------- output
const OUT = () => $('#out');
let stick = true, raf = 0, auto = false;
// the output follows new lines with an eased glide (not a jump); scrolling up yourself pauses it
export function initOut() { const o = OUT(); o.addEventListener('scroll', () => { if (!auto) stick = o.scrollHeight - o.scrollTop - o.clientHeight < 60; }, { passive: true }); o.addEventListener('wheel', e => { if (e.deltaY < 0) stick = false; }, { passive: true }); }
const keep = () => {
  if (!stick || raf) return;
  const o = OUT(), step = () => { const target = o.scrollHeight - o.clientHeight, d = target - o.scrollTop; if (!stick || Math.abs(d) < 1) { if (stick) o.scrollTop = target; raf = 0; auto = false; return; } auto = true; o.scrollTop += Math.max(1, d * .22); raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
};
export const follow = () => { stick = true; keep(); };
export function line(html = '', cls = '') { const d = document.createElement('div'); d.className = 'ln' + (cls ? ' ' + cls : ''); d.innerHTML = html; OUT().appendChild(d); keep(); return d; }
export function block(title, html, { close = true } = {}) {
  const d = document.createElement('div'); d.className = 'blk';
  d.innerHTML = `<div class="bh"><b>■</b>${title}${close ? '<button type="button" class="x" aria-label="close">✕</button>' : ''}</div><div class="bb">${html}</div>`;
  if (close) d.querySelector('.x').onclick = () => { d.style.transition = 'opacity .2s, transform .2s'; d.style.opacity = 0; d.style.transform = 'scale(.99)'; setTimeout(() => d.remove(), 200); };
  OUT().appendChild(d); keep(); return d;
}
export async function typeLines(list, ms = 22) { for (const l of list) { line(l); await sleep(ms); } }
const FR = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
export function spinner(text) {
  const el = line(`<span class="spin">⠋</span> ${text}`); let i = 0; const s = el.querySelector('.spin');
  const t = setInterval(() => { s.textContent = FR[i++ % FR.length]; }, 70);
  return { el, set(h) { el.innerHTML = `<span class="spin">${FR[i % FR.length]}</span> ${h}`; }, done(h, cls = 'o') { clearInterval(t); el.innerHTML = h ?? el.innerHTML.replace(/<span class="spin">.<\/span>/, `<span class="${cls}">${cls === 'o' ? '✓' : '✗'}</span>`); }, fail(h) { clearInterval(t); el.innerHTML = `<span class="r">✗</span> ${h}`; } };
}
export const dots = (k, v, w = 22) => { if (innerWidth < 720) w = Math.min(w, 15); return dotsW(k, v, w); };
const dotsW = (k, v, w) => `<span class="d">${esc(k)} ${'.'.repeat(Math.max(2, w - k.length))}</span> ${v}`;
export function clear() { OUT().innerHTML = ''; }

// ---------------------------------------------------------------- history (kept in this browser only)
let HIST = []; try { HIST = JSON.parse(localStorage.getItem('st3:hist') || '[]').slice(0, 200); } catch {}
export const history = () => HIST;
export function pushHist(c) { if (HIST[0] !== c) HIST.unshift(c); HIST = HIST.slice(0, 200); try { localStorage.setItem('st3:hist', JSON.stringify(HIST)); } catch {} }
export function forgetHist() { HIST = []; try { localStorage.removeItem('st3:hist'); } catch {} }

// tokens seen anywhere on screen, for completion: { sym -> mint }
export const SEEN = new Map();
// exposure traces of the wallets you sign with, shared so a swap can say what it will reveal before you sign it
export const EXPO = new Map();
export function seen(t) { if (t && t.sym && t.mint && !SEEN.has(t.sym.toLowerCase())) SEEN.set(t.sym.toLowerCase(), t.mint); }
