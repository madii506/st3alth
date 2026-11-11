// st3alth · privacy: trace (window 2), the funding chain, labels, your mask in the side column, masked mode, panic.
// Every number comes from the chain through Helius. The score only adds up what a stranger can already see.
import { $, $$, esc, api, short, ago, line, block, spinner, dots, toast, copy, isAddr, sleep, EXPO } from './core.js?v=4';
import * as SG from './signer.js?v=4';
import { def, showTab } from './cmds.js?v=4';

const GRADE_CLS = { ghost: 'g0', 'low profile': 'g1', traceable: 'g2', exposed: 'g3' };
const GRADE_COL = { ghost: '#a7d7b6', 'low profile': '#eeebe4', traceable: '#e7c58c', exposed: '#ea9f9f' };
const KIND_COL = { you: '#d9a066', cex: '#ea9f9f', defi: '#a7d7b6', bridge: '#9fb4e8', risk: '#ff7a7a', known: '#c7c3bb', null: '#5a5751' };
const nm = c => c && c.label && c.label.name ? c.label.name : short(c.addr);
const solx = v => v == null ? '—' : (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3)) + ' SOL';
const ring = (v, size = 132, w = 9, col = '#eeebe4') => { const r = (size - w) / 2, c = 2 * Math.PI * r; return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#1b1b1e" stroke-width="${w}"/><circle class="rg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-to="${c * (1 - v / 100)}" style="transition:stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)"/></svg>`; };
const animRings = el => requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll('.rg').forEach(c => { c.style.strokeDashoffset = c.dataset.to; })));
function countUp(el, to, ms = 1200) { const t0 = performance.now(); const f = n => { const k = Math.min(1, (n - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }

// ---------------------------------------------------------------- the graph: a slow force layout, drawn on a canvas
const G = { nodes: [], edges: [], hover: null, raf: 0, t: 0, cam: { x: 0, y: 0, z: 1 }, drag: null, pulse: [] };
function buildGraph(T) {
  const nodes = [], edges = [], at = new Map();
  const add = (id, o) => { if (at.has(id)) return at.get(id); const n = { id, x: (Math.random() - .5) * 60, y: (Math.random() - .5) * 60, vx: 0, vy: 0, born: performance.now() + nodes.length * 35, ...o }; at.set(id, n); nodes.push(n); return n; };
  const me = add(T.addr, { kind: 'you', r: 13, label: T.self && (T.self.domains || [])[0] || 'this wallet', fixed: true, x: 0, y: 0 });
  let prev = me;
  T.chain.forEach((c, i) => { const n = add(c.addr, { kind: c.kind || null, r: 8 + (c.kind === 'cex' ? 3 : 0), label: (c.label && c.label.name) || short(c.addr), hop: i + 1, data: c }); n.y = -110 * (i + 1); n.x = (i % 2 ? 40 : -40); edges.push({ a: n, b: prev, w: 2.2, kind: 'fund' }); prev = n; });
  const maxN = Math.max(1, ...T.counterparties.map(c => c.nIn + c.nOut));
  T.counterparties.slice(0, 30).forEach((c, i) => {
    if (at.has(c.addr)) return;
    const a = (i / Math.min(30, T.counterparties.length)) * Math.PI * 2, rr = 150 + (i % 3) * 40;
    const n = add(c.addr, { kind: c.kind || null, r: 4 + 7 * Math.sqrt((c.nIn + c.nOut) / maxN), label: nm(c), data: c, x: Math.cos(a) * rr, y: Math.sin(a) * rr * .8 + 40 });
    edges.push({ a: me, b: n, w: .6 + 2.4 * (c.nIn + c.nOut) / maxN, dirIn: c.nIn > 0, dirOut: c.nOut > 0, kind: c.both ? 'both' : 'one' });
  });
  G.nodes = nodes; G.edges = edges; G.cam = { x: 0, y: 30, z: 1 }; G.pulse = []; G.fitUntil = performance.now() + 2200;
  for (let k = 0; k < 220; k++) step(1);
}
function step(dt) {
  const N = G.nodes;
  for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
    const a = N[i], b = N[j]; let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + .01; const f = 1800 / d2, d = Math.sqrt(d2);
    dx /= d; dy /= d; if (!a.fixed) { a.vx -= dx * f; a.vy -= dy * f; } if (!b.fixed) { b.vx += dx * f; b.vy += dy * f; }
  }
  for (const e of G.edges) { const L0 = e.kind === 'fund' ? 105 : 150, dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || 1, f = (d - L0) * .012; if (!e.a.fixed) { e.a.vx += dx / d * f; e.a.vy += dy / d * f; } if (!e.b.fixed) { e.b.vx -= dx / d * f; e.b.vy -= dy / d * f; } }
  for (const n of N) { if (n.fixed || n === G.drag) continue; n.vx -= n.x * .0016; n.vy -= (n.y - (n.hop ? -110 * n.hop : 30)) * .0016; n.vx *= .82; n.vy *= .82; n.x += n.vx * dt; n.y += n.vy * dt; }
}
function draw() {
  const cv = $('#tr-cv'); if (!cv) return; const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, now = performance.now(); G.t = now;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  const base = Math.min(1.25, Math.max(.6, Math.min(r.width, r.height) / 620));
  // for the first moments after a trace the camera eases to fit the whole map, then it is yours to drag and zoom
  if (now < (G.fitUntil || 0) && G.nodes.length) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const n of G.nodes) { x0 = Math.min(x0, n.x - n.r); x1 = Math.max(x1, n.x + n.r); y0 = Math.min(y0, n.y - n.r - 8); y1 = Math.max(y1, n.y + n.r + 22); }
    const z = Math.min(1.4, Math.max(.35, Math.min(r.width / ((x1 - x0 + 90) * base), r.height / ((y1 - y0 + 110) * base))));
    G.cam.x += ((x0 + x1) / 2 - G.cam.x) * .18; G.cam.y += ((y0 + y1) / 2 - G.cam.y) * .18; G.cam.z += (z - G.cam.z) * .18;
  }
  const sc = dpr * G.cam.z * base;
  g.setTransform(sc, 0, 0, sc, W / 2 - G.cam.x * sc, H / 2 - G.cam.y * sc);
  // faint rings: hops of distance
  g.strokeStyle = 'rgba(238,235,228,.045)'; g.lineWidth = 1 / sc; for (const rr of [110, 220, 330]) { g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.stroke(); }
  const vis = n => Math.max(0, Math.min(1, (now - n.born) / 500));
  for (const e of G.edges) {
    const k = Math.min(vis(e.a), vis(e.b)); if (!k) continue;
    const hot = G.hover && (G.hover === e.a || G.hover === e.b);
    g.strokeStyle = e.kind === 'fund' ? `rgba(217,160,102,${.55 * k})` : hot ? `rgba(238,235,228,${.5 * k})` : `rgba(238,235,228,${(e.kind === 'both' ? .2 : .1) * k})`;
    g.lineWidth = e.w / (sc / dpr) * .6 + (hot ? .6 : 0); g.setLineDash(e.kind === 'fund' ? [] : e.kind === 'both' ? [] : [3, 4]);
    g.beginPath(); g.moveTo(e.a.x, e.a.y); g.lineTo(e.a.x + (e.b.x - e.a.x) * k, e.a.y + (e.b.y - e.a.y) * k); g.stroke(); g.setLineDash([]);
    // flow: little sparks travel the way the SOL went
    if (k === 1 && (e.kind === 'fund' || e.dirIn || e.dirOut)) {
      const sp = e.kind === 'fund' ? .00025 : .00012, ph = ((now * sp) + (e.a.x * .001 + e.b.y * .0013)) % 1;
      const from = e.kind === 'fund' ? e.a : e.dirOut && !e.dirIn ? e.a : e.b, to = from === e.a ? e.b : e.a;
      const px = from.x + (to.x - from.x) * ph, py = from.y + (to.y - from.y) * ph;
      g.fillStyle = e.kind === 'fund' ? 'rgba(217,160,102,.95)' : 'rgba(238,235,228,.7)'; g.beginPath(); g.arc(px, py, (e.kind === 'fund' ? 2.2 : 1.4) / (sc / dpr), 0, Math.PI * 2); g.fill();
    }
  }
  for (const n of G.nodes) {
    const k = vis(n); if (!k) continue; const col = KIND_COL[n.kind] || KIND_COL.null, R = n.r * (.6 + .4 * k) * (G.hover === n ? 1.25 : 1);
    if (n.kind === 'you' || n.kind === 'cex') { const gl = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, R * 3.2); gl.addColorStop(0, n.kind === 'you' ? 'rgba(217,160,102,.35)' : 'rgba(234,159,159,.3)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.beginPath(); g.arc(n.x, n.y, R * 3.2, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = k; g.fillStyle = '#060606'; g.beginPath(); g.arc(n.x, n.y, R + 2.5 / (sc / dpr), 0, Math.PI * 2); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(n.x, n.y, R, 0, Math.PI * 2); g.fill();
    if (n.kind === 'you') { g.fillStyle = '#060606'; g.beginPath(); g.ellipse(n.x - R * .38, n.y - R * .05, R * .26, R * .14, 0, 0, Math.PI * 2); g.ellipse(n.x + R * .38, n.y - R * .05, R * .26, R * .14, 0, 0, Math.PI * 2); g.fill(); }
    n._R = R; g.globalAlpha = 1;
  }
  // labels: the most telling first (you, the funding chain, exchanges, the busiest), and never one on top of another
  const fs = 11 / (sc / dpr), placed = [], pri = n => G.hover === n ? -1 : n.kind === 'you' ? 0 : n.hop ? 1 + n.hop / 10 : n.kind === 'cex' ? 2 : 3 - n.r / 100;
  const cand = G.nodes.filter(n => vis(n) > .4 && n.label && (n.kind === 'you' || n.kind === 'cex' || n.hop || G.hover === n || (n.kind && n.r > 8))).sort((a, b) => pri(a) - pri(b));
  g.textAlign = 'center';
  for (const n of cand) {
    g.font = `${n.kind === 'you' ? 600 : 500} ${fs}px JB, monospace`;
    const w = g.measureText(n.label).width, y = n.y + (n._R || n.r) + 14 / (sc / dpr), b = [n.x - w / 2 - fs * .4, y - fs * 1.05, n.x + w / 2 + fs * .4, y + fs * .35];
    if (G.hover !== n && placed.some(p => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1])) continue;
    placed.push(b); g.globalAlpha = vis(n);
    g.fillStyle = n.kind === 'you' ? '#eeebe4' : G.hover === n ? '#ffffff' : 'rgba(238,235,228,.75)'; g.fillText(n.label, n.x, y);
  }
  g.globalAlpha = 1;
}
function loop() { cancelAnimationFrame(G.raf); const f = () => { if (document.body.dataset.win !== 'trace' || document.hidden) { G.raf = 0; return; } step(.6); draw(); G.raf = requestAnimationFrame(f); }; G.raf = requestAnimationFrame(f); }
function pick(ev) {
  const cv = $('#tr-cv'), r = cv.getBoundingClientRect(), sc = G.cam.z * Math.min(1.25, Math.max(.6, Math.min(r.width, r.height) / 620));
  const x = (ev.clientX - r.left - r.width / 2) / sc + G.cam.x, y = (ev.clientY - r.top - r.height / 2) / sc + G.cam.y;
  let best = null, bd = 1e9; for (const n of G.nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < n.r + 10 && d < bd) { bd = d; best = n; } }
  return { n: best, x, y };
}
function wireCanvas() {
  const cv = $('#tr-cv'), tip = $('#tr-tip'); if (!cv || cv.dataset.w) return; cv.dataset.w = '1';
  let pan = null;
  cv.addEventListener('pointermove', ev => {
    if (pan) { G.cam.x = pan.cx - (ev.clientX - pan.x) / G.cam.z; G.cam.y = pan.cy - (ev.clientY - pan.y) / G.cam.z; return; }
    const { n } = pick(ev); G.hover = n; const box = cv.getBoundingClientRect();
    if (n) {
      const d = n.data || {}, lab = d.label;
      tip.innerHTML = n.kind === 'you' ? `<b>this wallet</b><br><span class="d">${esc(short(n.id))}</span>` : `<b>${esc(lab && lab.name || short(n.id))}</b>${lab && lab.category ? ` <span class="tag ${n.kind === 'cex' ? 'cex' : n.kind === 'defi' ? 'defi' : ''}">${esc(lab.category)}</span>` : ''}<br>`
        + (n.hop ? `<span class="d">funded hop ${n.hop}${d.amount != null ? ' · ' + solx(+d.amount) : ''}${d.date ? ' · ' + ago(d.date) + ' ago' : ''}</span>` : `<span class="d">${d.nOut || 0} out · ${d.nIn || 0} in${d.both ? ' · two-way' : ''}</span><br><span class="f">${esc(short(n.id))} · click to trace it</span>`);
      tip.style.left = Math.min(box.width - 290, ev.clientX - box.left + 14) + 'px'; tip.style.top = Math.max(8, ev.clientY - box.top - 10) + 'px'; tip.classList.add('on');
    } else tip.classList.remove('on');
    cv.style.cursor = n ? 'pointer' : 'grab';
  });
  cv.addEventListener('pointerleave', () => { G.hover = null; tip.classList.remove('on'); });
  cv.addEventListener('pointerdown', ev => { G.fitUntil = 0; const { n } = pick(ev); if (n) return; pan = { x: ev.clientX, y: ev.clientY, cx: G.cam.x, cy: G.cam.y }; cv.setPointerCapture(ev.pointerId); });
  cv.addEventListener('pointerup', ev => { if (pan) { const moved = Math.hypot(ev.clientX - pan.x, ev.clientY - pan.y) > 4; pan = null; if (moved) return; } const { n } = pick(ev); if (n && n.kind !== 'you') runTrace(n.id); });
  cv.addEventListener('wheel', ev => { ev.preventDefault(); G.fitUntil = 0; G.cam.z = Math.min(2.6, Math.max(.45, G.cam.z * (ev.deltaY < 0 ? 1.1 : .9))); }, { passive: false });
}

