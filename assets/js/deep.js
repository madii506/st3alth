// st3alth · deep tools.
//   bundle  the 20 biggest holders of a coin and who funded each: wallets secretly run by one hand light up as clusters
//   file    the case file a stranger can build on any wallet in a second: names, funders, circle, holdings, sleep, a stamp
//   vanity  a burner whose address starts (or ends) with your letters, ground out in this tab and never sent anywhere
import { $, esc, api, short, ago, isAddr, line, block, spinner, dots, toast, b58, usd, sleep } from './core.js?v=9';
import { def, showTab, run } from './cmds.js?v=9';
import * as SG from './signer.js?v=9';
import { decode } from './fx.js?v=9';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const CL = ['#d9a066', '#ea9f9f', '#e7c58c', '#9fc1d6', '#c3a9da', '#a7d7b6', '#d6b49f', '#b9c79a'];
const GRADE = { clean: '#a7d7b6', 'some links': '#e7c58c', bundled: '#e9ad8a', 'heavily bundled': '#ea9f9f' };
const pc = v => v == null ? '—' : v >= 10 ? v.toFixed(1) + '%' : v >= 1 ? v.toFixed(2) + '%' : v.toFixed(3) + '%';
const dur = s => s == null ? null : s < 90 ? `${Math.round(s)} s` : s < 5400 ? `${Math.round(s / 60)} min` : s < 172800 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} days`;
const ringSvg = (v, col, size = 118, w = 8) => { const r = (size - w) / 2, c = 2 * Math.PI * r; return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#17171a" stroke-width="${w}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="butt" stroke-dasharray="${c * Math.min(100, v) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})" class="dp-arc"/></svg>`; };
function countUp(el, to, ms = 900, fmt = v => Math.round(v)) { if (!el) return; if (RM.matches) { el.textContent = fmt(to); return; } const t0 = performance.now(); const f = () => { const k = Math.min(1, (performance.now() - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }

// ================================================================ bundle
const BD = { nodes: [], edges: [], raf: 0, t0: 0, alpha: 1, hover: null, d: null, tok: null, cv: null, ctx: null, w: 0, h: 0, cam: { x: 0, y: 0, s: 1 }, busy: false };
function bdEmpty(msg, picks = []) {
  const e = $('#bd-empty'); e.hidden = false;
  e.innerHTML = `<div class="in"><svg class="bd-ico" viewBox="0 0 120 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="60" cy="40" r="9"/><circle cx="24" cy="18" r="5"/><circle cx="20" cy="56" r="4"/><circle cx="98" cy="22" r="6"/><circle cx="96" cy="60" r="3.5"/><circle cx="58" cy="72" r="3"/><path d="M28 21l24 14M24 53l28-9M92 25l-24 11M93 58l-25-14" opacity=".5"/><path d="M24 18L20 56" stroke-dasharray="2 3"/></g><rect x="9" y="33" width="5" height="5" fill="currentColor"/><path d="M14 36L24 18M14 36L20 56" stroke="currentColor" stroke-width="1.2"/></svg>
    <h3>who is really holding it?</h3><p>${msg || 'any coin: st3alth reads its twenty biggest holders, finds the wallet that sent each one its first SOL, and lights up the ones that came from the same hand.'}</p>
    ${picks.length ? `<div class="row" style="justify-content:center">${picks.map(t => `<button type="button" class="btn sm ghost" data-run="bundle ${esc(t.mint)}">${esc(t.sym)}</button>`).join('')}</div><p class="f" style="font-size:11px">just born on pump.fun</p>` : ''}</div>`;
}
async function bdPicks() { try { const j = await api('pulse'); return j.fresh.slice(0, 4); } catch { return []; } }
function bdBuild(d, tok) {
  const nodes = [], edges = [], by = new Map(), add = n => { by.set(n.id, n); nodes.push(n); return n; };
  const coin = add({ id: '#coin', kind: 'coin', r: 15, x: 0, y: 0, vx: 0, vy: 0, at: 0, label: tok.sym || 'coin', fixed: true });
  const cls = d.clusters.length, ang = c => (c + .5) / Math.max(1, cls) * Math.PI * 2 - Math.PI / 2;
  d.holders.forEach((h, i) => {
    const a = h.cluster >= 0 ? ang(h.cluster) + (Math.random() - .5) * .5 : Math.random() * Math.PI * 2, R = 120 + i * 6;
    add({ id: h.owner, kind: h.pool ? 'pool' : 'holder', h, i, cl: h.cluster, r: 3.6 + Math.sqrt(Math.max(.01, h.pct)) * 3.2, x: Math.cos(a) * R * .2, y: Math.sin(a) * R * .2, tx: Math.cos(a) * R, ty: Math.sin(a) * R, vx: 0, vy: 0, at: 160 + i * 55 });
  });
  const fc = new Map(); d.holders.forEach(h => { if (h.funder) fc.set(h.funder.addr, (fc.get(h.funder.addr) || 0) + 1); });
  d.holders.forEach(h => {
    if (!h.funder) return; const f = h.funder, k = f.addr; if (fc.get(k) < 2 && !by.has(k)) return;
    const hn = by.get(h.owner); let fn = by.get(k);
    if (!fn) fn = add({ id: k, kind: f.busy ? 'busy' : 'funder', cl: f.busy ? -1 : h.cluster, r: f.busy ? 4.5 : 5.5, x: hn.x * 1.4, y: hn.y * 1.4, vx: 0, vy: 0, at: hn.at + 120, label: f.label, n: fc.get(k) });
    edges.push({ a: fn, b: hn, kind: f.busy ? 'busy' : 'fund', cl: f.busy ? -1 : h.cluster });
  });
  d.links.forEach(([a, b]) => { const A = by.get(a), B = by.get(b); if (A && B) edges.push({ a: A, b: B, kind: 'direct', cl: A.cl }); });
  if (d.dev) {   // the wallet that created the coin: marked wherever it sits, and tied to every holder it funded
    let dn = by.get(d.dev.addr);
    if (!dn && d.dev.funded.length) { const h0 = by.get(d.dev.funded[0]); dn = add({ id: d.dev.addr, kind: 'funder', cl: h0 ? h0.cl : -1, r: 6, x: (h0 ? h0.x : 0) * 1.5, y: (h0 ? h0.y : 0) * 1.5, vx: 0, vy: 0, at: (h0 ? h0.at : 300) + 140, n: d.dev.funded.length }); d.dev.funded.forEach(o => { const h = by.get(o); if (h && !edges.some(e => e.a === dn && e.b === h)) edges.push({ a: dn, b: h, kind: 'fund', cl: h.cl }); }); }
    if (dn) dn.dev = true;
  }
  nodes.filter(n => n.kind === 'holder' || n.kind === 'pool').forEach(n => edges.push({ a: coin, b: n, kind: 'own', cl: -1 }));
  BD.nodes = nodes; BD.edges = edges; BD.alpha = 1; BD.t0 = performance.now(); BD.cam = { x: 0, y: 0, s: 1 };
}
function bdTick() {
  const N = BD.nodes, E = BD.edges, al = BD.alpha;
  for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
    const a = N[i], b = N[j]; let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
    const d = Math.sqrt(d2), min = a.r + b.r + 12, f = (900 / d2 + (d < min ? (min - d) * .5 : 0)) * al, fx = dx / d * f, fy = dy / d * f;
    if (!a.fixed) { a.vx -= fx; a.vy -= fy; } if (!b.fixed) { b.vx += fx; b.vy += fy; }
  }
  for (const e of E) {
    const rest = e.kind === 'own' ? 80 + (e.b.i || 0) * 4 : e.kind === 'fund' ? 26 + e.a.r + e.b.r : e.kind === 'direct' ? 26 : 52, k = e.kind === 'own' ? .012 : e.kind === 'busy' ? .03 : .06;
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || 1, f = (d - rest) * k * al, fx = dx / d * f, fy = dy / d * f;
    if (!e.a.fixed) { e.a.vx += fx; e.a.vy += fy; } if (!e.b.fixed) { e.b.vx -= fx; e.b.vy -= fy; }
  }
  for (const n of N) { if (n.fixed) continue; n.vx -= n.x * .0016 * al; n.vy -= n.y * .0052 * al; n.vx *= .82; n.vy *= .82; n.x += n.vx; n.y += n.vy; }
  BD.alpha = Math.max(.035, BD.alpha * .992);
}
function bdSize() { const cv = BD.cv, r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); BD.w = r.width; BD.h = r.height; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); BD.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
const colOf = n => n.kind === 'coin' ? '#eeebe4' : n.kind === 'pool' ? '#5a5751' : n.kind === 'busy' ? '#6d6a63' : n.cl >= 0 ? CL[n.cl % CL.length] : '#8a867e';
function bdDraw(now) {
  const c = BD.ctx, W = BD.w, H = BD.h, t = now - BD.t0; if (!c || !W) return;
  c.clearRect(0, 0, W, H);
  // fit the camera to the graph, smoothly
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const n of BD.nodes) { if (t < n.at) continue; x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); }
  if (x1 > x0) { const s = Math.min(1.6, Math.min((W - 70) / (x1 - x0), (H - 90) / (y1 - y0))), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; BD.cam.s += (s - BD.cam.s) * .08; BD.cam.x += (cx - BD.cam.x) * .08; BD.cam.y += (cy - BD.cam.y) * .08; }
  const S = BD.cam.s, ox = W / 2 - BD.cam.x * S, oy = H / 2 - 10 - BD.cam.y * S, P = n => [ox + n.x * S, oy + n.y * S];
  // rings behind everything, like a sonar of ownership
  c.strokeStyle = '#141416'; c.lineWidth = 1; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(ox, oy, 70 * k * S, 0, Math.PI * 2); c.stroke(); }
  for (const e of BD.edges) {
    const ta = Math.max(e.a.at, e.b.at), p = Math.min(1, Math.max(0, (t - ta) / 420)); if (p <= 0) continue;
    const [ax, ay] = P(e.a), [bx, by] = P(e.b), ex = ax + (bx - ax) * p, ey = ay + (by - ay) * p;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(ex, ey);
    if (e.kind === 'own') { c.strokeStyle = 'rgba(238,235,228,.06)'; c.lineWidth = 1; c.setLineDash([]); }
    else if (e.kind === 'busy') { c.strokeStyle = 'rgba(138,134,126,.35)'; c.lineWidth = 1; c.setLineDash([2, 4]); }
    else if (e.kind === 'direct') { c.strokeStyle = CL[(e.cl >= 0 ? e.cl : 0) % CL.length]; c.lineWidth = 1.6; c.setLineDash([]); }
    else { c.strokeStyle = e.cl >= 0 ? CL[e.cl % CL.length] + 'b0' : 'rgba(138,134,126,.5)'; c.lineWidth = 1.1; c.setLineDash([]); }
    c.stroke(); c.setLineDash([]);
  }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const n of BD.nodes) {
    if (t < n.at) continue; const k = Math.min(1, (t - n.at) / 300), [x, y] = P(n), r = n.r * S * (k < 1 ? .4 + .6 * k + Math.sin(k * Math.PI) * .25 : 1), col = colOf(n), hov = BD.hover === n;
    c.globalAlpha = Math.min(1, k * 1.4);
    if (n.kind === 'funder' || n.kind === 'busy') { c.fillStyle = col; c.fillRect(x - r, y - r, r * 2, r * 2); if (n.kind === 'funder') { c.strokeStyle = '#050505'; c.lineWidth = 1; c.strokeRect(x - r + 2, y - r + 2, r * 2 - 4, r * 2 - 4); } }
    else if (n.kind === 'pool') { c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.setLineDash([2, 3]); c.beginPath(); c.arc(x, y, r + 4, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
    else if (n.kind === 'coin') { c.fillStyle = '#eeebe4'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.fillStyle = '#050505'; c.font = `700 ${Math.max(9, 10 * S)}px JB, monospace`; c.fillText(String(n.label).slice(0, 6).toUpperCase(), x, y + .5); }
    else { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); if (n.h && n.h.fresh) { c.fillStyle = '#050505'; c.beginPath(); c.arc(x, y, Math.max(1.4, r * .32), 0, Math.PI * 2); c.fill(); } }
    if (hov) { c.strokeStyle = '#eeebe4'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r + 5, 0, Math.PI * 2); c.stroke(); }
    if (n.dev) { const q = .5 + .5 * Math.sin(now / 260); c.strokeStyle = '#ea9f9f'; c.lineWidth = 1.4; c.globalAlpha = Math.min(1, k * 1.4) * (.55 + .45 * q); c.beginPath(); c.arc(x, y, r + 6 + q * 2, 0, Math.PI * 2); c.stroke(); c.globalAlpha = Math.min(1, k * 1.4); c.fillStyle = '#ea9f9f'; c.font = '700 9px JB, monospace'; c.fillText('DEV', x, y - r - 12); }
    // a cluster member pings once when it lands
    if (n.cl >= 0 && n.kind === 'holder' && t - n.at < 1300 && t > n.at) { const q = (t - n.at) / 1300; c.strokeStyle = col; c.globalAlpha = (1 - q) * .7; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r + q * 22, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 1;
    if (n.kind === 'holder' && n.i < 3 && k >= 1) { c.fillStyle = '#8a867e'; c.font = '10px JB, monospace'; c.fillText(pc(n.h.pct), x, y + r + 11); }
  }
}
function bdLoop() {
  cancelAnimationFrame(BD.raf);
  const f = now => { if (document.body.dataset.win !== 'bundle' || document.hidden) { BD.raf = 0; return; } bdTick(); bdDraw(now); BD.raf = requestAnimationFrame(f); };
  BD.raf = requestAnimationFrame(f);
}
function bdWire() {
  if (BD.cv) return; BD.cv = $('#bd-cv'); BD.ctx = BD.cv.getContext('2d'); bdSize();
  new ResizeObserver(() => { bdSize(); }).observe(BD.cv);
  const tip = $('#bd-tip'), pick = e => { const r = BD.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, S = BD.cam.s, ox = BD.w / 2 - BD.cam.x * S, oy = BD.h / 2 - 10 - BD.cam.y * S; let best = null, bd = 1e9; for (const n of BD.nodes) { const d = Math.hypot(ox + n.x * S - mx, oy + n.y * S - my); if (d < n.r * S + 7 && d < bd) { bd = d; best = n; } } return [best, mx, my]; };
  BD.cv.addEventListener('pointermove', e => {
    const [n, mx, my] = pick(e); BD.hover = n; BD.cv.style.cursor = n && n.kind !== 'coin' ? 'pointer' : 'default';
    if (!n) { tip.classList.remove('on'); return; }
    let h = '';
    if (n.kind === 'coin') h = `<b>${esc(BD.tok.sym)}</b><br><span class="f">${esc(short(BD.tok.mint))}</span>`;
    else if (n.kind === 'pool') h = `<b>pool or curve</b> · ${pc(n.h.pct)}<br><span class="f">a program account, not a person</span>`;
    else if (n.kind === 'holder') { const H = n.h, f = H.funder; h = `<b>#${n.i + 1} · ${pc(H.pct)}</b>${H.cluster >= 0 ? ` · <span style="color:${CL[H.cluster % CL.length]}">cluster ${H.cluster + 1}</span>` : ''}<br>${esc(short(H.owner))}<br><span class="f">${f ? `funded by ${esc(f.label || short(f.addr))}${f.busy ? ' (exchange or bot)' : ''} · ${f.t ? ago(f.t * 1000) + ' ago' : ''}` : H.more ? 'old wallet: funder out of reach' : 'no funder seen'}${H.fresh ? ' · born under 3 days ago' : ''}</span>`; }
    else h = `<b>${n.dev ? 'the dev' : n.kind === 'busy' ? 'busy wallet' : 'funder'}</b> · behind ${n.n} holder${n.n === 1 ? '' : 's'}<br>${esc(n.label || short(n.id))}<br><span class="f">${n.dev ? 'it made the coin, and funded these wallets' : n.kind === 'busy' ? 'an exchange, a bot or a router: proves nothing' : 'one hand, many wallets'}</span>`;
    if (n.kind === 'holder' && n.dev) h = h.replace('</b>', '</b> · <span style="color:#ea9f9f">the dev</span>');
    tip.innerHTML = h + (n.kind !== 'coin' ? '<br><span class="f">click to trace</span>' : ''); tip.style.left = Math.min(mx + 14, BD.w - 230) + 'px'; tip.style.top = Math.max(8, my - 10) + 'px'; tip.classList.add('on');
  });
  BD.cv.addEventListener('pointerleave', () => { BD.hover = null; tip.classList.remove('on'); });
  BD.cv.addEventListener('click', e => { const [n] = pick(e); if (n && n.kind !== 'coin') run(`trace ${n.id}`); });
  $('#bd-form').addEventListener('submit', e => { e.preventDefault(); const v = $('#bd-in').value.trim(); if (v) run(`bundle ${v}`); });
}
function bdReport(d, tok) {
  const s = d.stats, col = GRADE[d.grade] || '#eeebe4';
  const dv = d.dev, devHtml = dv ? `<div class="bd-dev"><span class="bd-dk">dev</span><div><span class="tok" data-run="trace ${esc(dv.addr)}">${esc(short(dv.addr))}</span> · ${dv.holder ? `holds <b>${pc(dv.pct)}</b>` : 'not in the top 20'}${dv.funded.length ? ` · funded <b>${dv.funded.length}</b> top holder${dv.funded.length > 1 ? 's' : ''}` : ''}${dv.siblings.length ? ` · shares a funder with <b>${dv.siblings.length}</b>` : ''}${s.dev ? ` · <span style="color:#ea9f9f">${pc(s.dev)} with the dev</span>` : ''}${!dv.funded.length && !dv.siblings.length ? ' · <span class="f">no top holder came from its wallet</span>' : ''}</div></div>` : '';
  const cl = d.clusters.slice(0, 8).map((c, i) => `<div class="bd-cl" style="--c:${CL[i % CL.length]}"><i></i><div><b>cluster ${i + 1} · ${c.members.length} wallets · ${pc(c.pct)}${c.dev ? ' <span class="tag dv">the dev</span>' : ''}</b><p>${c.funders.length ? `funded by ${c.funders.slice(0, 2).map(f => `<span class="tok" data-run="trace ${esc(f)}">${esc(short(f))}</span>`).join(', ')}` : 'tied by direct transfers'}${c.spread != null ? ` · ${c.spread < 1 ? 'in the same second' : 'within ' + dur(c.spread)}` : ''}${c.direct && c.funders.length ? ' · and they pay each other' : ''}</p><div class="bd-mem">${c.members.slice(0, 8).map(m => `<span class="tok" data-run="trace ${esc(m)}">${esc(short(m))}</span>`).join('')}</div></div></div>`).join('');
  const rows = d.holders.map((h, i) => `<div class="bd-h${h.cluster >= 0 ? ' cl' : ''}" ${h.pool ? '' : `data-run="trace ${esc(h.owner)}"`} style="--c:${h.cluster >= 0 ? CL[h.cluster % CL.length] : h.pool ? '#5a5751' : '#8a867e'}"><em>${i + 1}</em><span class="a">${h.pool ? 'pool / curve' : esc(short(h.owner))}${h.fresh ? ' <span class="tag">new</span>' : ''}</span><span class="mbar"><i style="width:${Math.max(3, Math.min(100, h.pct / Math.max(1, d.holders[0].pct) * 100))}%"></i></span><b>${pc(h.pct)}</b><span class="f">${h.pool ? 'program' : h.funder ? (h.funder.busy ? 'exchange/bot' : esc(h.funder.label || short(h.funder.addr))) : h.more ? 'old wallet' : '—'}</span></div>`).join('');
  $('#bd-rep').innerHTML = `<div class="score"><div class="gauge">${ringSvg(s.clustered, col, 132, 9)}<div class="gv"><div><b data-n>0</b><span>% clustered</span></div></div></div>
      <div><div class="grade" style="color:${col}" data-dec>${esc(d.grade)}</div><div class="gsub">${d.clusters.length ? `${d.clusters.length} cluster${d.clusters.length === 1 ? '' : 's'} of wallets that came from the same hand.` : 'no two of the top holders share a private funder.'}<br><span class="f">${esc(tok.sym)} · top ${s.holders} holders read · ${ago(d.at)} ago</span></div></div></div>
    <div class="bd-kv"><div><span>top 10 (people)</span><b>${pc(s.top10)}</b></div><div><span>in clusters</span><b style="color:${col}">${pc(s.clustered)}</b></div><div><span>fresh wallets</span><b>${pc(s.fresh)}</b></div><div><span>pools / curve</span><b>${pc(s.pools)}</b></div><div><span>dev + crowd</span><b${s.dev ? ' style="color:#ea9f9f"' : ''}>${s.dev == null ? '—' : pc(s.dev)}</b></div><div><span>funder unknown</span><b>${s.unknown} of ${s.people}</b></div></div>
    ${devHtml}
    ${cl ? `<div class="rsec"><h5><span>clusters</span><span>one hand, many wallets</span></h5>${cl}</div>` : ''}
    <div class="rsec"><h5><span>top holders</span><span>funded by</span></h5><div class="bd-hs">${rows}</div></div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn sm" data-run="token ${esc(tok.mint)}">coin report</button><button type="button" class="btn sm ghost" data-run="chart ${esc(tok.mint)}">chart</button><button type="button" class="btn sm ghost" data-copy="${esc(tok.mint)}">copy mint</button></div>
    <div class="tr-note">funders come from each wallet's own transfers: the oldest SOL in that we can see. wallets with long histories show as old. a shared funder is a strong hint, not proof.</div>`;
  countUp($('#bd-rep [data-n]'), s.clustered, 1100, v => v.toFixed(v >= 10 ? 0 : 1)); decode($('#bd-rep [data-dec]'), 520);
  $('#bd-legend').innerHTML = `<span><i style="background:#eeebe4"></i>${esc(tok.sym)}</span><span><i style="background:${CL[0]}"></i>cluster</span><span><i style="background:#8a867e"></i>holder</span><span><i class="sq"></i>funder</span><span><i class="ring"></i>pool</span><span><i class="dot"></i>new wallet</span>${d.dev ? '<span style="color:#ea9f9f"><i class="ring" style="border-color:#ea9f9f"></i>dev</span>' : ''}`;
}
async function runBundle(q) {
  showTab('bundle'); bdWire();
  if (!q) { $('#bd-in').focus(); if (!BD.d) bdEmpty(null, await bdPicks()); return null; }
  if (BD.busy) return null; BD.busy = true; $('#bd-in').value = q;
  $('#bd-empty').hidden = true; BD.nodes = []; BD.edges = [];
  $('#bd-rep').innerHTML = `<div class="score"><div class="gauge">${ringSvg(0, '#333', 132, 9)}<div class="gv"><div><b>…</b><span>reading</span></div></div></div><div><div class="grade">following the money</div><div class="gsub">twenty holders, twenty funders…</div></div></div>${'<div class="skel" style="width:90%"></div><div class="skel" style="width:70%"></div><div class="skel" style="width:80%"></div>'.repeat(3)}`;
  try {
    const { token: tok } = await api('token', { params: { q } });
    const d = await api('bundle', { params: { mint: tok.mint } }); BD.d = d; BD.tok = tok; $('#bd-empty').hidden = true;
    bdBuild(d, tok); bdReport(d, tok); bdLoop();
    toast(`${tok.sym} · ${d.grade}`); return { d, tok };
  } catch (e) { $('#bd-rep').innerHTML = `<div class="tr-note">✗ ${esc(e.message)}</div>`; bdEmpty(esc(e.message), await bdPicks()); return null; }
  finally { BD.busy = false; }
}
window.addEventListener('st3:win', e => { if (e.detail === 'bundle') { bdWire(); if (BD.nodes.length) { BD.alpha = Math.max(BD.alpha, .2); bdLoop(); } else if (!BD.d && !BD.busy) bdPicks().then(p => { if (!BD.d && !BD.busy) bdEmpty(null, p); }); } });
def('bundle', 'market', 'bundle <token>', 'who funded the 20 biggest holders of a coin: wallets run by one hand light up as clusters', async a => {
  const q = a.join(' ').trim(); if (!q) { await runBundle(''); return; }
  const sp = spinner(`bundle check · ${esc(q)}`); const r = await runBundle(q);
  if (!r) { sp.done(`<span class="r">✗</span> ${dots('bundle', '<span class="d">no answer</span>')}`); return; }
  const { d, tok } = r, col = GRADE[d.grade] || '#eeebe4';
  sp.done(`<span class="o">✓</span> ${dots('bundle', `<span style="color:${col}">${esc(d.grade)}</span> <span class="d">· ${esc(tok.sym)} · ${pc(d.stats.clustered)} in ${d.clusters.length} cluster${d.clusters.length === 1 ? '' : 's'}</span>`)}`);
}, ['bubble', 'bundles', 'clusters', 'insiders']);

