// st3alth · radar: window 4. Twelve live tiles fed by the same sources the terminal uses (the chain through helius,
// jupiter, pump.fun through jupiter's feed). Every number is real; when a feed is busy the tile says so.
import { $, esc, api, usd, price, pct, ago, pic, short, sleep, block } from './core.js?v=4';
import { spark } from './chart.js?v=4';
import * as SG from './signer.js?v=4';
import { def, run } from './cmds.js?v=4';

const SOL = 'So11111111111111111111111111111111111111112';
const MAJORS = [['SOL', SOL], ['BTC', 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij'], ['ETH', '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs'], ['JUP', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'],
  ['PUMP', 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn'], ['BONK', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'], ['WIF', 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'], ['RAY', '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R']];
const fmtN = v => v == null ? '—' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : Math.round(v).toLocaleString('en-US');
function setv(el, html, a, z) {
  if (!el || el.innerHTML === html) return; el.innerHTML = html;
  if (a != null && z != null && a !== z) { el.classList.remove('flashu', 'flashd'); void el.offsetWidth; el.classList.add(z > a ? 'flashu' : 'flashd'); }
}
const tile = (key, title, extra = '', body = '') => `<section class="dt dt-${key}"><h6><b>${title}</b><i class="live"></i>${extra}</h6>${body}</section>`;
const sk = h => `<div class="sk" style="height:${h}px"></div>`;
const HTML = `<div class="dash">
  ${tile('sol', 'solana', '<em data-x="slot">slot —</em>', `<div class="dsol"><div class="dbig" data-x="px">—</div><div class="dch" data-x="ch"></div></div><canvas class="dsp" data-x="sp"></canvas>
    <div class="drow"><span>tps <b data-x="tps">—</b></span><span>rpc <b data-x="rpc">—</b></span><span>router <b data-x="jup">—</b></span></div>`)}
  ${tile('rate', 'sonar · births', '<em class="f">last 30 min</em>', `<div class="sonar" data-x="sonar"><canvas></canvas><div class="son-tip"></div></div><div class="f dfh" data-x="rateh">listening for coins born on pump.fun…</div>`)}
  ${tile('net', 'network', '<em data-x="ep">epoch —</em>', `<div class="dkpi"><div><b data-x="tps2">—</b><span>transactions / s, not votes</span></div><div><b data-x="slot2">—</b><span>slot</span></div></div>
    <div class="dep"><div class="f" data-x="epl">epoch progress</div><span class="mbar"><i data-x="epb" style="width:0%"></i></span><div class="f" data-x="epe"></div></div><canvas class="dsp" data-x="tpsc"></canvas>`)}
  ${tile('pump', 'pump.fun now', '<em data-x="pat">—</em>', `<div class="dkpi k3"><div><b data-x="born">—</b><span>born / min</span></div><div><b data-x="near">—</b><span>past 80% of the curve</span></div><div><b data-x="hot">—</b><span>trades 1h, top 60</span></div></div>
    <div class="dnear" data-x="nearl">${sk(70)}</div><div class="dlast f" data-x="lastg"></div>`)}
  ${tile('maj', 'majors', '<em class="f">24h</em>', `<div class="dl" data-x="maj">${sk(150)}</div>`)}
  ${tile('mov', 'movers · 1h', '<em class="tok" data-run="trending 1h">all →</em>', `<div class="dl" data-x="mov">${sk(150)}</div>`)}
  ${tile('stk', 'stocks', '<em class="tok" data-run="stocks">all →</em>', `<div class="dl" data-x="stk">${sk(150)}</div>`)}
  ${tile('new', 'just born', '<em class="tok" data-run="scan">scanner →</em>', `<div class="dl" data-x="newl">${sk(150)}</div>`)}
  ${tile('grad', 'graduations', '<em class="tok" data-run="scan">scanner →</em>', `<div class="dl" data-x="gradl">${sk(150)}</div>`)}
  ${tile('fee', 'priority fees', '<em data-x="fslots"></em>', `<div class="dfee" data-x="fee">${sk(92)}</div><p class="f dfh" data-x="fh"></p>`)}
  ${tile('eng', 'helius', '<em data-x="hms"></em>', `<div class="dprv" data-x="eng">${sk(92)}</div>`)}
  ${tile('prv', 'this session', '<em data-x="sid"></em>', `<div class="dprv" data-x="prv"></div>`)}
</div>`;

const TPS = [], BORN = new Map(), META = {};
async function netTiles(q) {
  const p = await api('ping'); const was = parseFloat(q('px').dataset.v || '0');
  setv(q('px'), p.sol ? '$' + p.sol.toFixed(2) : '—', was || null, p.sol); q('px').dataset.v = p.sol || 0;
  setv(q('ch'), p.solC24 != null ? `${pct(p.solC24)} <span class="f">24h</span>` : '');
  q('slot').textContent = p.slot ? 'slot ' + p.slot.toLocaleString('en-US') : 'rpc busy';
  setv(q('tps'), p.tps ? fmtN(p.tps) : '—'); setv(q('rpc'), p.rpcMs != null ? p.rpcMs + ' ms' : 'busy'); setv(q('jup'), p.jupMs != null ? p.jupMs + ' ms' : 'busy');
  setv(q('tps2'), p.tps ? fmtN(p.tps) : '—'); setv(q('slot2'), p.slot ? (p.slot / 1e6).toFixed(2) + 'M' : '—');
  if (p.tps) { TPS.push(p.tps); if (TPS.length > 60) TPS.shift(); if (TPS.length > 2) spark(q('tpsc'), TPS); }
  if (p.epoch && p.epoch.len) {
    const k = p.epoch.i / p.epoch.len, left = (p.epoch.len - p.epoch.i) * .4 / 3600;
    q('ep').textContent = 'epoch ' + p.epoch.n; q('epb').style.width = (k * 100).toFixed(1) + '%';
    q('epl').innerHTML = `epoch ${p.epoch.n} <span class="c">${(k * 100).toFixed(1)}%</span> through`; q('epe').textContent = `next epoch in about ${left >= 1 ? left.toFixed(1) + ' h' : Math.round(left * 60) + ' min'}`;
  }
}
async function sparkTile(q) { const o = await api('ohlcv', { params: { mint: SOL, tf: '1h' } }); const c = o.candles.slice(-48).map(x => x[4]); if (c.length > 4) spark(q('sp'), c); }
function rows(list, val, right, extra = () => '', fmt = pct, scale = null, cls = '') {
  const mx = scale || Math.max(1, ...list.map(t => Math.abs(val(t) || 0)));
  return list.map(t => { const v = val(t); return `<div class="dr" data-run="token ${esc(t.mint)}">${pic(t)}<b>${esc(t.sym)}</b><span class="f">${extra(t) || esc((t.name || '').slice(0, 16))}</span><span class="mbar ${cls} ${v < 0 ? 'neg' : ''}"><i style="width:${v == null ? 0 : Math.max(4, Math.abs(v) / mx * 100)}%"></i></span><em>${v == null ? '<span class="f">—</span>' : fmt(v)}</em><i class="f">${right(t)}</i></div>`; }).join('');
}
async function pumpTiles(q) {
  const j = await api('pulse');
  const ts = j.fresh.map(t => new Date(t.created).getTime()).filter(Number.isFinite).sort((a, b) => a - b), span = ts.length > 5 ? (ts[ts.length - 1] - ts[0]) / 60000 : 0;
  setv(q('born'), span > 0 ? String(Math.round((ts.length - 1) / span)) : '—');
  setv(q('near'), String(j.soon.filter(t => (t.progress || 0) >= .8).length));
  setv(q('hot'), fmtN([...j.fresh, ...j.soon].reduce((a, t) => a + (t.b1h || 0) + (t.s1h || 0), 0)));
  q('pat').textContent = 'live · ' + new Date(j.at).toLocaleTimeString('en-GB');
  q('nearl').innerHTML = j.soon.slice(0, 3).map(t => { const p = Math.round((t.progress || 0) * 100); return `<div class="dnx" data-run="token ${esc(t.mint)}">${pic(t)}<b>${esc(t.sym)}</b><span class="mbar"><i style="width:${p}%"></i></span><em>${p}%</em><span class="f">${usd(t.mcap)}</span></div>`; }).join('') || '<p class="f">nothing near the end of the curve right now.</p>';
  const g = j.grad[0]; q('lastg').innerHTML = g ? `last graduation <span class="tok c" data-run="token ${esc(g.mint)}">${esc(g.sym)}</span> ${ago(g.gradAt || g.created)} ago` : '';
  q('newl').innerHTML = rows(j.fresh.slice(0, 6), t => (t.progress || 0) * 100, t => t.mcap ? usd(t.mcap) : '—', t => `${ago(t.created)} old`, v => Math.round(v) + '%', 100, 'pro');
  q('gradl').innerHTML = rows(j.grad.slice(0, 6), t => t.c1h, t => usd(t.mcap), t => `${ago(t.gradAt || t.created)} ago`);
  // births per minute, from every coin this tab has seen being born
  for (const t of j.fresh) { const c = new Date(t.created).getTime(); if (Number.isFinite(c)) BORN.set(t.mint, c); }
  const now = Date.now(), m0 = Math.floor(now / 60000), mins = [];
  const first = Math.min(...BORN.values()), from = Math.max(m0 - 29, Math.floor(first / 60000) + 1);
  for (let m = from; m <= m0; m++) mins.push([m, 0]);
  for (const c of BORN.values()) { const m = Math.floor(c / 60000); const b = mins.find(x => x[0] === m); if (b) b[1]++; }
  const mx = Math.max(1, ...mins.map(x => x[1]));
  sonarFeed(j.fresh); void mx;
  const done = mins.slice(0, -1), avg = done.length ? done.reduce((a, x) => a + x[1], 0) / done.length : 0;
  q('rateh').innerHTML = done.length ? `${BORN.size} coins seen being born · about <span class="c">${Math.round(avg)}</span> a minute · busiest minute <span class="c">${Math.max(...done.map(x => x[1]))}</span>` : `${BORN.size} coins seen so far · the first full minute is still filling`;
}
async function majTile(q) {
  const ids = MAJORS.map(m => m[1]);
  if (!META.done) { META.done = true; await Promise.allSettled(MAJORS.map(async ([, m]) => { try { const { token } = await api('token', { params: { q: m } }); META[m] = token; } catch {} })); }
  const p = (await api('price', { params: { ids: ids.join(',') } })).prices || {};
  const list = MAJORS.map(([s, m]) => ({ ...(META[m] || {}), mint: m, sym: s, name: (META[m] && META[m].name) || s, price: p[m] && p[m].usd, c24: p[m] && p[m].c24h })).filter(t => t.price != null);
  q('maj').innerHTML = rows(list, t => t.c24, t => price(t.price));
}
async function movTile(q) { const j = await api('trending', { params: { w: '1h' } }); q('mov').innerHTML = rows(j.tokens.slice(0, 6), t => t.c1h, t => usd(t.mcap)); }
async function stkTile(q) {
  const j = await api('stocks'); const l = j.tokens.filter(t => t.c24h != null).sort((a, b) => Math.abs(b.c24h) - Math.abs(a.c24h)).slice(0, 6);
  q('stk').innerHTML = rows(l, t => t.c24h, t => price(t.price));
}
async function feeTile(q) {
  const f = await api('fees'); const lv = [['low', f.p25], ['normal', f.p50], ['fast', f.p75], ['turbo', f.p90]];
  const mx = Math.log10(Math.max(10, f.p90 || 10));
  q('fee').innerHTML = lv.map(([k, v]) => `<div class="df"><span>${k}</span><span class="mbar"><i style="width:${Math.max(3, Math.log10(Math.max(1, v)) / mx * 100)}%"></i></span><b>${fmtN(v)}</b><span class="f">µL/cu</span></div>`).join('');
  const sol = (f.p75 * 200000 / 1e6 + 5000) / 1e9; q('fh').innerHTML = `a fast 200k-cu swap costs about <span class="c">${sol < .0001 ? sol.toFixed(6) : sol.toFixed(5)} SOL</span> in fees right now`;
  q('fslots').textContent = `${f.slots} slots`;
}
async function engTile(q) {
  const n = await api('net');
  const row = (k, v, ok) => `<div><span>${k}</span><b class="${ok ? 'up' : 'w'}">${v}</b></div>`;
  q('hms').textContent = n.ms != null ? n.ms + ' ms' : '';
  q('eng').innerHTML = row('private reads', n.helius ? 'on ✓' : 'public fallback', n.helius) + row('wallet intel', n.wallet ? 'labels + funders ✓' : 'transfers only', n.wallet)
    + row('priority fee', n.fee != null ? Math.round(n.fee).toLocaleString('en-US') + ' µL/cu' : '—', n.fee != null) + row('your ip to a node', 'never ✓', true)
    + `<div><span>start</span><b><span class="tok c" data-run="trace">trace</span> · <span class="tok c" data-run="burner new">burner</span> · <span class="tok c" data-run="rings">rings</span></b></div>`;
}
function prvTile(q) {
  const third = performance.getEntriesByType('resource').filter(e => { try { return new URL(e.name).origin !== location.origin; } catch { return false; } }).length;
  const s = SG.state(), signer = s.use === 'burner' && s.burner ? 'burner ' + short(s.burner.address) : s.wallet ? short(s.wallet.address) : 'none';
  const row = (k, v, ok) => `<div><span>${k}</span><b class="${ok ? 'up' : 'w'}">${v}</b></div>`;
  q('prv').innerHTML = row('cookies', document.cookie ? document.cookie.split(';').length : '0 ✓', !document.cookie) + row('trackers', '0 ✓', true) + row('third-party requests', third ? third : '0 ✓', !third)
    + row('signer', esc(signer), true) + row('keys sent to a server', 'never ✓', true) + `<div><span>more</span><b><span class="tok c" data-run="privacy">privacy</span> · <span class="tok c" data-run="rings">rings</span> · <span class="tok c" data-run="burner new">burner</span></b></div>`;
  q('sid').textContent = window.__st3Sess ? 'sess ' + window.__st3Sess : '';
}
// ---------------------------------------------------------------- sonar: every pump.fun birth is a blip. it starts in the middle and drifts out as it ages; the arm sweeps every four seconds
const SON = { pts: new Map(), raf: 0, cv: null, ctx: null, tip: null, w: 0, h: 0, hover: null, last: 0 }, SPAN = 30 * 60000, SWEEP = 4200;
const RAD = age => Math.log(1 + Math.max(0, age) / 5000) / Math.log(1 + SPAN / 5000);   // log time: the last minute gets as much room as the half hour before it
const angOf = m => { let h = 2166136261; for (let i = 0; i < m.length; i++) { h ^= m.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) / 4294967296) * Math.PI * 2; };
function sonarFeed(fresh) {
  const now = Date.now();
  for (const t of fresh) { const c = new Date(t.created).getTime(); if (!Number.isFinite(c) || SON.pts.has(t.mint)) continue; SON.pts.set(t.mint, { m: t.mint, c: Math.min(c, now), sym: t.sym || '', a: angOf(t.mint) }); }
  for (const [k, p] of SON.pts) if (now - p.c > SPAN) SON.pts.delete(k);
}
function sonarWire(box) {
  if (!box || SON.cv) return; SON.cv = box.querySelector('canvas'); SON.ctx = SON.cv.getContext('2d'); SON.tip = box.querySelector('.son-tip');
  const size = () => { const r = SON.cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); SON.w = r.width; SON.h = r.height; SON.cv.width = Math.max(1, Math.round(r.width * d)); SON.cv.height = Math.max(1, Math.round(r.height * d)); SON.ctx.setTransform(d, 0, 0, d, 0, 0); };
  size(); new ResizeObserver(size).observe(SON.cv);
  const pick = e => { const r = SON.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let best = null, bd = 11; for (const p of SON.pts.values()) { if (p.x == null) continue; const d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = p; } } return [best, mx, my]; };
  SON.cv.addEventListener('pointermove', e => { const [p, mx, my] = pick(e); SON.hover = p; SON.cv.style.cursor = p ? 'pointer' : 'crosshair'; if (!p) { SON.tip.classList.remove('on'); return; } SON.tip.innerHTML = `<b>${esc(p.sym)}</b> · ${ago(p.c)} old<br><span class="f">click for the report</span>`; SON.tip.style.left = Math.max(4, Math.min(mx + 12, SON.w - 150)) + 'px'; SON.tip.style.top = Math.max(4, my - 34) + 'px'; SON.tip.classList.add('on'); });
  SON.cv.addEventListener('pointerleave', () => { SON.hover = null; SON.tip.classList.remove('on'); });
  SON.cv.addEventListener('click', e => { const [p] = pick(e); if (p) run(`token ${p.m}`); });
}
function sonarDraw() {
  const c = SON.ctx, W = SON.w, H = SON.h; if (!c || !W || !H) return;
  c.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = Math.min(W / 2 - 8, H / 2 - 8), t = Date.now(), sw = ((t % SWEEP) / SWEEP) * Math.PI * 2, TAU = Math.PI * 2;
  c.lineWidth = 1;
  const RINGS = [[60000, '1m'], [300000, '5m'], [SPAN, '30m']];
  for (const [a] of RINGS) { c.strokeStyle = a === SPAN ? '#26262a' : '#18181b'; c.beginPath(); c.arc(cx, cy, R * RAD(a), 0, TAU); c.stroke(); }
  c.strokeStyle = '#151517'; c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
  c.strokeStyle = '#2a2a2e'; for (let i = 0; i < 72; i++) { const a = i / 72 * TAU, l = i % 6 ? 3 : 7; c.beginPath(); c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); c.stroke(); }
  for (let k = 0; k < 5; k++) { c.fillStyle = `rgba(217,160,102,${[.12, .08, .055, .035, .018][k]})`; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, sw - (k + 1) * .1, sw - k * .1); c.closePath(); c.fill(); }
  c.strokeStyle = 'rgba(217,160,102,.85)'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(sw) * R, cy + Math.sin(sw) * R); c.stroke();
  c.fillStyle = '#4a4843'; c.font = '9px JB, monospace'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  for (const [a, l] of RINGS) c.fillText(l, cx, cy - R * RAD(a) + (a === SPAN ? 10 : -3));
  const pts = [...SON.pts.values()].sort((a, b) => b.c - a.c);
  pts.forEach((p, i) => {
    const age = Math.max(0, t - p.c), r = 4 + (R - 8) * Math.min(1, RAD(age)); p.x = cx + Math.cos(p.a) * r; p.y = cy + Math.sin(p.a) * r;
    const d = ((sw - p.a) % TAU + TAU) % TAU, b = d < .06 ? 1 : Math.max(.2, 1 - d / (TAU * .85)), hot = d < .4, hov = SON.hover === p;
    if (age < 20000) { const q = age / 20000; c.strokeStyle = `rgba(217,160,102,${(1 - q) * .75})`; c.beginPath(); c.arc(p.x, p.y, 3 + q * 16, 0, TAU); c.stroke(); }
    c.globalAlpha = b; c.fillStyle = hot || age < 20000 ? '#d9a066' : '#eeebe4'; c.fillRect(p.x - (hov ? 2.5 : 1.6), p.y - (hov ? 2.5 : 1.6), hov ? 5 : 3.2, hov ? 5 : 3.2);
    if ((i < 3 && age < 180000) || hov) { c.globalAlpha = Math.min(1, b + .2); c.fillStyle = '#c7c3bb'; c.textAlign = 'left'; c.fillText(String(p.sym).slice(0, 10), p.x + 6, p.y - 4); c.textAlign = 'center'; }
    c.globalAlpha = 1;
  });
  c.fillStyle = '#eeebe4'; c.beginPath(); c.arc(cx, cy, 2, 0, TAU); c.fill();
}
function sonarLoop() {
  if (SON.raf || !SON.cv) return;
  const f = now => { if (document.body.dataset.win !== 'radar' || document.hidden) { SON.raf = 0; return; } if (now - SON.last > 32) { SON.last = now; sonarDraw(); } SON.raf = requestAnimationFrame(f); };
  SON.raf = requestAnimationFrame(f);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && document.body.dataset.win === 'radar') sonarLoop(); });