// ---------------------------------------------------------------- the report
const LAST = { t: null };
function emptyState(msg) {
  const e = $('#tr-empty'); e.hidden = false;
  e.innerHTML = `<div class="in"><img src="/assets/mask.svg" alt=""><h3>who can see you?</h3><p>${msg || 'paste any wallet, or trace your own. st3alth follows the money back to its source, labels the exchanges and protocols on the way, and scores how easily a stranger could put a name to it.'}</p><div class="row" style="justify-content:center"><button type="button" class="btn sm" data-run="trace">trace my wallet</button><button type="button" class="btn sm ghost" data-run="opsec">opsec checklist</button></div></div>`;
}
// wallets working against this one: look-alikes planted in its history, and dust
const mid = a => `${esc(a.slice(0, 4))}<u>${esc(a.slice(4, 8))}</u>…<u>${esc(a.slice(-8, -4))}</u>${esc(a.slice(-4))}`;
function threatsHtml(T) {
  const th = T.threats || []; if (!th.length) return '';
  return `<div class="rsec thr"><h5><span>who is working against it</span><span>${th.length}</span></h5>${th.map(x => x.kind === 'poison'
    ? `<div class="leak hi"><span class="ic2">!</span><div><b>address poisoning</b><p>a look-alike of a wallet it pays sent it ${x.n} tiny transfer${x.n === 1 ? '' : 's'}${x.last ? ', last ' + ago(x.last * 1000) + ' ago' : ''}, so the fake now sits in its history waiting to be copied by mistake. never copy an address from your history: check every character.</p><div class="lk"><span>real</span><code>${mid(x.real)}</code><span>fake</span><code class="bad">${mid(x.fake)}</code></div></div><em>trap</em></div>`
    : `<div class="leak mid"><span class="ic2">~</span><div><b>dust from ${x.from} stranger${x.from === 1 ? '' : 's'}</b><p>${x.n} tiny or empty transfer${x.n === 1 ? '' : 's'} it never asked for. dust is how trackers tag wallets and how spam tokens get in. do not interact with it.</p></div><em>${x.n}×</em></div>`).join('')}</div>`;
}
function renderReport(T) {
  $('#tr-empty').hidden = true;
  const col = GRADE_COL[T.grade] || '#eeebe4', d = new Date(), hrs = T.stats.hours, mx = Math.max(1, ...hrs);
  const chainHtml = [`<div class="hop you"><i></i><div><b>this wallet</b><small>${esc(short(T.addr))}${T.self && (T.self.domains || []).length ? ' · ' + esc(T.self.domains.join(', ')) : ''}</small></div><span class="tag you">you</span></div>`]
    .concat(T.chain.map((c, i) => `<div class="hop ${c.kind === 'cex' ? 'cex' : ''}"><i></i><div><span class="tok" data-run="trace ${esc(c.addr)}">${esc(c.label && c.label.name || short(c.addr))}</span>${c.guess ? ' <span class="f">(oldest seen)</span>' : ''}<small>funded hop ${i + 1}${c.amount != null ? ' · ' + solx(+c.amount) : ''}${c.date ? ' · ' + ago(c.date) + ' ago' : ''}</small></div>${c.kind === 'cex' ? '<span class="tag cex">exchange</span>' : c.label && c.label.category ? `<span class="tag">${esc(c.label.category)}</span>` : ''}</div>`)).join('');
  const cps = T.counterparties.slice(0, 14).map(c => `<div class="cp" data-run="trace ${esc(c.addr)}"><span class="a">${esc(c.label && c.label.name || short(c.addr))}${c.kind === 'cex' ? ' <span class="tag cex">exchange</span>' : c.kind === 'defi' ? ' <span class="tag defi">protocol</span>' : ''}${c.both ? ' <span class="tag">two-way</span>' : ''}</span><span class="n">${c.nOut}↑ ${c.nIn}↓</span><span class="n f">${ago(c.last * 1000)}</span></div>`).join('');
  $('#tr-rep').innerHTML = `<div class="score"><div class="gauge">${ring(T.score, 132, 9, col)}<div class="gv"><div><b data-n="${T.score}">0</b><span>exposure</span></div></div></div>
      <div><div class="grade ${GRADE_CLS[T.grade] || ''}">${esc(T.grade)}</div><div class="gsub">${T.score < 25 ? 'hard to put a name to. keep it that way.' : T.score < 50 ? 'a careful stranger could start to place you.' : T.score < 75 ? 'an analyst could follow this to a name.' : 'this wallet is close to a name already.'}<br><span class="f">${T.stats.transfers} transfers read${T.more ? ' (the newest)' : ''} · ${T.stats.counterparties} counterparties</span></div></div></div>
    <div class="rsec"><h5><span>what gives you away</span><span>${T.leaks.reduce((a, l) => a + l.pts, 0)} pts</span></h5>${T.leaks.map(l => `<div class="leak ${l.sev}"><span class="ic2">${l.sev === 'hi' ? '!' : l.sev === 'mid' ? '~' : '·'}</span><div><b>${esc(l.title)}</b><p>${esc(l.detail)}</p></div><em>+${l.pts}</em></div>`).join('')}</div>
    ${threatsHtml(T)}
    <div class="rsec"><h5><span>where the money came from</span><span>${T.chain.length} hop${T.chain.length === 1 ? '' : 's'}</span></h5><div class="chainv">${chainHtml}</div></div>
    <div class="rsec"><h5><span>when it moves (utc)</span><span>${T.stats.first ? ago(T.stats.first * 1000) + ' → ' + ago(T.stats.last * 1000) : ''}</span></h5><div class="hrs">${hrs.map(v => `<i class="${v === mx ? 'pk' : ''}" style="height:${Math.max(4, v / mx * 100)}%"></i>`).join('')}</div><div class="hrsx"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div></div>
    <div class="rsec"><h5><span>who it talks to</span><span>out ↑ · in ↓</span></h5><div class="cps">${cps || '<span class="f">no transfers seen</span>'}</div></div>
    <div class="rsec"><h5><span>go darker</span><span></span></h5><div class="row"><button type="button" class="btn sm" data-run="burner new">fresh burner</button><button type="button" class="btn sm ghost" data-run="opsec">opsec checklist</button><button type="button" class="btn sm ghost" data-copy="${esc(T.addr)}">copy address</button></div></div>
    ${T.plan === 'basic' ? '<div class="tr-note">labels and funders need a paid Helius plan on this server. this trace used transfers only, so exchanges show as plain addresses.</div>' : ''}
    <div class="tr-note">a score is a guide, not a verdict. it adds up what anyone can see on a public chain. nothing here is legal advice.</div>`;
  animRings($('#tr-rep')); const b = $('#tr-rep [data-n]'); if (b) countUp(b, T.score);
  $('#tr-legend').innerHTML = `<span><i style="background:${KIND_COL.you}"></i>this wallet</span><span><i style="background:${KIND_COL.cex}"></i>exchange</span><span><i style="background:${KIND_COL.defi}"></i>protocol</span><span><i style="background:${KIND_COL.null}"></i>unlabelled</span><span style="color:var(--amber)">── funding</span>`;
}
async function myAddr() { const s = SG.state(); return s.active || null; }
let busy = false;
export async function runTrace(addr, { quiet = false } = {}) {
  showTab('trace'); wireCanvas();
  if (!addr) addr = await myAddr();
  if (!addr) { emptyState('connect a wallet or make a burner to trace your own, or paste any address above.'); $('#tr-in').focus(); return null; }
  $('#tr-in').value = addr; if (busy) return null; busy = true;
  $('#tr-empty').hidden = true; G.nodes = []; G.edges = [];
  $('#tr-rep').innerHTML = `<div class="score"><div class="gauge">${ring(0)}<div class="gv"><div><b>…</b><span>reading</span></div></div></div><div><div class="grade">tracing</div><div class="gsub">following the money back through helius…</div></div></div>${'<div class="skel" style="width:90%"></div><div class="skel" style="width:70%"></div><div class="skel" style="width:80%"></div>'.repeat(3)}`;
  try {
    const T = await api('trace', { params: { addr } }); LAST.t = T;
    buildGraph(T); renderReport(T); loop();
    window.dispatchEvent(new CustomEvent('st3:traced', { detail: T }));
    if (!quiet) toast(`${T.grade} · ${T.score}/100`);
    return T;
  } catch (e) {
    $('#tr-rep').innerHTML = `<div class="tr-note">✗ ${esc(e.message)}</div>`; emptyState(esc(e.message)); return null;
  } finally { busy = false; }
}
$('#tr-form') && $('#tr-form').addEventListener('submit', e => { e.preventDefault(); const v = $('#tr-in').value.trim(); runTrace(v || null); });
window.addEventListener('st3:win', e => { if (e.detail === 'trace') { wireCanvas(); if (G.nodes.length) loop(); else if (!LAST.t) emptyState(); } });

