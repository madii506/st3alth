// st3alth · the terminal: the intro hand-off, the boot, the prompt (history, ghost completion, token search), windows
// (alt+0..7), the palette (ctrl k), masked mode, sound. One prompt drives every window.
import { $, $$, esc, sleep, line, initOut, api, pushHist, history, clear, toast, SEEN, dots, follow, imgErr, psHtml, copy, CA } from './core.js?v=5';
import { CMDS, ALIAS, setRunner, showTab, chartHover, chartRedraw } from './cmds.js?v=5';
import { startPanes, setPaneRunner, engineLine } from './panes.js?v=5';
import * as SG from './signer.js?v=5';
import { counted, setExtraRunner, aliasOf, stopTop, cwd } from './extra.js?v=5';
import { radar } from './dash.js?v=5';
import { runTrace, setMasked } from './privacy.js?v=5';
import './tools.js';
import './check.js';
import './fx.js';
import './deep.js';
import { manual } from './man.js?v=5';

const dirOf = () => { const d = cwd(); return d === '/home/anon' ? '~' : d.replace('/home/anon', '~'); };
const P = () => `<span class="p">${psHtml(dirOf())}</span>`;
const ms = v => v < 1000 ? Math.round(v) + ' ms' : (v / 1000).toFixed(v < 10000 ? 2 : 1) + ' s';
const SESS = (() => { try { let s = sessionStorage.getItem('st3:sess'); if (!s) { const a = crypto.getRandomValues(new Uint8Array(4)); s = [...a].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); s = s.slice(0, 4) + '-' + s.slice(4); sessionStorage.setItem('st3:sess', s); } return s; } catch { return '????-????'; } })();
let busy = 0;

// ---------------------------------------------------------------- run a command line
export async function run(cmd, { echo = true } = {}) {
  cmd = String(cmd || '').trim(); if (!cmd) return;
  if (cmd === '!!' || /^!\d+$/.test(cmd)) { const h = history(); const pick = cmd === '!!' ? h[0] : h.slice(0, 30).reverse()[parseInt(cmd.slice(1)) - 1]; if (!pick) { line(`<span class="r">no such history entry</span>`); return; } cmd = pick; }
  if (/;|&&/.test(cmd) && !/^(echo|alias)\b/i.test(cmd)) { line(`${P()} <span class="c">${esc(cmd)}</span>`, 'cmdl'); pushHist(cmd); for (const part of cmd.split(/\s*(?:;|&&)\s*/).filter(Boolean)) await run(part, { echo: true }); return; }
  const el = echo ? line(`${P()} <span class="c">${esc(cmd)}</span>`, 'cmdl') : null, t0 = performance.now(); let ok = true;
  const meta = () => { if (el && !el.querySelector('.cmeta')) el.insertAdjacentHTML('beforeend', `<span class="cmeta ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${ms(performance.now() - t0)} · ${new Date().toLocaleTimeString('en-GB')}</span>`); };
  pushHist(cmd); hi = -1; counted(); stopTop();
  { const al = aliasOf(cmd.split(/\s+/)[0].toLowerCase()); if (al) cmd = al + cmd.slice(cmd.split(/\s+/)[0].length); }
  const parts = cmd.split(/\s+/), name0 = parts[0].toLowerCase(), name = ALIAS[name0] || name0, c = CMDS[name];
  const args = parts.slice(1).map(a => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) ? a : a.toLowerCase());
  if (!c) { ok = false; meta(); const near = Object.keys(CMDS).filter(k => k.startsWith(name0.slice(0, 2))).slice(0, 4); line(`<span class="r">not a command:</span> ${esc(name0)}${near.length ? ` <span class="d">· did you mean</span> ${near.map(k => `<span class="tok c" data-run="${k}">${k}</span>`).join(' ')}` : ' <span class="d">· type</span> <span class="tok c" data-run="help">help</span>'}`); return; }
  busy++; document.body.classList.add('busy');
  try { await c.run(args, cmd); }
  catch (e) { ok = false; line(`<span class="r">✗ ${esc(e.message || e)}</span>`); if (e.detail) line(`<span class="f">${esc(String(e.detail).slice(0, 220))}</span>`); }
  finally { busy--; if (!busy) document.body.classList.remove('busy'); meta(); }
}
// commands that open their own window stay there; everything else prints in the shell
const STAY = new Set(['checkup', 'audit', 'check', 'trace', 'tr', 'expose', 'scan', 'chart', 'c', 'radar', 'dash', 'dashboard', 'mission', 'orders', 'docs', 'man', 'manual', 'intro', 'panic', 'hide', 'bundle', 'bubble', 'bundles', 'clusters', 'insiders', 'file', 'dossier', 'case', 'profile']);
const runFrom = c => { const w = String(c).trim().split(/\s+/)[0].toLowerCase(); if (!STAY.has(w)) showTab('out'); return run(c); };
setRunner(runFrom); setPaneRunner(runFrom); setExtraRunner(runFrom);
addEventListener('st3:open', e => showTab(e.detail));

