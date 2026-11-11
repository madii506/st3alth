// st3alth · the scanner: every pump.fun coin as it is born, as it climbs the curve, and as it graduates. Refreshes every
// few seconds while you watch; new coins slide in at the top, numbers that move flash.
import { $, esc, api, usd, pct, ago, amt, img, pic, imgSet } from './core.js?v=1';
let RUN = () => {}; export const setPulseRunner = f => { RUN = f; };
let timer = 0, on = false, first = true, LAST = null;
const ls = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let QB = ls('st3:qb', 0.1); const F = Object.assign({ x: false, dev: false, top: false, bnd: false }, ls('st3:pzf', {}));
const FILTERS = [['x', 'has socials', t => !!(t.twitter || t.website)], ['dev', 'no serial devs', t => !(t.devMints >= 20)], ['top', 'top10 < 30%', t => !(t.top10 > 30)], ['bnd', 'no bundles', t => !t.bundles]];
const pass = t => FILTERS.every(([k, , f]) => !F[k] || f(t));
const fmtQ = v => String(+(+v).toFixed(4));
const COLS = [['fresh', 'new', 'just launched'], ['soon', 'final stretch', 'about to graduate'], ['grad', 'graduated', 'on pumpswap now']];
const pc = v => Math.round(v) + '%';
// the small print every trencher checks first: top 10 share, how many coins this dev has made, bots, bundles, socials
function chips(t) {
  const c = [];
  if (t.top10 != null) c.push(`<i class="${t.top10 > 35 ? 'w' : ''}" title="top 10 holders own this share">top10 ${pc(t.top10)}</i>`);
  if (t.devMints != null && t.devMints > 1) c.push(`<i class="${t.devMints >= 20 ? 'w' : ''}" title="coins this dev has launched">dev ×${t.devMints}</i>`);
  if (t.bots != null && t.bots >= 1) c.push(`<i class="${t.bots > 20 ? 'w' : ''}" title="share held by bot wallets">bots ${pc(t.bots)}</i>`);
  if (t.bundles) c.push(`<i class="${t.bundles >= 5 ? 'w' : ''}" title="bundled buys at launch">bundles ${t.bundles}</i>`);
  if (t.traders) c.push(`<i title="wallets that traded in the last hour">${amt(t.traders)} traders</i>`);
  if (t.twitter) c.push(`<a href="${esc(t.twitter)}" target="_blank" rel="noopener noreferrer" title="x">x</a>`);
  if (t.website) c.push(`<a href="${esc(t.website)}" target="_blank" rel="noopener noreferrer" title="website">web</a>`);
  return c.join('');
}
const mc = t => t.mcap ? usd(t.mcap) : '—';
function card(t, col) {
  const p = t.progress == null ? null : Math.round(t.progress * 100);
  return `<div class="pz" data-m="${esc(t.mint)}">
    ${pic(t, '')}
    <div class="pz-b"><div class="pz-t"><b>${esc(t.sym)}</b><span>${esc((t.name || '').slice(0, 22))}</span><em data-k="age">${ago(t.created)}</em></div>
      <div class="pz-r"><span>mc <b data-k="mcap">${mc(t)}</b></span><span>h <b data-k="hold">${t.holders != null ? amt(t.holders) : '—'}</b></span><span>1h <b data-k="c1h">${pct(t.c1h)}</b></span><span>vol <b data-k="vol">${usd(t.v1h)}</b></span></div>
      <div class="pz-x" data-k="chips">${chips(t)}</div>
      ${col !== 'grad' ? `<div class="pz-p${p >= 90 ? ' hot' : ''}"><i style="width:${p == null ? 0 : p}%" data-k="pbar"></i></div><div class="pz-pl"><span data-k="pl">${p == null ? 'curve —' : p + '% of the curve'}</span><span>${t.b1h ? `<span class="up">${t.b1h}</span>/<span class="dn">${t.s1h}</span> trades 1h` : ''}</span></div>` : `<div class="pz-pl"><span class="o">graduated</span><span>${t.b1h ? `<span class="up">${t.b1h}</span>/<span class="dn">${t.s1h}</span> trades 1h` : ''}</span></div>`}
      <div class="pz-a"><button type="button" data-q="1">buy ${fmtQ(QB)}</button><button type="button" data-q="5">${fmtQ(QB * 5)}</button><button type="button" data-c="chart ${esc(t.mint)}">chart</button><button type="button" data-c="token ${esc(t.mint)}">report</button></div>
    </div></div>`;
}
function patch(el, t, col) {
  const set = (k, html) => { const n = el.querySelector(`[data-k="${k}"]`); if (n && n.innerHTML !== html) { const up = parseFloat(n.textContent.replace(/[^0-9.-]/g, '')), nw = parseFloat(String(html).replace(/<[^>]+>/g, '').replace(/[^0-9.-]/g, '')); n.innerHTML = html; n.classList.remove('flashu', 'flashd'); void n.offsetWidth; if (isFinite(up) && isFinite(nw) && up !== nw) n.classList.add(nw > up ? 'flashu' : 'flashd'); } };
  set('age', ago(t.created)); set('mcap', mc(t)); imgSet(el.querySelector('img'), img(t.icon, t.mint));
  const x = el.querySelector('[data-k="chips"]'), xh = chips(t); if (x && x.innerHTML !== xh) x.innerHTML = xh; set('hold', t.holders != null ? amt(t.holders) : '—'); set('c1h', pct(t.c1h)); set('vol', usd(t.v1h));
  if (col !== 'grad') { const p = t.progress == null ? null : Math.round(t.progress * 100), bar = el.querySelector('[data-k="pbar"]'); if (bar) { bar.style.width = (p || 0) + '%'; bar.parentNode.classList.toggle('hot', p >= 90); } set('pl', p == null ? 'curve —' : p + '% of the curve'); }
}
// every coin born while you watch stays on the new column (up to 150), not only jupiter's newest 30
const BORN = new Map(), EVER = new Set(), KEEP = 150; let T0 = 0, BATCH = new Set(), lastUpd = 0, updBusy = false;
const newest = () => [...BORN.values()].sort((a, b) => (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0));
// fold new numbers into a coin we already hold, never blanking a field the newer source left out
function fold(t, keepBirth) {
  const o = BORN.get(t.mint) || {}, n = { ...o };
  for (const [k, v] of Object.entries(t)) if (v != null && v !== '' && !(keepBirth && k === 'created' && o.created)) n[k] = v;
  BORN.set(t.mint, n);
}
function remember(j) {
  if (!T0) T0 = Date.now();
  BATCH = new Set((j.fresh || []).map(t => t.mint));
  for (const t of j.fresh || []) { fold(t); EVER.add(t.mint); }
  for (const t of j.grad || []) BORN.delete(t.mint);
  const all = newest(); for (const t of all.slice(KEEP)) BORN.delete(t.mint);
  return { ...j, fresh: all.slice(0, KEEP) };
}
// coins older than jupiter's newest-30 window keep live numbers: one batched lookup every 10 s
async function refreshOld() {
  if (updBusy || Date.now() - lastUpd < 10000) return;
  const ids = newest().map(t => t.mint).filter(m => !BATCH.has(m)).slice(0, 100); if (!ids.length) return;
  updBusy = true; lastUpd = Date.now();
  try {
    const j = await api('fresh', { params: { ids: ids.join(',') } });
    for (const t of j.tokens || []) { if (!BORN.has(t.mint)) continue; if (t.grad) BORN.delete(t.mint); else fold(t, true); }
    if (on && LAST) { LAST = { ...LAST, fresh: newest().slice(0, KEEP) }; render(LAST); }
  } catch {} finally { updBusy = false; }
}
async function tick() {
  if (!on) return;
  try {
    const j = remember(await api('pulse')); LAST = j; render(j); refreshOld();
  } catch (e) { $('#pz-at').textContent = 'the chain is busy · retrying'; }
  if (on) timer = setTimeout(tick, document.hidden ? 15000 : 3000);
}
function render(j0) {
  const j = { ...j0 }; for (const [k] of COLS) j[k] = (j0[k] || []).filter(pass);
  {
    for (const [k] of COLS) {
      const sec = $(`#pz-${k}`), list = $(`#pz-${k} .pz-l`), have = new Map([...list.querySelectorAll('.pz:not(.gone)')].map(e => [e.dataset.m, e]));
      $(`#pz-${k} .pz-n`).textContent = j[k].length;
      if (k === 'fresh') {
        const now = Date.now(), ts = (j0.fresh || []).map(t => Date.parse(t.created)).filter(Number.isFinite), last5 = ts.filter(x => now - x < 300000).length;
        const watched = Math.min(5, (now - T0) / 60000), sorted = ts.slice(0, 30).sort((a, b) => a - b), span = sorted.length > 5 ? (sorted[sorted.length - 1] - sorted[0]) / 60000 : 0;
        const rate = watched >= 4.5 ? last5 / 5 : span > 0 ? (sorted.length - 1) / span : 0, r = $('#pz-fresh .pz-rate');
        r.textContent = rate ? '≈' + Math.round(rate) + '/min' : ''; r.title = 'coins born per minute on pump.fun';
        const pn = $('#pz-fresh .pz-n'); pn.textContent = `${EVER.size} seen`; pn.title = 'coins born on pump.fun since you opened the scanner';
      }
      if (sec.matches(':hover') && have.size) { for (const t of j[k]) { const el = have.get(t.mint); if (el) patch(el, t, k); } sec.classList.add('held'); continue; }
      sec.classList.remove('held'); list.querySelectorAll('.sk,.pz-e').forEach(e => e.remove());
      if (!j[k].length) list.insertAdjacentHTML('beforeend', `<p class="pz-e">${(j0[k] || []).length ? 'nothing here passes your filters.' : 'quiet right now.'}</p>`);
      const keep = new Set(j[k].map(t => t.mint));
      for (const [m, e] of have) if (!keep.has(m)) { e.classList.add('gone'); setTimeout(() => e.remove(), 400); }
      // walk the list once: cards already in place are never moved (a moved node replays its entrance), fading ones are skipped
      let ref = list.firstElementChild;
      for (const t of j[k]) {
        let el = have.get(t.mint);
        if (!el) { const w = document.createElement('div'); w.innerHTML = card(t, k); el = w.firstElementChild; if (!first) { const c = el; c.classList.add('new'); setTimeout(() => c.classList.remove('new'), 900); } }
        else patch(el, t, k);
        while (ref && ref !== el && (ref.classList.contains('gone') || !ref.classList.contains('pz'))) ref = ref.nextElementSibling;
        if (ref === el) ref = el.nextElementSibling; else list.insertBefore(el, ref);
      }
    }
    first = false; $('#pz-at').textContent = 'live · ' + new Date(j.at).toLocaleTimeString('en-GB'); $('#pz-src').textContent = j.src === 'jupiter' ? 'pump.fun · live via jupiter' : 'pump.fun · curves read from the chain';
    const hid = COLS.reduce((a, [k]) => a + (j0[k] || []).length - j[k].length, 0); $('#pz-hid').textContent = hid ? `${hid} hidden by filters` : '';
  }
}
export function startPulse() {
  const box = $('#pulsebox');
  if (!box.dataset.built) {
    box.dataset.built = '1';
    box.innerHTML = `<div class="pz-h"><b>scanner</b><span id="pz-src">pump.fun · live</span><span class="pz-f">${FILTERS.map(([k, l]) => `<button type="button" data-f="${k}" class="${F[k] ? 'on' : ''}">${l}</button>`).join('')}<span id="pz-hid" class="f"></span></span><label class="pz-qb" title="quick buy size, in SOL">quick buy <input id="pz-qb" type="text" inputmode="decimal" value="${fmtQ(QB)}" maxlength="6" spellcheck="false"> SOL</label><em id="pz-at">connecting…</em></div><div class="pz-g">${COLS.map(([k, t, s]) => `<section id="pz-${k}" class="pz-c"><h5><b>${t}</b><span>${s}</span><u class="pz-rate"></u><s>paused</s><i class="pz-n">0</i></h5><div class="pz-l" data-lenis-prevent>${Array.from({ length: 5 }, () => '<div class="sk" style="height:78px;margin:8px"></div>').join('')}</div></section>`).join('')}</div>`;
    box.querySelector('.pz-f').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; e.stopPropagation(); F[b.dataset.f] = !F[b.dataset.f]; b.classList.toggle('on', F[b.dataset.f]); lsSet('st3:pzf', F); if (LAST) render(LAST); });
    const qb = box.querySelector('#pz-qb'); qb.addEventListener('click', e => e.stopPropagation());
    qb.addEventListener('input', () => { const v = parseFloat(qb.value); if (v > 0 && v <= 100) { QB = v; lsSet('st3:qb', QB); box.querySelectorAll('[data-q]').forEach(b => { b.textContent = (b.dataset.q === '1' ? 'buy ' : '') + fmtQ(QB * b.dataset.q); }); } });
    box.addEventListener('click', e => { if (e.target.closest('a,label')) return; const q = e.target.closest('[data-q]'); if (q) { e.stopPropagation(); RUN(`buy ${q.closest('.pz').dataset.m} ${fmtQ(QB * q.dataset.q)}`); return; } const c = e.target.closest('[data-c]'); if (c) { e.stopPropagation(); RUN(c.dataset.c); return; } const z = e.target.closest('.pz'); if (z) RUN('token ' + z.dataset.m); });
  }
  if (on) return; on = true; first = !box.querySelector('.pz'); if (first) box.querySelectorAll('.pz-l').forEach(l => { l.innerHTML = Array.from({ length: 5 }, () => '<div class="sk" style="height:78px;margin:8px"></div>').join(''); });
  tick();
}
export function stopPulse() { on = false; clearTimeout(timer); }