// ---------------------------------------------------------------- your mask: the side column's first pane
const MINE = EXPO;
async function paintExpo() {
  const el = $('#expo'); if (!el) return; const s = SG.state();
  if (!s.active) { el.innerHTML = `<div class="ring">${ring(0, 54, 5, '#5a5751')}<b>?</b></div><div class="t">no signer yet.<small><span class="tok" data-run="trace">trace</span> any wallet · <span class="tok" data-run="burner new">burner</span> · <span class="tok" data-run="connect">connect</span></small></div>`; $('#p-exp-k').textContent = 'exposure'; return; }
  const a = s.active, T = MINE.get(a);
  if (!T) { el.innerHTML = `<div class="ring">${ring(0, 54, 5)}<b>…</b></div><div class="t">reading <span class="sens">${esc(short(a))}</span><small>tracing your own trail</small></div>`; return; }
  if (T.err) { el.innerHTML = `<div class="ring">${ring(0, 54, 5, '#5a5751')}<b>—</b></div><div class="t">trace is off right now<small>${esc(T.err)}</small></div>`; return; }
  el.innerHTML = `<div class="ring">${ring(T.score, 54, 5, GRADE_COL[T.grade])}<b>${T.score}</b></div><div class="t"><span class="tok" data-run="trace ${esc(a)}">${esc(T.grade)}</span> <span class="sens f">${esc(short(a))}</span><small>${esc(T.leaks[0] ? T.leaks[0].title : 'nothing obvious')}</small></div>`;
  animRings(el); $('#p-exp-k').textContent = s.use === 'burner' ? 'burner' : 'wallet';
}
async function refreshMine() {
  const s = SG.state(); paintExpo(); if (!s.active || MINE.has(s.active)) return;
  MINE.set(s.active, null); MINE.delete(s.active);
  try { const T = await api('trace', { params: { addr: s.active } }); MINE.set(s.active, T); } catch (e) { MINE.set(s.active, { err: e.status === 503 ? 'helius is not set up yet' : e.message }); }
  paintExpo();
}
SG.onSigner(() => refreshMine());
window.addEventListener('st3:traced', e => { const T = e.detail, s = SG.state(); if (s.active && T.addr === s.active) { MINE.set(s.active, T); paintExpo(); } });

