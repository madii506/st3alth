// st3alth · motion. masks whose eyes follow your cursor and blink, a crowd of watchers when you go quiet,
// text that decodes into place, and block titles that resolve as they print. all of it stops for reduced motion.
import { history } from './core.js?v=6';
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const GL = '░▒▓/\\<>_=+·:01';

// ---------------------------------------------------------------- decode: scramble the text nodes of an element, then settle left to right
export function decode(el, ms = 420) {
  if (!el || RM.matches) return;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
  while (tw.nextNode()) { const n = tw.currentNode; if (n.nodeValue.trim()) nodes.push([n, n.nodeValue]); }
  const total = nodes.reduce((a, [, s]) => a + s.length, 0); if (!total || total > 600) return;
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms); let seen = 0;
    for (const [n, s] of nodes) { let o = ''; for (let i = 0; i < s.length; i++, seen++) { const c = s[i]; o += c === ' ' || seen / total < k * 1.08 - .08 ? c : GL[(Math.random() * GL.length) | 0]; } n.nodeValue = o; }
    if (k < 1) requestAnimationFrame(step); else for (const [n, s] of nodes) n.nodeValue = s;
  };
  requestAnimationFrame(step);
}
const out = document.getElementById('out');
if (out) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) {
  if (n.nodeType !== 1) continue;
  if (n.classList.contains('blk')) { const h = n.querySelector(':scope > .bh'); if (h) decode(h, 380); }
  else if (n.classList.contains('ln') && !RM.matches && n.querySelector('.r') && /✗/.test(n.textContent)) { n.classList.add('glitch'); setTimeout(() => n.classList.remove('glitch'), 420); }
} }).observe(out, { childList: true });

// ---------------------------------------------------------------- the prompt: a hairline fires across it on every command; ctrl+r searches your history like a real shell
const inp = document.getElementById('cmd'), tin = document.getElementById('tin');
if (tin) tin.addEventListener('submit', () => { if (!inp.value.trim() || RM.matches) return; tin.classList.remove('fire'); void tin.offsetWidth; tin.classList.add('fire'); }, true);
const RS = { on: false, q: '', i: 0, el: null };
const rsMatches = () => { const seen = new Set(); return history().filter(h => h.includes(RS.q) && !seen.has(h) && seen.add(h)); };
function rsPaint() {
  const l = rsMatches(), m = l[Math.min(RS.i, Math.max(0, l.length - 1))] || '', at = RS.q ? m.indexOf(RS.q) : -1;
  const esc = x => x.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  RS.el.innerHTML = `<span class="rs-k">${l.length || !RS.q ? 'reverse-i-search' : 'failing reverse-i-search'}</span> <span class="rs-q">${esc(RS.q) || '…'}</span> <span class="rs-m">${m ? (at >= 0 ? esc(m.slice(0, at)) + '<b>' + esc(RS.q) + '</b>' + esc(m.slice(at + RS.q.length)) : esc(m)) : ''}</span><span class="rs-h">enter run · → take · esc</span>`;
  RS.m = m;
}
function rsOpen() { RS.on = true; RS.q = ''; RS.i = 0; RS.el = document.createElement('div'); RS.el.className = 'rsearch'; tin.appendChild(RS.el); rsPaint(); }
function rsClose() { RS.on = false; if (RS.el) RS.el.remove(); RS.el = null; }
if (inp && tin) inp.addEventListener('keydown', e => {
  if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); e.stopImmediatePropagation(); if (!RS.on) rsOpen(); else { RS.i++; rsPaint(); } return; }
  if (!RS.on) return;
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (e.key === 'Escape' || (e.ctrlKey && (e.key === 'g' || e.key === 'c'))) { stop(); rsClose(); return; }
  if (e.key === 'Enter') { stop(); const m = RS.m; rsClose(); if (m) { inp.value = m; tin.requestSubmit(); } return; }
  if (e.key === 'ArrowRight' || e.key === 'Tab') { stop(); const m = RS.m; rsClose(); if (m) { inp.value = m; inp.dispatchEvent(new Event('input')); } return; }
  if (e.key === 'Backspace') { stop(); RS.q = RS.q.slice(0, -1); RS.i = 0; rsPaint(); return; }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { stop(); RS.q += e.key; RS.i = 0; rsPaint(); return; }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { stop(); RS.i = Math.max(0, RS.i + (e.key === 'ArrowUp' ? 1 : -1)); rsPaint(); }
}, true);
if (inp) inp.addEventListener('blur', () => { if (RS.on) setTimeout(() => { if (document.activeElement !== inp) rsClose(); }, 150); });