// a picture that fails to load becomes the coin's own mark, never a broken icon
document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG') imgErr(t); }, true);
document.addEventListener('load', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.dataset.m && !t.src.startsWith('data:')) t.classList.remove('idt'); }, true);

// ---------------------------------------------------------------- the prompt: history, ghost completion, tab
const inp = $('#cmd'), ghost = $('#ghost'); let hi = -1;
const TOKEN_CMDS = new Set(['token', 'chart', 'price', 'buy', 'sell', 'holders', 'watch', 'unwatch', 'swap', 'search', 'info', 'c', 'p', 't', 'limit', 'dca']);
const names = () => [...Object.keys(CMDS), ...Object.keys(ALIAS)].sort((a, b) => a.length - b.length);
function suggest(v) {
  if (!v) return '';
  if (!/\s/.test(v)) { const n = names().find(k => k.startsWith(v.toLowerCase()) && k !== v.toLowerCase()); return n ? n.slice(v.length) : ''; }
  const parts = v.split(/\s+/), c = ALIAS[parts[0].toLowerCase()] || parts[0].toLowerCase(), last = parts[parts.length - 1].toLowerCase().replace('$', '');
  if (c === 'burner' && parts.length === 2 && last) { const s = ['new', 'save', 'load', 'use', 'fund', 'sweep', 'forget'].find(x => x.startsWith(last)); return s ? s.slice(last.length) : ''; }
  if (c === 'mask' && parts.length === 2 && last) { const s = ['on', 'off'].find(x => x.startsWith(last)); return s ? s.slice(last.length) : ''; }
  if (c === 'trending' && parts.length === 2 && last) { const s = ['5m', '1h', '6h', '24h'].find(x => x.startsWith(last)); return s ? s.slice(last.length) : ''; }
  if (TOKEN_CMDS.has(c) && last && last.length >= 1 && !/^\d/.test(last)) { const k = ['sol', 'usdc', 'usdt', ...SEEN.keys()].find(x => x.startsWith(last) && x !== last); return k ? k.slice(last.length) : ''; }
  return '';
}
const paintGhost = () => { const v = inp.value, s = suggest(v); ghost.textContent = s ? v + s : ''; ghost.dataset.s = s; caret(); };
// a block caret that glides to wherever the text cursor is
const inw = inp.parentElement, car = document.createElement('i'), mir = document.createElement('span'); car.className = 'caret'; mir.className = 'mirror'; inw.append(car, mir);
function caret() { mir.textContent = inp.value.slice(0, inp.selectionStart ?? inp.value.length).replace(/ /g, ' '); car.style.left = Math.min(mir.offsetWidth, inp.clientWidth - 8) + 'px'; }
for (const ev of ['keyup', 'click', 'select', 'focus']) inp.addEventListener(ev, caret);
inp.addEventListener('focus', () => $('#tin').classList.add('focus')); inp.addEventListener('blur', () => { $('#tin').classList.remove('focus'); setTimeout(hideSug, 150); });
// token suggestions as you type a token: live search, arrow keys to pick, tab or enter to take it
const sug = document.createElement('div'); sug.className = 'sug'; sug.hidden = true; $('#tin').appendChild(sug);
let sugList = [], sugSel = 0, sugT = 0, sugQ = '';
function hideSug() { sug.hidden = true; sugList = []; }
function sugWord() { const v = inp.value; if (!/\s/.test(v)) return null; const parts = v.split(/\s+/), c = ALIAS[parts[0].toLowerCase()] || parts[0].toLowerCase(), w = parts[parts.length - 1]; if (!TOKEN_CMDS.has(c) || !w || w.length < 2 || /^[\d.%@]/.test(w) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w) || ['sol', 'usdc', 'usdt', 'to', 'for'].includes(w.toLowerCase())) return null; return w.replace('$', ''); }
function paintSug() { sug.innerHTML = `<span class="sh">tokens · ↑↓ pick · tab to take it</span>` + sugList.map((t, i) => `<div data-i="${i}" class="${i === sugSel ? 'on' : ''}"><img class="ic" src="${t.icon ? '/api/img?u=' + encodeURIComponent(t.icon) : '/assets/favicon.svg'}" alt=""><b>${esc(t.sym)} <span>${esc(t.name.slice(0, 26))}</span></b><em>${t.mcap ? '$' + Math.round(t.mcap).toLocaleString('en-US') : ''}</em></div>`).join(''); sug.hidden = !sugList.length; }
function takeSug(i) { const t = sugList[i]; if (!t) return false; inp.value = inp.value.replace(/\S+$/, t.mint) + ' '; SEEN.set(t.sym.toLowerCase(), t.mint); hideSug(); paintGhost(); inp.focus(); return true; }
sug.addEventListener('mousedown', e => { const d = e.target.closest('[data-i]'); if (d) { e.preventDefault(); takeSug(+d.dataset.i); } });
const hint = $('#hint');
function paintHint() {
  if (!hint) return; const v = inp.value.trim(), w = v.split(/\s+/)[0].toLowerCase(), c = CMDS[ALIAS[w] || w];
  hint.innerHTML = v && c ? `<span class="c">${esc(c.usage)}</span>${c.help ? ' <span class="f">· ' + esc(c.help) + '</span>' : ''}` : '';
}
inp.addEventListener('input', () => {
  paintGhost(); paintHint(); const w = sugWord(); clearTimeout(sugT); if (!w) return hideSug();
  sugT = setTimeout(async () => { sugQ = w; try { const j = await api('search', { params: { q: w } }); if (sugQ !== w || sugWord() !== w) return; sugList = j.tokens.slice(0, 6); sugSel = 0; paintSug(); } catch { hideSug(); } }, 220);
});
$('#tin').addEventListener('submit', e => { e.preventDefault(); const v = inp.value; inp.value = ''; paintGhost(); paintHint(); hideSug(); follow(); runFrom(v); });
inp.addEventListener('keydown', e => {
  const h = history();
  if (!sug.hidden && sugList.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sugSel = (sugSel + 1) % sugList.length; paintSug(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); sugSel = (sugSel - 1 + sugList.length) % sugList.length; paintSug(); return; }
    if (e.key === 'Tab') { e.preventDefault(); takeSug(sugSel); return; }
    if (e.key === 'Escape') { e.preventDefault(); hideSug(); return; }
  }
  if (e.key === 'Enter') hideSug();
  if (e.key === 'ArrowUp') { e.preventDefault(); if (hi < h.length - 1) inp.value = h[++hi]; paintGhost(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.max(-1, hi - 1); inp.value = hi < 0 ? '' : h[hi]; paintGhost(); }
  else if (e.key === 'Tab' || (e.key === 'ArrowRight' && inp.selectionStart === inp.value.length && ghost.dataset.s)) {
    e.preventDefault(); const s = ghost.dataset.s;
    if (s) { inp.value += s + (/\s/.test(inp.value) ? '' : ' '); paintGhost(); return; }
    const v = inp.value.toLowerCase(); if (!/\s/.test(v)) { const hit = names().filter(k => k.startsWith(v)); if (hit.length) { showTab('out'); line(`<span class="d">${hit.map(esc).join('   ')}</span>`); } }
  }
  else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); clear(); }
});
// keys: ctrl k palette, alt+digit windows, / to the prompt, esc closes the palette
const TABS = ['out', 'pulse', 'radar', 'trace', 'chart', 'orders', 'check', 'watch', 'man'];
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPal(); }
  else if (e.key === 'Escape' && !$('#pal').hidden) closePal();
  else if (e.altKey && /^Digit[0-8]$/.test(e.code)) { e.preventDefault(); openWin(TABS[+e.code.slice(5)]); }
  else if (e.altKey && e.code === 'Backquote') { e.preventDefault(); conMax(); }
  else if (e.key === '/' && (document.activeElement === document.body || !document.activeElement)) { e.preventDefault(); inp.focus({ preventScroll: true }); }
});
document.addEventListener('click', e => {
  const uf = e.target.closest('[data-unfold]'); if (uf) { const w = $('#out .bootlog'); if (w) { w.classList.toggle('shut'); uf.textContent = w.classList.contains('shut') ? 'log' : 'hide log'; } return; }
  const cp = e.target.closest('[data-copy]'); if (cp) { e.preventDefault(); copy(cp.dataset.copy); cp.classList.add('ok'); const u = cp.querySelector('u'); if (u) u.textContent = 'copied'; clearTimeout(cp._t); cp._t = setTimeout(() => { cp.classList.remove('ok'); if (u) u.textContent = 'copy'; }, 1500); return; }
  const r = e.target.closest('[data-run]'); if (r && !r.closest('#side')) { e.preventDefault(); runFrom(r.dataset.run); return; }
  const f = e.target.closest('[data-fill]'); if (f) { e.preventDefault(); showTab('out'); inp.value = f.dataset.fill; paintGhost(); inp.focus(); }
});
$('#console').addEventListener('click', e => { if (e.target.closest('.out') && !getSelection().toString() && !e.target.closest('a,button,input,textarea,label,.tok,[data-run]')) inp.focus({ preventScroll: true }); });