// ---------------------------------------------------------------- masked mode and panic
export function setMasked(on) {
  document.body.classList.toggle('masked', on); try { localStorage.setItem('st3:masked', on ? '1' : '0'); } catch {}
  const b = $('#b-mask'); if (b) { b.classList.toggle('on', on); b.querySelector('span').textContent = on ? 'masked' : 'unmasked'; }
  const m = $('#st-mode'); if (m && !m.classList.contains('sig')) { m.textContent = on ? 'MASKED' : 'UNMASKED'; m.classList.toggle('exp', !on); }
}
try { setMasked(localStorage.getItem('st3:masked') !== '0'); } catch { setMasked(true); }
$('#b-mask') && $('#b-mask').addEventListener('click', () => setMasked(!document.body.classList.contains('masked')));
let cover = null;
function panic() {
  if (cover) return; cover = document.createElement('div');
  cover.style.cssText = 'position:fixed;inset:0;z-index:200;background:#050505;display:grid;place-items:center;color:#5a5751;font:12px JB,monospace;letter-spacing:.1em;cursor:pointer;animation:tabIn .15s ease both';
  cover.innerHTML = '<div style="text-align:center"><img src="/assets/mask.svg" style="width:90px;opacity:.35;margin:0 auto 16px"><div>nothing to see. press esc or click to come back.</div></div>';
  document.body.appendChild(cover); setMasked(true);
  const back = () => { cover && cover.remove(); cover = null; removeEventListener('keydown', k); }, k = e => { if (e.key === 'Escape') back(); };
  cover.addEventListener('click', back); addEventListener('keydown', k);
}
addEventListener('keydown', e => { if (e.key === 'Escape' && e.shiftKey) panic(); });