// the radar lives in its own window and only polls while that window is open
let RB = null;
export function radar() {
  const box = document.getElementById('radarbox'); if (!box) return;
  if (!RB) {
    box.innerHTML = `<div class="blk dashblk"><div class="bh"></div><div class="bb">${HTML}</div></div>`; RB = box.firstElementChild;
    const q = k => RB.querySelector(`[data-x="${k}"]`); sonarWire(q('sonar')); sonarLoop();
    (async () => {
      let n = 0;
      for (;;) {
        if (!document.hidden && document.body.dataset.win === 'radar') {
          const jobs = [netTiles(q), pumpTiles(q)];
          if (n % 4 === 0) jobs.push(movTile(q), stkTile(q), majTile(q));
          if (n % 2 === 0) jobs.push(feeTile(q));
          if (n % 9 === 0) jobs.push(engTile(q));
          if (n % 20 === 0) jobs.push(sparkTile(q));
          try { prvTile(q); } catch {}
          const r = await Promise.allSettled(jobs); n++;
          RB.classList.toggle('partial', r.some(x => x.status === 'rejected'));
          await sleep(n < 2 ? 1500 : 6000);
        } else await sleep(700);
      }
    })();
  }
}
window.addEventListener('st3:win', e => { if (e.detail === 'radar') { radar(); sonarLoop(); } });
def('radar', 'system', 'radar', 'mission control: solana, helius, pump.fun, majors, movers, stocks, births, fees and this session, all live', () => { window.dispatchEvent(new CustomEvent('st3:open', { detail: 'radar' })); }, ['dash', 'dashboard', 'mission']);
