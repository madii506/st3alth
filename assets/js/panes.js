// st3alth · the live side: new coins, trending, stocks, the wallet pane, the top bar and the status line.
import { $, $$, api, esc, short, ago, usd, price, pct, amt, img, seen, pic, imgSet } from './core.js?v=6';
import * as SG from './signer.js?v=6';
import { watchlist } from './cmds.js?v=6';
let RUN = () => {}; export const setPaneRunner = f => { RUN = f; };
const vis = () => !document.hidden;
const prev = new Map();
// rows are kept by mint: a row that stays is only patched, so nothing blinks; only coins new to the list slide in
function rows(el, list, val) {
  const pl = el.querySelector('.pl'); if (!list.length) { if (!pl.querySelector('.pr')) pl.innerHTML = '<div class="pe">nothing yet</div>'; return; }
  pl.querySelectorAll('.sk,.pe').forEach(x => x.remove());
  const have = new Map([...pl.querySelectorAll('.pr[data-m]')].map(x => [x.dataset.m, x])), firstFill = !have.size, want = new Set(list.map(t => t.mint));
  for (const [m, x] of have) if (!want.has(m)) x.remove();
  let ref = pl.firstElementChild;
  for (const t of list) {
    seen(t); const v = val(t); let r = have.get(t.mint);
    if (!r) {
      const w = document.createElement('div');
      w.innerHTML = `<div class="pr in${firstFill ? '' : ' fresh'}" data-m="${esc(t.mint)}">${pic(t)}<div class="nm"><b>${esc(t.sym)}</b><span>${esc((t.name || '').slice(0, 18))}</span></div><div class="v">${v}</div></div>`;
      r = w.firstElementChild; const c = r; setTimeout(() => c.classList.remove('in', 'fresh'), 1700);
    } else { const vv = r.querySelector('.v'); if (vv && vv.innerHTML !== v) vv.innerHTML = v; imgSet(r.querySelector('img'), img(t.icon, t.mint)); }
    while (ref && ref !== r && !ref.matches('.pr[data-m]')) ref = ref.nextElementSibling;
    if (ref === r) ref = r.nextElementSibling; else pl.insertBefore(r, ref);
  }
}
const busy = (sel, msg) => { const pl = $(sel + ' .pl'); if (!pl.querySelector('.pr')) pl.innerHTML = `<div class="pe">${msg}</div>`; };
async function newPane() { try { const j = await api('recent'); rows($('#p-new'), j.tokens.slice(0, 24), t => `${usd(t.mcap)}<small>${ago(t.created)}</small>`); } catch { busy('#p-new', 'the feed is busy. retrying.'); } }
let TW = '1h';
async function tape() { try { const j = await api('trending', { params: { w: '1h' } }); const el = $('#tape-in'), h = j.tokens.slice(0, 24).map(t => `<span data-m="${esc(t.mint)}"><b>${esc(t.sym)}</b>${price(t.price)} ${pct(t.c1h)}</span>`).join(''); el.innerHTML = h + h.replace(/<span /g, '<span aria-hidden="true" '); } catch {} }   // two copies: the loop never shows a gap
async function trendPane() { try { const j = await api('trending', { params: { w: TW } }); rows($('#p-trend'), j.tokens.slice(0, 20), t => `${pct(t[TW === '24h' ? 'c24h' : 'c1h'])}<small>${usd(t.mcap)}</small>`); } catch { busy('#p-trend', 'trending is busy. retrying.'); } }
async function stockPane() {
  try { const j = await api('stocks'); const el = $('#p-stk'); rows(el, j.tokens.slice(0, 16), t => `${price(t.price)}<small>${pct(t.c24h)}</small>`);
    j.tokens.forEach(t => { const p = prev.get(t.mint); if (p != null && p !== t.price) { const r = el.querySelector(`.pr[data-m="${t.mint}"] .v`); if (r) { r.classList.remove('flashu', 'flashd'); void r.offsetWidth; r.classList.add(t.price > p ? 'flashu' : 'flashd'); } } prev.set(t.mint, t.price); });
  } catch { busy('#p-stk', 'stocks are busy. retrying.'); }
}
async function walletPane() {
  const s = SG.state(), el = $('#p-wal'), pl = el.querySelector('.pl'); $('#p-wal-k').textContent = s.active ? (s.use === 'burner' && s.burner ? 'burner' : s.wallet ? s.wallet.name || 'wallet' : '') : '';
  const w = watchlist();
  if (!s.active) {
    let html = '<div class="pe"><span class="tok c" data-run="connect">connect</span> a wallet, or make a <span class="tok c" data-run="burner new">burner</span> that lives in this tab.</div>';
    if (w.length) { try { const p = await api('price', { params: { ids: w.map(x => x.mint).join(',') } }); html += w.slice(0, 8).map(x => { const q = p.prices[x.mint] || {}; return `<div class="pr" data-m="${esc(x.mint)}"><img class="ic" src="/assets/favicon.svg" alt=""><div class="nm"><b>${esc(x.sym)}</b><span>watching</span></div><div class="v">${price(q.usd)}<small>${pct(q.c24h)}</small></div></div>`; }).join(''); } catch {} }
    pl.innerHTML = html; return;
  }
  try {
    const h = await api('holdings', { params: { owner: s.active } }), solUsd = h.solUsd ? h.sol * h.solUsd : null, total = (solUsd || 0) + h.tokens.reduce((a, t) => a + (t.usd || 0), 0);
    pl.innerHTML = `<div class="pr" data-run="wallet"><img class="ic" src="/assets/favicon.svg" alt=""><div class="nm"><b>${short(s.active)}</b><span>${usd(total, 2)}</span></div><div class="v">${amt(h.sol)} SOL<small>${usd(solUsd, 2)}</small></div></div>` +
      h.tokens.slice(0, 10).map(t => `<div class="pr" data-m="${esc(t.mint)}"><img class="ic" src="/assets/favicon.svg" alt=""><div class="nm"><b>${esc(t.sym || short(t.mint))}</b><span>${amt(t.ui)}</span></div><div class="v">${usd(t.usd, 2)}</div></div>`).join('');
    const btn = $('#b-wal'); if (s.use !== 'burner') btn.textContent = `${amt(h.sol)} SOL · ${short(s.active)}`;
  } catch { pl.innerHTML = '<div class="pe">balances are busy. retrying.</div>'; }
}
// the hud: rpc latency through helius, the slot, real tps, the SOL price; the tmux bar: router and helius
let SLOT = null;
async function topBar() {
  try {
    const p = await api('ping'); const st = $('#st-jup'); if (st) st.textContent = p.jupMs != null ? `router ${p.jupMs} ms` : 'router busy';
    const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
    set('hv-rpc', p.rpcMs != null ? p.rpcMs + ' ms' : '—'); set('hv-tps', p.tps != null ? Math.round(p.tps).toLocaleString('en-US') : '—'); set('hv-sol', p.sol ? '$' + p.sol.toFixed(2) : '—');
    if (p.slot) { SLOT = { s: p.slot, t: Date.now() }; } const d = $('#hv-dot'); if (d) { d.classList.toggle('on', !!p.slot); d.classList.toggle('bad', !p.slot); }
  } catch {}
}
async function heliusLine() { try { const n = await api('net'); $('#st-eng').textContent = n.helius ? `helius ${n.ms != null ? n.ms + ' ms' : 'on'}` : 'helius off · public rpc'; } catch { $('#st-eng').textContent = 'helius —'; } }
export async function engineLine() { return heliusLine(); }
export function startPanes() {
  const side = $('#side');
  $$('#side .pl').forEach(pl => { pl.innerHTML = Array.from({ length: 6 }, (_, i) => `<div class="sk" style="width:${60 + (i * 37) % 35}%"></div>`).join(''); });
  side.addEventListener('click', e => { const r = e.target.closest('[data-run]'); if (r) return RUN(r.dataset.run); const m = e.target.closest('[data-m]'); if (m) RUN('token ' + m.dataset.m); });
  $$('#p-trend .tfs button').forEach(b => b.onclick = () => { TW = b.dataset.w; $$('#p-trend .tfs button').forEach(x => x.classList.toggle('on', x === b)); trendPane(); });
  const wide = () => document.body.dataset.win === 'watch';   // the live columns live in the watch view now: read them only while it is open
  const loop = (f, ms, onlyWide = true) => { const go = () => { if (vis() && (!onlyWide || wide())) f(); }; go(); setInterval(go, ms); };
  loop(newPane, 4500); loop(trendPane, 30000); loop(stockPane, 45000); loop(walletPane, 15000); loop(topBar, 12000, false); loop(heliusLine, 30000, false);
  addEventListener('st3:win', e => { if (e.detail === 'watch') { newPane(); trendPane(); stockPane(); walletPane(); } });
  // the slot ticks forward between pings, about 2.5 a second
  setInterval(() => { if (SLOT) { const el = document.getElementById('hv-slot'); if (el) el.textContent = Math.floor(SLOT.s + (Date.now() - SLOT.t) / 400).toLocaleString('en-US'); } }, 400);

  window.addEventListener('st3:balances', () => { walletPane(); });
  window.addEventListener('st3:watch', () => walletPane());
  SG.onSigner(s => {
    const b = $('#b-wal'); b.classList.toggle('on', !!s.active);
    b.innerHTML = `<span class="${s.active ? 'sens' : ''}">${s.active ? (s.use === 'burner' && s.burner ? `burner · ${short(s.burner.address)}` : `${short(s.active)}`) : 'connect'}</span>`;
    $('#signer b').textContent = s.active ? (s.use === 'burner' && s.burner ? 'burner ' + short(s.burner.address) : 'wallet ' + short(s.active)) : 'none'; $('#signer b').classList.toggle('sens', !!s.active); $('#p-wal .pl').classList.toggle('sens', !!s.active); $('#p-wal-k').classList.toggle('sens', !!s.active);
    const m = $('#st-mode'); if (!m) {} else if (s.active) { m.textContent = s.use === 'burner' && s.burner ? 'BURNER' : 'SIGNED'; m.classList.add('sig'); m.classList.remove('exp'); } else { m.classList.remove('sig'); const on = document.body.classList.contains('masked'); m.textContent = on ? 'MASKED' : 'UNMASKED'; m.classList.toggle('exp', !on); }
    walletPane();
  });
  setInterval(() => { $('#b-clock').textContent = new Date().toLocaleTimeString('en-GB'); }, 1000);
}