// ================================================================ file: the case file
const LAND = '0003e2b07fc0000003ffc7000fffb1fc7f800fc2ffffffffcfffffde3e301fffffffffff0fffff0c18003fffffffffff071ffe1e00001bfffffffc30000fffdf80033ffffffff8600003ffff8001fffffffffc000001ffff0001fffffffff8000001fffc0003ff3ffffff0000001fff0000707ffffffc0000001fff00003e0ffffff680000007fe00003f27fffff000000007f200007fffbffff800000001c00000fffffffff000000000ca0001fffff1ffc000000000780001fffde1c780000000000c0001ffff80c3880000000004e000ffff8080880000000001f8007fff8000000000000001fe0003ff0002700000000003ff0003fe0001700000000003ffc001fe000180e000000001ffe001fe0000407000000001ffc001fe0000010000000000ffc001fec0000760000000007fc001fc80000fe0000000007f8000fd80003ff0000000007e0000f800003ff8000000007c0000f000003ff8000000007c000060000018f800000000f80000000000003000000000e00000000000000020000000c00000000000000040000000c00000000000000000000000c0000000000000000000000000000000000000000';
function mapDraw(cv, R) {
  const W = 96, H = 36, bits = [...LAND].map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join(''), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const px = r.width / W, py = r.height / H, dot = Math.max(1, Math.min(px, py) * .3), lonOf = i => -180 + (i + .5) * 360 / W;
  const band = R && R.clear ? R.off * 15 : null, inBand = (i, w) => { if (band == null) return 0; let d = Math.abs(lonOf(i) - band); d = Math.min(d, 360 - d); return d <= w ? 1 - d / (w + 8) : 0; };
  const t0 = performance.now(), dur = RM.matches ? 0 : 1700, target = band == null ? null : (band + 180) / 360 * r.width;
  const frame = now => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3), sx = target == null ? -99 : e * target;
    c.clearRect(0, 0, r.width, r.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (bits[y * W + x] !== '1') continue; const cx = (x + .5) * px, cy = (y + .5) * py, b = inBand(x, 30) * (k >= 1 ? 1 : 0), near = Math.abs(cx - sx) < px * 2.5 && k < 1;
      c.fillStyle = b > 0 ? `rgba(217,160,102,${(.35 + .65 * b).toFixed(2)})` : near ? 'rgba(238,235,228,.85)' : 'rgba(238,235,228,.16)';
      c.fillRect(cx - dot, cy - dot, dot * 2, dot * 2);
    }
    if (target != null) { c.strokeStyle = k < 1 ? 'rgba(238,235,228,.5)' : 'rgba(217,160,102,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(Math.round(sx) + .5, 0); c.lineTo(Math.round(sx) + .5, r.height); c.stroke(); }
    if (k < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
const DAYS = ['sundays', 'mondays', 'tuesdays', 'wednesdays', 'thursdays', 'fridays', 'saturdays'];
const hh = h => String(((h % 24) + 24) % 24).padStart(2, '0') + ':00';
function rhythm(hours) {
  const tot = hours.reduce((a, b) => a + b, 0); if (tot < 20) return { tot, clear: false };
  const win = (n, f) => { let best = null; for (let i = 0; i < 24; i++) { let w = 0; for (let k = 0; k < n; k++) w += hours[(i + k) % 24]; if (!best || f(w, best.w)) best = { i, w }; } return best; };
  const awake = win(8, (a, b) => a > b), sleepW = win(6, (a, b) => a < b);
  const quiet = sleepW.w / tot, busy = awake.w / tot, clear = quiet < .07 && busy > .45;
  const mid = (sleepW.i + 3) % 24;                    // the middle of the quietest six hours, in utc
  let off = Math.round(4 - mid); if (off < -11) off += 24; if (off > 13) off -= 24;   // people are deepest asleep around 04:00 local
  const region = off <= -3 ? 'the americas' : off <= 3 ? 'europe or africa' : off <= 6 ? 'the middle east or south asia' : off <= 10 ? 'east asia or australia' : 'the pacific';
  return { tot, clear, awake, sleep: sleepW, quiet, busy, off, region, flat: busy < .42 };
}
function clockSvg(hours, R) {
  const mx = Math.max(1, ...hours), S = 212, c = S / 2, r0 = 40, r1 = 84; let g = '';
  if (R.clear) { const a0 = (R.sleep.i / 24) * 360 - 90, a1 = ((R.sleep.i + 6) / 24) * 360 - 90, p = (a, r) => [c + Math.cos(a * Math.PI / 180) * r, c + Math.sin(a * Math.PI / 180) * r]; const [x0, y0] = p(a0, r1 + 4), [x1, y1] = p(a1, r1 + 4), [x2, y2] = p(a1, r0 - 4), [x3, y3] = p(a0, r0 - 4); g += `<path d="M${x0} ${y0}A${r1 + 4} ${r1 + 4} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0 - 4} ${r0 - 4} 0 0 0 ${x3} ${y3}Z" class="cf-sl"/>`; }
  for (let k = 0; k < 4; k++) g += `<circle cx="${c}" cy="${c}" r="${r0 + (r1 - r0) * k / 3}" class="cf-cr"/>`;
  hours.forEach((v, i) => { const a = ((i + .5) / 24) * Math.PI * 2 - Math.PI / 2, L = r0 + (r1 - r0) * v / mx; g += `<line x1="${(c + Math.cos(a) * r0).toFixed(1)}" y1="${(c + Math.sin(a) * r0).toFixed(1)}" x2="${(c + Math.cos(a) * Math.max(r0 + 1.5, L)).toFixed(1)}" y2="${(c + Math.sin(a) * Math.max(r0 + 1.5, L)).toFixed(1)}" class="cf-b${v === mx ? ' pk' : ''}" pathLength="1" style="animation-delay:${(i * 35)}ms"/>`; });
  ['00', '06', '12', '18'].forEach((t, k) => { const a = k / 4 * Math.PI * 2 - Math.PI / 2; g += `<text x="${(c + Math.cos(a) * (r1 + 13)).toFixed(1)}" y="${(c + Math.sin(a) * (r1 + 13) + 3.2).toFixed(1)}" text-anchor="middle">${t}</text>`; });
  const now = new Date(), na = ((now.getUTCHours() + now.getUTCMinutes() / 60) / 24) * Math.PI * 2 - Math.PI / 2;
  g += `<line x1="${c}" y1="${c}" x2="${(c + Math.cos(na) * (r1 + 2)).toFixed(1)}" y2="${(c + Math.sin(na) * (r1 + 2)).toFixed(1)}" class="cf-now"/><circle cx="${c}" cy="${c}" r="2.5" class="cf-dot"/>`;
  return `<svg viewBox="0 0 ${S} ${S}" class="cf-clock" aria-hidden="true">${g}</svg>`;
}
let inFile = false;
async function runFile(addr) { inFile = true; try { return await openFile(addr); } finally { inFile = false; } }
async function openFile(addr) {
  showTab('file'); const box = $('#filebox');
  if (!addr) addr = SG.state().active;
  if (!addr) { box.innerHTML = `<div class="cf-empty"><div class="mkbig">${document.querySelector('.r-brand .mk').outerHTML}</div><h3>open a file</h3><p>any wallet or .sol name. this is what a stranger can put together about it in a second, from public data alone.</p><form id="cf-form" class="cf-f" autocomplete="off"><input id="cf-in" placeholder="wallet address or name.sol" spellcheck="false"><button class="btn sm" type="submit">open</button></form></div>`; $('#cf-form').addEventListener('submit', e => { e.preventDefault(); const v = $('#cf-in').value.trim(); if (v) run(`file ${v}`); }); $('#cf-in').focus(); return null; }
  const t0 = performance.now();
  box.innerHTML = `<div class="cf-load"><span class="cf-spin"></span>pulling the file on <b>${esc(short(addr))}</b>…</div>`;
  // the trace is the file; what they hold is a nice-to-have that can take long on busy wallets: wait 2.2 s at most, fill it in later
  const hp = api('holdings', { params: { owner: addr } }).catch(() => null);
  const [T, H0] = await Promise.all([api('trace', { params: { addr } }), Promise.race([hp, sleep(2200).then(() => undefined)])]);
  const late = H0 === undefined, H = H0 || null;
  const took = ((performance.now() - t0) / 1000).toFixed(1);
  const st = T.stats, R = rhythm(st.hours), id = T.self || {}, names = (id.domains || []).slice(0, 3);
  const root = T.chain.find(c => c.kind === 'cex'), rootAt = T.chain.indexOf(root);
  const byName = l => { const m = new Map(); for (const c of l) { const k = c.label && c.label.name || short(c.addr); m.set(k, (m.get(k) || 0) + (c.nOut || 0)); } return [...m.entries()]; };
  const cexOut = byName(T.counterparties.filter(c => c.kind === 'cex' && c.nOut > 0)), circle = T.counterparties.filter(c => c.both && c.kind !== 'cex' && c.kind !== 'defi').slice(0, 3);
  const proto = byName(T.counterparties.filter(c => c.kind === 'defi')).slice(0, 4);
  const holdsTxt = H => { if (!H) return '—'; const sol = H.sol || 0, solUsd = H.solUsd ? sol * H.solUsd : null, toks = (H.tokens || []).filter(x => x.usd > 1).sort((a, b) => b.usd - a.usd), total = (solUsd || 0) + toks.reduce((a, x) => a + x.usd, 0);
    return `${total ? usd(total) + ' · ' : ''}${sol.toFixed(sol < 1 ? 3 : 2)} SOL${toks.slice(0, 3).map(x => ` · ${esc(x.sym)} ${usd(x.usd)}`).join('')}${toks.length > 3 ? ` · +${toks.length - 3} more` : ''}`; };
  const holds = late ? '<span class="cf-wait">reading…</span>' : holdsTxt(H);
  const dayI = st.days && st.days.some(Boolean) ? st.days.indexOf(Math.max(...st.days)) : -1;
  const th = T.threats || [], poison = th.filter(x => x.kind === 'poison').length, dust = th.find(x => x.kind === 'dust');
  const caseNo = (addr.slice(2, 6) + '-' + addr.slice(-4)).toUpperCase(), stampCls = { ghost: 'g0', 'low profile': 'g1', traceable: 'g2', exposed: 'g3' }[T.grade] || 'g1';
  const lnk = a => `<span class="tok" data-run="file ${esc(a)}">${esc(short(a))}</span>`;
  const rows = [
    ['subject', `<code>${esc(T.addr)}</code>`],
    ['known as', names.length ? names.map(esc).join(' · ') : id.name ? esc(id.name) : '<span class="f">no names found</span>'],
    ['first seen', st.first ? `${ago(st.first * 1000)} ago${T.more ? ' <span class="f">(or earlier)</span>' : ''}` : '—'],
    ['last seen', st.last ? `${ago(st.last * 1000)} ago` : '—'],
    ['funded by', T.chain.length ? T.chain.map(c => c.label && c.label.name ? esc(c.label.name) : lnk(c.addr)).join(' <span class="f">←</span> ') : '<span class="f">no funder seen</span>'],
    ['root', root ? `${esc(root.label && root.label.name || 'an exchange')} <span class="f">· ${rootAt + 1} hop${rootAt ? 's' : ''} back · they know the account</span>` : '<span class="f">no exchange in the first hops</span>'],
    ['cashes out', cexOut.length ? cexOut.slice(0, 3).map(([k, n]) => `${esc(k)} <span class="f">×${n}</span>`).join(' · ') : '<span class="f">no exchange deposits seen</span>'],
    ['inner circle', circle.length ? circle.map(c => lnk(c.addr)).join(' · ') + ` <span class="f">· pays and hears from</span>` : '<span class="f">nobody both ways</span>'],
    ['uses', proto.length ? proto.map(([k]) => esc(k)).join(' · ') : '<span class="f">—</span>'],
    ['holds', holds],
    ['routine', R.clear ? `awake ${hh(R.awake.i)}–${hh(R.awake.i + 8)} utc · asleep ${hh(R.sleep.i)}–${hh(R.sleep.i + 6)} utc` : R.tot >= 20 && R.flat ? 'round the clock <span class="f">· a bot, or many hands</span>' : '<span class="f">not enough moves to read a rhythm</span>'],
    ['likely in', R.clear ? `${R.region} <span class="f">· utc${R.off >= 0 ? '+' : '−'}${Math.abs(R.off)} ± 2 · a guess from sleep</span>` : '<span class="f">—</span>'],
    ['busiest', dayI >= 0 ? DAYS[dayI] : '—'],
    ['threats', poison || dust ? `${poison ? `<span class="dn">${poison} poisoned look-alike${poison > 1 ? 's' : ''}</span>` : ''}${poison && dust ? ' · ' : ''}${dust ? `dust from ${dust.from} stranger${dust.from > 1 ? 's' : ''}` : ''}` : '<span class="f">none seen</span>'],
    ['exposure', `<b>${T.score}</b>/100 · ${esc(T.grade)}`],
  ];
  box.innerHTML = `<div class="cf">
    <div class="cf-top"><div class="cf-no">case <b>#${esc(caseNo)}</b></div><div class="cf-meta">opened ${new Date().toISOString().slice(11, 16)} utc · by nobody · from public data · ${took} s</div><div class="cf-stamp ${stampCls}">${esc(T.grade)}</div></div>
    <div class="cf-mid">
      <div class="cf-pic"><div class="cf-ph">${document.querySelector('.r-brand .mk').outerHTML}</div><span>no photo. yet.</span>${clockSvg(st.hours, R)}<span>when it moves · utc${R.clear ? ' · shaded: asleep' : ''}</span></div>
      <div class="cf-rows">${rows.map(([k, v], i) => `<div class="cf-r" style="--i:${i}"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    </div>
    <div class="cf-map"><canvas></canvas><div class="cf-ml"><span>${R.clear ? `likely here · utc${R.off >= 0 ? '+' : '−'}${Math.abs(R.off)} ± 2` : R.tot >= 20 && R.flat ? 'no sleep to read · it never stops' : 'not enough moves to place it'}</span><span class="f">${R.clear ? 'a guess from the hours it goes quiet' : ''}</span></div></div>
    <div class="cf-foot"><span class="f">${st.transfers} transfers and ${st.counterparties} counterparties read. anyone can open a file like this on any wallet.</span><div class="row"><button type="button" class="btn sm" data-run="trace ${esc(T.addr)}">trace graph</button><button type="button" class="btn sm ghost" data-run="burner new">go darker</button><button type="button" class="btn sm ghost" data-copy="${esc(T.addr)}">copy address</button></div></div>
  </div>`;
  // the reveal: each line is redacted, then the bar pulls away and the text decodes; the stamp lands last
  if (late) hp.then(h => { const b = [...box.querySelectorAll('.cf-r')].find(r => r.firstElementChild && r.firstElementChild.textContent === 'holds'); if (b && b.isConnected) b.lastElementChild.innerHTML = holdsTxt(h); });
  const rs = [...box.querySelectorAll('.cf-r')], quick = RM.matches;
  rs.forEach(r => r.classList.add('rd'));
  for (let i = 0; i < rs.length; i++) { await sleep(quick ? 0 : i < 2 ? 160 : 95); rs[i].classList.remove('rd'); rs[i].classList.add('op'); decode(rs[i].querySelector('b'), 360); }
  mapDraw(box.querySelector('.cf-map canvas'), R);
  await sleep(quick ? 0 : 260); const sp = box.querySelector('.cf-stamp'); sp.classList.add('hit'); setTimeout(() => box.querySelector('.cf').classList.add('shk'), quick ? 0 : 230);
  return T;
}
window.addEventListener('st3:win', e => { if (e.detail === 'file' && !inFile && !$('#filebox').children.length) runFile(null).catch(() => {}); });
def('file', 'privacy', 'file [address|name.sol]', 'the case file a stranger can build on a wallet: names, funders, circle, holdings, when it sleeps', async a => {
  const q = a.join(' ').trim(), sp = spinner(`opening the file${q ? ' on ' + esc(short(q)) : ''}`);
  try { const T = await runFile(q || null); if (!T) { sp.done('<span class="d">no wallet yet. paste one in the file window, connect, or make a burner.</span>'); return; } sp.done(`<span class="o">✓</span> ${dots('file', `<span class="c">#${esc((T.addr.slice(2, 6) + '-' + T.addr.slice(-4)).toUpperCase())}</span> <span class="d">· ${esc(T.grade)} · ${T.score}/100</span>`)}`); }
  catch (e) { sp.done(`<span class="r">✗</span> ${esc(e.message)}`); $('#filebox').innerHTML = `<div class="cf-empty"><p>✗ ${esc(e.message)}</p></div>`; }
}, ['dossier', 'case', 'profile']);

// ================================================================ vanity
const A58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function odds(pre, suf, ci) {
  const m = ch => ci ? [...A58].filter(x => x.toLowerCase() === ch.toLowerCase()) : [ch];
  let p = 1;
  if (pre) { // the first character of a 44-character address is one of 2…K; 43-character ones (about 5%) start anywhere
    const first = m(pre[0]).reduce((a, x) => { const i = A58.indexOf(x); return a + (i >= 1 && i <= 17 ? 1 / 18.07 + .055 / 57 : i === 18 ? .07 / 18.07 + .055 / 57 : .055 / 57); }, 0);
    p *= first; for (const ch of pre.slice(1)) p *= m(ch).length / 58;
  }
  for (const ch of suf) p *= m(ch).length / 58;
  return p;
}
const VA = { ws: [], on: false };
function stopVanity() { VA.ws.forEach(w => { try { w.postMessage({ stop: true }); w.terminate(); } catch {} }); VA.ws = []; VA.on = false; }
def('vanity', 'privacy', 'vanity <letters> [..end] [-i]', 'grind a burner whose address starts (or ends, with ..) with your letters. made in this tab, never sent anywhere', async (a0, raw) => {
  const a = String(raw || '').trim().split(/\s+/).slice(1); if (!a.length) a.push(...a0);
  if (a[0] === 'stop') { stopVanity(); line('<span class="d">vanity stopped.</span>'); return; }
  let ci = false, pre = '', suf = '';
  for (const x of a) { if (x === '-i' || x === '--any') ci = true; else if (x.startsWith('..')) suf = x.slice(2); else if (!pre) pre = x; }
  if (!pre && !suf) { line('<span class="d">try</span> <span class="c">vanity st3</span> <span class="d">· ends with:</span> <span class="c">vanity ..st3</span> <span class="d">· any case, faster:</span> <span class="c">vanity st3 -i</span>'); return; }
  const bad = [...pre + suf].filter(ch => ci ? ![...A58].some(x => x.toLowerCase() === ch.toLowerCase()) : !A58.includes(ch));
  if (bad.length) { line(`<span class="r">✗</span> addresses never contain <span class="c">${esc([...new Set(bad)].join(' '))}</span> <span class="d">(no 0, O, I or l in base58).${ci ? '' : ' try -i for any case.'}</span>`); return; }
  const p = odds(pre, suf, ci), tries = 1 / p;
  if (tries > 3e9) { line(`<span class="r">✗</span> that is about 1 in ${Math.round(tries).toLocaleString('en-US')}: days in a browser. try fewer letters${ci ? '' : ', or -i'}.`); return; }
  if (VA.on) stopVanity();
  const cores = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)), want = `${pre ? esc(pre) + '…' : '…'}${suf ? esc(suf) : ''}`;
  const b = block(`vanity · <span class="c">${want}</span>${ci ? ' <span class="d">any case</span>' : ''}`, `<div class="va"><div class="va-addr" data-a>${'·'.repeat(44)}</div>
    <div class="va-kv"><span>tried <b data-n>0</b></span><span><b data-r>—</b> keys/s</span><span>${cores} core${cores > 1 ? 's' : ''}</span><span>odds 1 in <b>${tries >= 1e6 ? (tries / 1e6).toFixed(1) + 'M' : Math.round(tries).toLocaleString('en-US')}</b></span><span data-eta></span></div>
    <span class="mbar va-bar"><i data-b style="width:0%"></i></span><div class="va-do row" data-do><button type="button" class="btn sm ghost" data-stop>stop</button></div></div>`);
  const $b = s => b.querySelector(s); let n = 0, rate = 0, last = performance.now(), lastN = 0, t0 = performance.now(), done = false;
  const hl = a => { const L = a.length, P = pre.length, S2 = suf.length; return `<i>${esc(a.slice(0, P))}</i>${esc(a.slice(P, L - S2))}<i>${esc(a.slice(L - S2))}</i>`; };
  $b('[data-stop]').onclick = () => { stopVanity(); if (!done) $b('[data-do]').innerHTML = '<span class="d">stopped.</span>'; };
  VA.on = true;
  for (let i = 0; i < cores; i++) {
    const w = new Worker(new URL('./vanity-w.js', import.meta.url)); VA.ws.push(w);
    w.onmessage = async e => {
      const m = e.data; if (done) return;
      if (m.n) { n += m.n; $b('[data-a]').textContent = m.sample; }
      const now = performance.now(); if (now - last > 500) { rate = (n - lastN) / ((now - last) / 1000); last = now; lastN = n; $b('[data-r]').textContent = Math.round(rate).toLocaleString('en-US'); const left = Math.max(0, (tries - n) / Math.max(1, rate)); $b('[data-eta]').textContent = n < tries ? `about ${left < 90 ? Math.round(left) + ' s' : left < 5400 ? Math.round(left / 60) + ' min' : (left / 3600).toFixed(1) + ' h'} to go · luck decides` : 'past the odds · luck decides'; }
      $b('[data-n]').textContent = n.toLocaleString('en-US'); $b('[data-b]').style.width = Math.min(100, n / tries * 100).toFixed(1) + '%';
      if (m.hit) {
        done = true; stopVanity();
        const kp = nacl.sign.keyPair.fromSeed(Uint8Array.from(m.seed)), addr = b58(kp.publicKey); if (addr !== m.hit) { $b('[data-do]').innerHTML = '<span class="r">✗ the key did not check out. run it again.</span>'; return; }
        const el = $b('[data-a]'); el.innerHTML = hl(addr); el.classList.add('hit'); decode(el, 600);
        const secs = ((performance.now() - t0) / 1000).toFixed(1); $b('[data-eta]').innerHTML = `<span class="o">found in ${secs} s</span>`; $b('[data-r]').textContent = Math.round(n / Math.max(.05, +secs)).toLocaleString('en-US'); $b('[data-n]').textContent = n.toLocaleString('en-US');
        const s = SG.state(), keepOld = s.burner && !s.burner.saved;
        $b('[data-do]').innerHTML = `<button type="button" class="btn sm" data-use>${s.burner ? 'replace burner' : 'use as burner'}</button><button type="button" class="btn sm ghost" data-save>save key file</button><button type="button" class="btn sm ghost" data-copy="${addr}">copy address</button>`;
        $b('[data-save]').onclick = () => { const blob = new Blob([JSON.stringify(Array.from(kp.secretKey))], { type: 'application/json' }); const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = `st3alth-vanity-${addr.slice(0, 6)}.json`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 3000); toast('key file saved'); };
        $b('[data-use]').onclick = () => { if (keepOld && SG.state().burner && !SG.state().burner.saved) { line(`<span class="w">!</span> your current burner <span class="c">${esc(short(s.burner.address))}</span> is not saved. save it first (<span class="c">burner save</span>) or drop it (<span class="c">burner forget</span>), then press use again.`); return; } SG.adoptBurner(kp); SG.use('burner'); line(`<span class="o">✓</span> ${dots('burner', `<span class="c">${esc(addr)}</span>`)}`); line('<span class="d">it lives in this tab. save the key file if you will fund it.</span>'); toast('vanity burner in use'); };
      }
    };
    w.postMessage({ pre, suf, ci });
  }
}, ['grind']);
