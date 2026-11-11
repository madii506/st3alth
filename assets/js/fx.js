// st3alth · motion. masks whose eyes follow your cursor and blink, a crowd of watchers when you go quiet,
// text that decodes into place, and block titles that resolve as they print. all of it stops for reduced motion.
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
if (out) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('blk')) { const h = n.querySelector(':scope > .bh'); if (h) decode(h, 380); } }).observe(out, { childList: true });

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