// chips: the ones with blanks fill the prompt, the rest run
const CHIPS = [['trace me', 'trace'], ['file on me', 'file'], ['bundle check', 'bundle'], ['vanity burner', '=vanity st3 -i'], ['checkup', 'checkup'], ['link two wallets', '=link '], ['fingerprint', 'fingerprint'], ['strip a photo', 'strip'], ['scanner', 'scan'], ['help', 'help']];
$('#chips').innerHTML = CHIPS.map(([l, c]) => `<button type="button" ${c.startsWith('=') ? `data-fill="${esc(c.slice(1))}"` : `data-run="${esc(c)}"`}>${esc(l)}</button>`).join('');

// views: the rail on the left (a tab bar on phones). the console stays docked under the stage, and can be resized or maximized.
function openWin(k) { if (k === 'out') { showTab('out'); inp.focus({ preventScroll: true }); return; } showTab(k); }
$$('#rail [data-tab]').forEach(b => b.onclick = () => openWin(b.dataset.tab));
const CON = { h: null };
try { const v = +localStorage.getItem('st3:con'); if (v > 120) CON.h = v; } catch {}
function setCon(px) { const H = $('#main').getBoundingClientRect().height; px = Math.max(110, Math.min(H - 150, px)); CON.h = px; document.documentElement.style.setProperty('--con', px + 'px'); try { localStorage.setItem('st3:con', String(Math.round(px))); } catch {} }
if (CON.h) document.documentElement.style.setProperty('--con', CON.h + 'px');
function conMax() { document.body.classList.toggle('conmax'); $('#con-max').textContent = document.body.classList.contains('conmax') ? '⤡' : '⤢'; const o = $('#out'); if (o) o.scrollTop = o.scrollHeight; window.dispatchEvent(new Event('resize')); }
$('#con-max').onclick = conMax;
{ const sp = $('#split'); let y0 = 0, h0 = 0;
  sp.addEventListener('pointerdown', e => { if (document.body.classList.contains('conmax')) return; y0 = e.clientY; h0 = $('#console').getBoundingClientRect().height; sp.setPointerCapture(e.pointerId); document.body.classList.add('dragging'); });
  sp.addEventListener('pointermove', e => { if (!document.body.classList.contains('dragging')) return; setCon(h0 + (y0 - e.clientY)); });
  const end = () => { if (!document.body.classList.contains('dragging')) return; document.body.classList.remove('dragging'); window.dispatchEvent(new Event('resize')); };
  sp.addEventListener('pointerup', end); sp.addEventListener('pointercancel', end); sp.addEventListener('dblclick', conMax); }