// ---------------------------------------------------------------- the chain's heartbeat: a trace in the top bar that beats once per slot
(function ekg() {
  const sl = document.getElementById('hv-slot'); if (!sl) return;
  const cv = document.createElement('canvas'); cv.className = 'ekg'; cv.width = 128; cv.height = 28; cv.setAttribute('aria-hidden', 'true'); sl.parentElement.appendChild(cv);
  const c = cv.getContext('2d'), N = 64, buf = new Float32Array(N), SHAPE = [0, -.25, 1, -.55, .18, 0]; let q = [], lastTxt = sl.textContent;
  setInterval(() => {
    if (document.hidden) return;
    if (sl.textContent !== lastTxt) { lastTxt = sl.textContent; if (/\d/.test(lastTxt)) q.push(...SHAPE); }
    buf.copyWithin(0, 1); buf[N - 1] = q.length ? q.shift() : 0;
    c.clearRect(0, 0, 128, 28); c.strokeStyle = 'rgba(217,160,102,.85)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < N; i++) { const x = i * 2, y = 15 - buf[i] * 11; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }, 66);
})();

// ---------------------------------------------------------------- eyes: every mask on the page looks at the cursor
const P = { x: innerWidth / 2, y: innerHeight * .4, raf: 0 };
export function look() {
  P.raf = 0;
  for (const svg of document.querySelectorAll('svg.mk')) {
    const g = svg.querySelector('.eyes'); if (!g) continue;
    const r = svg.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height * .44, dx = P.x - cx, dy = P.y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / (r.width * 1.2 + 90));
    g.setAttribute('transform', `translate(${(dx / d * 5.4 * k).toFixed(2)} ${(dy / d * 2.2 * k).toFixed(2)})`);
  }
}
addEventListener('pointermove', e => { P.x = e.clientX; P.y = e.clientY; if (!P.raf) P.raf = requestAnimationFrame(look); }, { passive: true });
(function blink() {
  setTimeout(() => {
    if (!document.hidden && !RM.matches) document.querySelectorAll('svg.mk .eyes').forEach(g => { if (Math.random() < .55) { g.style.opacity = '0'; setTimeout(() => { g.style.opacity = ''; }, 90 + Math.random() * 90); } });
    blink();
  }, 2200 + Math.random() * 4200);
})();

// ---------------------------------------------------------------- watchers: go quiet for a while and the room fills up. they look at you. any key or click sends them away.
const W = { el: null, t: 0 }, IDLE = 45000;
function arm() { clearTimeout(W.t); W.t = setTimeout(summon, IDLE); }
function summon() {
  const B = document.body;
  if (document.hidden || RM.matches || innerWidth < 760 || B.classList.contains('conmax') || B.dataset.focus !== 'stage' || document.getElementById('s3i')) { W.t = setTimeout(summon, 15000); return; }
  const host = document.getElementById('wins'), mk = document.querySelector('.r-brand .mk'); if (!host || !mk || W.el) return;
  const el = document.createElement('div'); el.className = 'watchers'; el.setAttribute('aria-hidden', 'true');
  const rows = [[9, 46, .24, 30, 1.6], [7, 68, .4, 46, .9], [5, 100, .66, 66, 0]]; let h = '';
  for (const [n, w, o, top, dl] of rows) for (let i = 0; i < n; i++) {
    const x = (i + .5) / n * 100 + (Math.random() - .5) * (34 / n), y = top + (Math.random() - .5) * 5;
    h += `<div class="wt" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${w}px;--o:${o};--d:${(dl + Math.random() * 1.4).toFixed(2)}s"><div class="wt-b"></div>${mk.outerHTML}</div>`;
  }
  el.innerHTML = h; host.appendChild(el); W.el = el;
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dismiss(); }, true);
  requestAnimationFrame(() => { el.classList.add('on'); look(); });
}
function dismiss() { const el = W.el; W.el = null; arm(); if (!el) return; el.classList.remove('on'); el.classList.add('off'); setTimeout(() => el.remove(), 420); }
for (const ev of ['keydown', 'wheel', 'touchstart']) addEventListener(ev, () => (W.el ? dismiss() : arm()), { passive: true, capture: true });
addEventListener('pointerdown', () => (W.el ? dismiss() : arm()), { passive: true, capture: true });
addEventListener('pointermove', () => { if (!W.el) arm(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && W.el) dismiss(); });
window.__st3watch = summon;
arm();