// ---------------------------------------------------------------- commands
def('trace', 'privacy', 'trace [address|name.sol]', 'who can see this wallet: its funding chain, the exchanges it touched, its habits and a score. no address traces your own', async a => { await runTrace(a[0] || null); }, ['expose', 'tr']);
def('exposure', 'privacy', 'exposure', 'your own score, in one line', async () => {
  const a = await myAddr(); if (!a) return line('<span class="m">no signer yet.</span> <span class="d">type</span> <span class="tok c" data-run="connect">connect</span> <span class="d">or</span> <span class="tok c" data-run="burner new">burner new</span>');
  const sp = spinner('tracing your own trail'); const T = await api('trace', { params: { addr: a } }); MINE.set(a, T); paintExpo();
  sp.done(`<span class="o">✓</span> ${dots('exposure', `<span class="c">${T.score}/100 · ${esc(T.grade)}</span>`)}`);
  T.leaks.slice(0, 4).forEach(l => line(`  <span class="${l.sev === 'hi' ? 'r' : l.sev === 'mid' ? 'w' : 'f'}">${l.sev === 'hi' ? '!' : l.sev === 'mid' ? '~' : '·'}</span> <span class="m">${esc(l.title)}</span> <span class="f">+${l.pts}</span>`));
  line('<span class="d">full picture:</span> <span class="tok c" data-run="trace">trace</span>');
}, ['score']);
def('funded', 'privacy', 'funded <address>', 'who funded this wallet, and who funded them, until an exchange shows up', async a => {
  const addr = a[0] || await myAddr(); if (!addr) throw new Error('Try: funded <address>');
  const sp = spinner('following the first SOL back'); const r = await api('funded', { params: { addr } }); sp.done(`<span class="o">✓</span> ${dots('funding chain', `<span class="c">${r.chain.length} hop${r.chain.length === 1 ? '' : 's'}</span>`)}`);
  line(`  <span class="c">${esc(short(addr))}</span> <span class="f">← this wallet</span>`);
  r.chain.forEach((c, i) => line(`  ${'  '.repeat(i)}<span class="f">└─</span> <span class="tok ${c.kind === 'cex' ? 'r' : 'c'}" data-run="trace ${esc(c.addr)}">${esc(c.label && c.label.name || short(c.addr))}</span> <span class="f">${c.amount != null ? solx(+c.amount) : ''}${c.date ? ' · ' + ago(c.date) + ' ago' : ''}${c.kind === 'cex' ? ' · exchange: a name is one subpoena away' : ''}</span>`));
  if (!r.chain.length) line('<span class="d">no funding transfer found (or this server is on the free helius plan).</span>');
}, ['source']);
def('who', 'privacy', 'who <address>', 'the public label Helius has for an address: exchange, protocol, known wallet, .sol names', async a => {
  const addr = a[0]; if (!addr) throw new Error('Try: who <address>');
  const r = await api('ident', { params: { addr } }), id = r.identity;
  if (!id) return line(`<span class="m">no public label for</span> <span class="c">${esc(short(addr))}</span><span class="d">. that is good news if it is yours.</span>`);
  line(`<span class="o">✓</span> ${dots('label', `<span class="c">${esc(id.name || '—')}</span> <span class="tag">${esc(id.category || id.type || '')}</span>`)}`);
  if ((id.domains || []).length) line(dots('names', `<span class="c">${esc(id.domains.join(', '))}</span>`));
}, ['ident', 'label']);
def('mask', 'privacy', 'mask [on|off]', 'masked mode: blur your own balances and addresses on screen until you hover them', a => {
  const on = a[0] === 'off' ? false : a[0] === 'on' ? true : !document.body.classList.contains('masked'); setMasked(on);
  line(`<span class="o">✓</span> ${dots('mask', `<span class="c">${on ? 'on · your numbers blur until you hover' : 'off · everything shows'}</span>`)}`);
}, ['unmask']);
def('panic', 'privacy', 'panic', 'hide the whole screen at once (shift+esc does the same)', () => panic(), ['hide']);
const OPSEC = [
  ['fund from somewhere new', 'a wallet funded straight from your exchange account is one subpoena from your name. fund burners from a wallet with no exchange in its first hops.'],
  ['one wallet, one job', 'trade, hold and receive with different wallets. two-way transfers between them are how clusters are drawn.'],
  ['never round-trip', 'sending back to the wallet that funded you links the two forever.'],
  ['mind the clock', 'trading every night at the same hours tells a stranger your time zone. trace shows your rhythm.'],
  ['no names on it', 'a .sol name, an ens or a public label on a wallet ties it to you for good.'],
  ['no standing permissions', 'a token approval lets someone move your tokens later, without asking. check with approvals, revoke what you do not use.'],
  ['clean photos', 'a photo can carry gps, the phone model and its serial. strip it before you post it.'],
  ['burners are for burning', 'sweep what is left and forget the key. st3alth keeps burners in this tab only.'],
  ['screens leak too', 'keep masked mode on while streaming. shift+esc hides everything at once.'],
];
def('opsec', 'privacy', 'opsec', 'seven habits that keep a wallet hard to place', () => {
  line('<span class="h">opsec</span> <span class="m">· what keeps a wallet hard to put a name to</span>');
  OPSEC.forEach(([t, d], i) => { line(`<span class="c">${String(i + 1).padStart(2, '0')}  ${esc(t)}</span>`); line(`    <span class="m">${esc(d)}</span>`); });
  line('<span class="d">check yourself:</span> <span class="tok c" data-run="trace">trace</span>');
}, ['tips']);