// on a phone the mask switch and the sound move up into the top bar, since the rail becomes a tab bar
function placeControls() { const sm = innerWidth <= 980, to = sm ? $('#hud .hud-r') : $('#rail .r-foot'); for (const id of ['b-snd', 'b-mask']) { const el = document.getElementById(id); if (el && el.parentElement !== to) to.prepend(el); } }
placeControls(); addEventListener('resize', placeControls);
addEventListener('st3:win', e => { if (e.detail === 'man') manual(); if (e.detail === 'radar') radar(); });
$('#chart').addEventListener('mousemove', chartHover); $('#chart').addEventListener('mouseleave', chartRedraw); addEventListener('resize', chartRedraw);

// ---------------------------------------------------------------- the palette (ctrl k): commands and windows
let palSel = 0, palList = [];
const WIN_ITEMS = [['console', 'out', 'alt 0 · the prompt and everything it prints'], ['scan', 'pulse', 'view 1 · every pump.fun coin as it is born'], ['radar', 'radar', 'view 2 · mission control: solana, pump.fun, majors, movers, stocks'], ['trace', 'trace', 'view 3 · who can see a wallet'], ['chart', 'chart', 'view 4 · candles and live trades'], ['orders', 'orders', 'view 5 · your limit orders and dca plans'], ['check', 'check', 'view 6 · a full privacy checkup'], ['watch', 'watch', 'view 7 · births, trending, stocks, your mask and wallet'], ['manual', 'man', 'view 8 · how everything works'], ['bundle', 'bundle', 'who funded the top holders of a coin'], ['file', 'file', 'the case file on a wallet']];
function openPal() { const p = $('#pal'); p.hidden = false; $('#pal-in').value = ''; paintPal(); setTimeout(() => $('#pal-in').focus(), 10); }
function closePal() { $('#pal').hidden = true; inp.focus({ preventScroll: true }); }
function paintPal() {
  const q = $('#pal-in').value.toLowerCase().trim();
  const wins = WIN_ITEMS.filter(([n, , h]) => !q || n.includes(q) || h.includes(q)).map(([n, k, h]) => ({ win: k, usage: '→ ' + n, help: h }));
  palList = [...wins, ...Object.values(CMDS).filter(c => c.help && (!q || c.name.includes(q) || c.help.toLowerCase().includes(q) || c.cat.includes(q)))];
  palSel = Math.min(palSel, Math.max(0, palList.length - 1));
  $('#pal-l').innerHTML = palList.map((c, i) => `<div data-i="${i}" class="${i === palSel ? 'on' : ''}"><b>${esc(c.usage)}</b><span>${esc(c.help)}</span></div>`).join('') || '<div><span>nothing matches</span></div>';
  const on = $('#pal-l .on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function pickPal(i) { const c = palList[i]; if (!c) return; closePal(); if (c.win) return openWin(c.win); if (/[<\[]/.test(c.usage)) { showTab('out'); inp.value = c.name + ' '; paintGhost(); inp.focus(); } else runFrom(c.name); }
$('#pal-in').addEventListener('input', () => { palSel = 0; paintPal(); });
$('#pal-in').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palList.length - 1, palSel + 1); paintPal(); } else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); paintPal(); } else if (e.key === 'Enter') { e.preventDefault(); pickPal(palSel); } });
$('#pal-l').addEventListener('click', e => { const d = e.target.closest('[data-i]'); if (d) pickPal(+d.dataset.i); });
$('#pal').addEventListener('click', e => { if (e.target.id === 'pal') closePal(); });
$('#b-k').onclick = openPal;
$('#b-wal').onclick = () => { const s = SG.state(); runFrom(s.active ? 'wallet' : 'connect'); };

// ---------------------------------------------------------------- sound: the room tone from the intro keeps playing, quietly
const SPK = on => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h3l5-4v14l-5-4H4z"/>${on ? '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>' : '<path d="M16 9l5 6M21 9l-5 6"/>'}</svg>`;
let soundOn = (() => { try { return localStorage.getItem('st3:mute') !== '1'; } catch { return true; } })(), SND = null;
async function sound() { if (!SND) { const m = await import('./sound.js?v=5'); SND = m.createSound(); } return SND; }
async function setSound(on) {
  soundOn = on; try { localStorage.setItem('st3:mute', on ? '0' : '1'); } catch {}
  $('#b-snd').innerHTML = SPK(on); if (window.__st3Sound) window.__st3Sound.setMuted(!on); const s = await sound();
  if (on) { s.start(); s.setMuted(false); if (!s.__pad) { s.pad(); s.__pad = true; } } else s.setMuted(true);
}
$('#b-snd').innerHTML = SPK(soundOn); $('#b-snd').onclick = () => setSound(!soundOn);
addEventListener('st3:sound', e => { const d = e.detail; setSound(d === 'on' ? true : d === 'off' ? false : !soundOn); line(`<span class="o">✓</span> sound ${soundOn ? 'on' : 'off'}`); });

// ---------------------------------------------------------------- boot
const MASK = () => document.querySelector('.r-brand .mk').outerHTML;
async function boot({ fromIntro = false } = {}) {
  // straight out of the intro the screen just comes up (you already opened your eyes); otherwise it opens like an eye
  const app = $('#app'); app.classList.remove('boot'); void app.offsetWidth; app.classList.add(fromIntro ? 'lit' : 'on');
  initOut(); window.__st3Sess = SESS; startPanes();
  showTab('pulse');   // home is the scanner
  if (CA) { const m = $('#hud-m'); m.insertAdjacentHTML('afterbegin', `<button type="button" class="ca" data-copy="${CA}" title="copy the contract address"><i>CA</i><code>${CA}</code><u>copy</u></button>`); }
  const t0 = performance.now(), ts = () => `<span class="f">[${((performance.now() - t0) / 1000).toFixed(3).padStart(7)}]</span>`;
  const L = (k, v) => line(`${ts()} ${dots(k, v, 26)}`, 'bt');
  line(`${ts()} <span class="m">st3alth 1.0 · solana mainnet · powered by helius</span>`, 'bt'); await sleep(60);
  L('putting on the mask', '<span class="c">ok</span>'); await sleep(40);
  L('session', `<span class="c">${SESS}</span> <span class="f">· forgotten when this tab closes</span>`); await sleep(40);
  const nCk = document.cookie ? document.cookie.split(';').length : 0, third = u => { try { return new URL(u, location.href).origin !== location.origin; } catch { return false; } };
  const nTp = performance.getEntriesByType('resource').filter(r => third(r.name)).length, nSc = [...document.scripts].filter(x => x.src && third(x.src)).length;
  L('cookies', `<span class="${nCk ? 'r' : 'c'}">${nCk}</span>`); await sleep(30); L('third-party requests', `<span class="${nTp ? 'r' : 'c'}">${nTp}</span>`); await sleep(30); L('third-party scripts', `<span class="${nSc ? 'r' : 'c'}">${nSc}</span>`); await sleep(30);
  const [pg, nt] = await Promise.allSettled([api('ping'), api('net')]);
  const p = pg.status === 'fulfilled' ? pg.value : null, N = nt.status === 'fulfilled' ? nt.value : null;
  L('private reads · helius', N ? (N.helius ? `<span class="c">on</span> <span class="f">· ${N.ms != null ? N.ms + ' ms' : 'ok'}</span>` : '<span class="w">no key yet</span> <span class="f">· public rpc fallback</span>') : '<span class="w">unreachable</span>');
  L('wallet intel · trace', N ? (N.wallet ? '<span class="c">labels + funders</span>' : '<span class="c">transfers</span> <span class="f">· labels need a paid plan</span>') : '<span class="w">—</span>');
  L('solana', p && p.slot ? `<span class="c">ok</span> <span class="f">· slot ${p.slot.toLocaleString('en-US')}</span>` : '<span class="w">busy</span>');
  L('router · every dex', p && p.jupMs != null ? `<span class="c">ok</span> <span class="f">· ${p.jupMs} ms</span>` : '<span class="w">busy</span>');
  engineLine();
  const ws = SG.WAL.wallets(); L('wallets in this browser', ws.length ? `<span class="c">${esc(ws.map(w => w.name).join(', '))}</span>` : '<span class="f">none found · a burner works too</span>');
  await sleep(140);
  const neo = document.createElement('div'); neo.className = 'neo st3neo';
  neo.innerHTML = `<div class="mkbig">${MASK()}</div><div class="kv"><div class="bigw">st3alth</div>
    <div><b>you</b><span class="c">nobody</span></div><div><b>trace</b><span class="c">who can see any wallet · funders, exchanges, habits</span></div><div><b>trade</b><span class="c">every solana dex · limit orders · dca</span></div><div><b>burners</b><span class="c">born in this tab, never on a server</span></div><div><b>reads</b><span class="c">through helius, never from your browser</span></div><div><b>keys</b><span class="c">yours alone · st3alth never sees one</span></div></div>`;
  $('#out').appendChild(neo);
  const hint = line('<span class="m">put on the mask.</span> <span class="d">type</span> <span class="tok c" data-run="help">help</span><span class="d">, press</span> <span class="c">ctrl k</span><span class="d">, or start with</span> <span class="tok c" data-run="trace">trace</span> <span class="f">·</span> <span class="tok c" data-run="scan">scan</span> <span class="f">·</span> <span class="tok c" data-run="radar">radar</span>');
  if (matchMedia('(pointer: fine)').matches) inp.focus({ preventScroll: true });
  const took = ((performance.now() - t0) / 1000).toFixed(2), bootEls = $$('#out .ln.bt');
  setTimeout(() => foldBoot(bootEls, hint, `<span class="o">✓</span><span class="m">ready in ${took} s</span><span class="f">·</span><span>${nCk} cookies</span><span class="f">·</span><span>${nTp} third-party requests</span><span class="f">·</span><span>${N && N.helius ? 'reads through helius' : 'public rpc'}</span><span class="tg" data-unfold>log</span>`), 1800);
  const want = new URLSearchParams(location.search).get('do'); if (want && /^[a-z0-9 .$-]{1,60}$/i.test(want)) setTimeout(() => runFrom(want), 300);
}

// the boot log folds into one line once it has been read, unless something has already been typed under it
function foldBoot(els, hint, html) {
  const out = $('#out'); if (!els.length || !hint || out.lastElementChild !== hint) return;
  const wrap = document.createElement('div'), inner = document.createElement('div'); wrap.className = 'bootlog'; wrap.appendChild(inner);
  els[0].before(wrap); els.forEach(e => inner.appendChild(e));
  const sum = document.createElement('div'); sum.className = 'ln bsum'; sum.innerHTML = html; wrap.before(sum);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('shut')));
}

// ---------------------------------------------------------------- the intro, then the terminal
const params = new URLSearchParams(location.search);
async function playIntro(force) {
  try { const m = await import('../intro.js?v=5'); window.__st3Sound = m.SOUND; return await new Promise(res => m.runIntro(played => res(played !== false), { force })); }
  catch (e) { console.warn(e); return false; }
}
(async () => {
  const played = params.has('nointro') ? false : await playIntro(false);
  boot({ fromIntro: played });
})();
addEventListener('st3:intro', () => { playIntro(true).then(() => { const app = $('#app'); app.classList.remove('on'); void app.offsetWidth; app.classList.add('on'); line('<span class="d">back behind the mask.</span>'); }); });
