// st3alth · the rest of the shell: a small filesystem to read, transaction and account inspection, the fee market,
// a calculator, conversions, live top, themes, aliases, and a few things that only exist in the dark.
import { $, api, esc, short, ago, usd, price, pct, amt, line, block, spinner, dots, sleep, clear, toast, isAddr, history, psHtml } from './core.js?v=1';
import { CMDS, ALIAS, def } from './cmds.js?v=1';
import * as SG from './signer.js?v=1';
const T0 = Date.now(); let RUNS = 0; export const counted = () => { RUNS++; };
let RUN = () => {}; export const setExtraRunner = f => { RUN = f; };

// ---------------------------------------------------------------- the filesystem: everything here is read-only
const FILES = {
  '/home/anon/readme.txt': () => `st3alth · the privacy terminal for solana.

put on the mask. everything you can do here is real:
trace shows who can see any wallet, swaps route through every dex,
orders live on jupiter, and every transaction is signed by you
(or by a burner that only ever lived in this tab).

start:
  trace               who can see your wallet, and how
  exposure            your score in one line
  burner new          a throwaway wallet that lives in this tab
  swap 0.1 sol usdc   a swap, routed across every dex
  scan                every pump.fun coin as it is born
  help                everything else

st3alth is independent. nothing here is advice. most memecoins go to zero.`,
  '/home/anon/manifesto.txt': () => `a public chain remembers everything.
so stop handing it your name.

every wallet leaves a trail: who funded it, where it sends,
what hours it wakes up. strangers read that trail for a living.

st3alth reads it first, and shows you.
then it gives you a mask: burners born in your tab,
reads that never leave your ip with a node,
a screen that blurs your own numbers.

we can't hide what the chain shows. we can stop it pointing at you.`,
  '/home/anon/privacy.txt': () => `what st3alth hides, and what stays public

hidden                                   still public
your name: never asked                   nothing
your ip: reads go through helius         your ip, to st3alth, like any site
your browser: no cookies or trackers     nothing beyond this site
your main wallet: burners trade for it   the burner and how it was funded
your screen: masked mode blurs it        nothing, it is your screen
your keys: never leave this tab          signatures, like every wallet
your balances: in a privacy ring         who sent to whom; withdrawals

solana privacy rings are confidential, not anonymous.`,
  '/home/anon/trace.txt': () => `how trace works

1  the first SOL a wallet ever received: helius knows who sent it.
2  that sender's first SOL, and theirs, up to three hops or an exchange.
3  the last few hundred transfers: who you send to, who sends to you.
4  every address on the way is checked against helius's labels:
   exchanges, protocols, bridges, known wallets.
5  the score adds up what a stranger could link to you, with reasons.

an exchange in the first hops is the big one: it knows a name.`,
  '/home/anon/commands.txt': () => Object.values(CMDS).filter(c => c.help).map(c => `${c.usage.padEnd(44)} ${c.help}`).join('\n'),
  '/etc/st3alth.conf': () => `network      = solana mainnet\nreads        = helius (server side)\nrouter       = jupiter (every dex)\ncookies      = 0\ntrackers     = 0\nthird_party  = 0\nsession      = forgotten on close\ncustody      = none`,
  '/proc/session': () => `session  ${(() => { try { return sessionStorage.getItem('st3:sess'); } catch { return '?'; } })()}\nuptime   ${Math.round((Date.now() - T0) / 1000)}s\ncommands ${RUNS}\nsigner   ${SG.state().active ? 'yes' : 'none'}`,
  '/dev/void': () => '',
};
const DIRS = { '/': ['home', 'etc', 'proc', 'dev'], '/home': ['anon'], '/home/anon': ['readme.txt', 'manifesto.txt', 'privacy.txt', 'trace.txt', 'commands.txt'], '/etc': ['st3alth.conf'], '/proc': ['session'], '/dev': ['void'] };
let CWD = '/home/anon';
const resolve = p => { if (!p) return CWD; let parts = (p.startsWith('/') ? p : CWD + '/' + p).split('/'); const out = []; for (const x of parts) { if (!x || x === '.') continue; if (x === '..') out.pop(); else out.push(x); } return '/' + out.join('/'); };
export const cwd = () => CWD;
def('ls', 'system', 'ls [dir]', 'list files', a => { const d = resolve(a.find(x => !x.startsWith('-'))); const l = DIRS[d]; if (!l) { if (FILES[d]) return line(esc(d.split('/').pop())); return line(`<span class="r">ls: ${esc(d)}: no such directory</span>`); } line(l.map(x => DIRS[d === '/' ? '/' + x : d + '/' + x] ? `<span class="h">${esc(x)}/</span>` : `<span class="tok c" data-run="cat ${esc(d === '/' ? '/' + x : d + '/' + x)}">${esc(x)}</span>`).join('   ')); }, ['dir', 'll']);
def('cd', 'system', 'cd <dir>', 'change directory', a => { const d = resolve(a[0] || '/home/anon'); if (!DIRS[d]) return line(`<span class="r">cd: ${esc(a[0] || '')}: no such directory</span>`); CWD = d; $('#ps').innerHTML = psHtml(d === '/home/anon' ? '~' : d.replace('/home/anon', '~')); });
def('pwd', 'system', 'pwd', 'where you are', () => line(esc(CWD)));
def('cat', 'system', 'cat <file>', 'read a file', async a => {
  if (!a[0]) return line('<span class="d">cat what? try</span> <span class="tok c" data-run="ls">ls</span>');
  const f = resolve(a[0]); if (!FILES[f]) return line(`<span class="r">cat: ${esc(a[0])}: no such file</span>`);
  if (f === '/dev/void') { await sleep(700); line(''); await sleep(900); line('<span class="f">the void looks back.</span>'); return; }
  const body = FILES[f](); for (const l of body.split('\n')) { line(`<span class="m">${esc(l) || ' '}</span>`); await sleep(8); }
}, ['less', 'more', 'type']);
def('tree', 'system', 'tree', 'the whole filesystem', () => { const walk = (d, pre) => (DIRS[d] || []).forEach((x, i, l) => { const p = d === '/' ? '/' + x : d + '/' + x, last = i === l.length - 1; line(`<span class="f">${pre}${last ? '└── ' : '├── '}</span>${DIRS[p] ? `<span class="h">${esc(x)}/</span>` : `<span class="tok c" data-run="cat ${esc(p)}">${esc(x)}</span>`}`); walk(p, pre + (last ? '    ' : '│   ')); }); line('<span class="h">/</span>'); walk('/', ''); });
def('echo', 'system', 'echo <text>', 'say something back', (a, raw) => line(esc(raw.replace(/^\S+\s?/, ''))));
def('date', 'system', 'date', 'the time, in utc', () => line(esc(new Date().toUTCString())));
def('uptime', 'system', 'uptime', 'how long this session has existed', () => line(`<span class="m">up ${Math.round((Date.now() - T0) / 1000)}s · ${RUNS} commands · forgotten on close</span>`));
def('uname', 'system', 'uname', 'the system', () => line('st3alth 1.0 mask solana-mainnet helius jupiter'));
def('neofetch', 'system', 'neofetch', 'the mask, and the system', () => { const d = document.createElement('div'); d.className = 'ln st3neo'; d.innerHTML = `<div class="mkbig">${document.querySelector('.brand .mk').outerHTML}</div>`; $('#out').appendChild(d); line(`<span class="h">st3alth</span><span class="f">@</span><span class="c">nobody</span>`); line(dots('os', '<span class="c">st3alth 1.0</span>')); line(dots('chain', '<span class="c">solana mainnet</span>')); line(dots('reads', '<span class="c">helius, server side</span>')); line(dots('router', '<span class="c">jupiter · every dex</span>')); line(dots('signer', `<span class="c">${SG.state().active ? 'yes' : 'none'}</span>`)); line(dots('uptime', `<span class="c">${Math.round((Date.now() - T0) / 1000)}s</span>`)); });
for (const [n, msg] of [['rm', 'nothing to remove. you were never here.'], ['touch', 'read-only. nothing you do here leaves a mark.'], ['mkdir', 'read-only. nothing you do here leaves a mark.'], ['ssh', 'no. you are already inside.'], ['ping', 'pong. nobody is listening.'], ['hack', 'there is nothing to hack. there is no one here.'], ['vim', 'you are already in the only editor that matters.'], ['nano', 'you are already in the only editor that matters.']]) def(n, 'system', n, '', () => line(`<span class="d">${esc(msg)}</span>`));

// ---------------------------------------------------------------- inspect
def('tx', 'market', 'tx <signature>', 'read any transaction: status, fee, programs, who moved what', async a => {
  const sig = a[0]; if (!sig) throw new Error('Give a transaction signature.'); const sp = spinner(`reading ${short(sig)}`);
  const t = await api('tx', { params: { sig } }); sp.done(`<span class="${t.err ? 'r">✗' : 'o">✓'}</span> ${dots('transaction', `<span class="${t.err ? 'r' : 'c'}">${t.err ? 'failed' : 'succeeded'}</span> <span class="f">· slot ${t.slot.toLocaleString('en-US')} · ${t.time ? ago(t.time * 1000) + ' ago' : ''}</span>`)}`);
  block(`tx · ${short(sig)}`, `
    <div class="kvg"><div><span>fee</span><b>${t.fee} SOL</b></div><div><span>compute</span><b>${t.cu ? t.cu.toLocaleString('en-US') + ' cu' : '—'}</b></div><div><span>signers</span><b>${t.signers.map(short).join(', ')}</b></div><div><span>version</span><b>${esc(String(t.version))}</b></div></div>
    <p class="d" style="margin:10px 0 4px">programs</p><p class="m" style="margin:0">${t.programs.map(p => `<span class="c">${esc(p.name || short(p.id))}</span>`).join(' <span class="f">·</span> ')}</p>
    ${t.sol.length ? `<p class="d" style="margin:10px 0 4px">SOL moved</p>${t.sol.map(x => `<div><span class="tok" data-run="account ${esc(x.key)}">${short(x.key)}</span> <span class="${x.d >= 0 ? 'up' : 'dn'}">${x.d >= 0 ? '+' : ''}${x.d.toFixed(6)}</span></div>`).join('')}` : ''}
    ${t.tokens.length ? `<p class="d" style="margin:10px 0 4px">tokens moved</p>${t.tokens.map(x => `<div><span class="tok" data-run="account ${esc(x.owner || '')}">${short(x.owner || '')}</span> <span class="${x.d >= 0 ? 'up' : 'dn'}">${x.d >= 0 ? '+' : ''}${amt(x.d)}</span> <span class="tok f" data-run="token ${esc(x.mint)}">${short(x.mint)}</span></div>`).join('')}` : ''}
    ${t.err ? `<p class="r" style="margin:10px 0 0">${esc(t.err)}</p>` : ''}
    <div class="row" style="margin-top:12px"><a class="btn ghost sm" href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener noreferrer">solscan ↗</a></div>`);
}, ['inspect']);
def('account', 'market', 'account <address>', 'what any address is: wallet, mint, token account or program, and its last activity', async a => {
  const addr = a[0] && isAddr(a[0]) ? a[0] : SG.active(); if (!addr) throw new Error('Give an address.'); const sp = spinner(`reading ${short(addr)}`);
  const j = await api('account', { params: { addr } }); sp.done(`<span class="o">✓</span> ${dots(short(addr), `<span class="c">${esc(j.kind)}</span> <span class="f">· ${amt(j.sol)} SOL</span>`)}`);
  const d = j.detail || {};
  block(`account · ${short(addr)} · ${esc(j.kind)}`, `
    <div class="kvg"><div><span>kind</span><b>${esc(j.kind)}</b></div><div><span>SOL</span><b>${amt(j.sol)}</b></div><div><span>owner program</span><b>${esc(d.ownerName || short(d.owner || ''))}</b></div><div><span>oldest of last 20</span><b>${j.first ? ago(j.first * 1000) + ' ago' : '—'}</b></div>
    ${j.kind === 'token mint' ? `<div><span>decimals</span><b>${d.decimals}</b></div><div><span>supply</span><b>${amt(Number(d.supply) / 10 ** d.decimals)}</b></div><div><span>mint authority</span><b class="${d.mintAuthority ? 'dn' : 'up'}">${d.mintAuthority ? short(d.mintAuthority) : 'none ✓'}</b></div><div><span>freeze authority</span><b class="${d.freezeAuthority ? 'dn' : 'up'}">${d.freezeAuthority ? short(d.freezeAuthority) : 'none ✓'}</b></div>` : ''}
    ${j.kind === 'token account' ? `<div><span>mint</span><b><span class="tok" data-run="token ${esc(d.mint)}">${short(d.mint)}</span></b></div><div><span>holder</span><b>${short(d.owner)}</b></div><div><span>amount</span><b>${esc(d.amount)}</b></div><div></div>` : ''}</div>
    ${j.recent.length ? `<p class="d" style="margin:10px 0 4px">recent activity</p>${j.recent.slice(0, 8).map(s => `<div><span class="tok" data-run="tx ${esc(s.sig)}">${short(s.sig)}</span> <span class="f">${s.time ? ago(s.time * 1000) + ' ago' : ''}</span> ${s.err ? '<span class="r">failed</span>' : ''}</div>`).join('')}` : '<p class="d">no activity found.</p>'}
    <div class="row" style="margin-top:12px">${j.kind === 'wallet' ? `<button type="button" class="btn ghost sm" data-c="wallet ${esc(addr)}">holdings</button>` : ''}${j.kind === 'token mint' ? `<button type="button" class="btn ghost sm" data-c="token ${esc(addr)}">token report</button>` : ''}<a class="btn ghost sm" href="https://solscan.io/account/${esc(addr)}" target="_blank" rel="noopener noreferrer">solscan ↗</a></div>`).querySelectorAll('[data-c]').forEach(x => x.onclick = () => RUN(x.dataset.c));
}, ['whois', 'addr']);
def('fees', 'market', 'fees', 'the priority fee market right now, and what a swap costs', async () => {
  const sp = spinner('reading the fee market'); const f = await api('fees'); sp.done(`<span class="o">✓</span> ${dots('fee market', `<span class="c">${f.slots} recent slots</span>`)}`);
  const cost = mu => ((5000 + mu * 200000 / 1e6) / 1e9);
  for (const [k, v] of [['calm (p25)', f.p25], ['normal (p50)', f.p50], ['busy (p75)', f.p75], ['rush (p90)', f.p90]]) line(dots(k, `<span class="c">${v.toLocaleString('en-US')} µlamports/cu</span> <span class="f">≈ ${cost(v).toFixed(6)} SOL for a 200k cu swap</span>`));
}, ['gas', 'priority']);

// ---------------------------------------------------------------- numbers
function calc(src) {
  const s = src.replace(/,/g, '').replace(/(\d+(?:\.\d+)?)\s*([kmb])\b/gi, (_, n, u) => String(parseFloat(n) * { k: 1e3, m: 1e6, b: 1e9 }[u.toLowerCase()]));
  let i = 0; const peek = () => s[i], ws = () => { while (/\s/.test(s[i] || '')) i++; };
  const num = () => { ws(); if (s[i] === '(') { i++; const v = add(); ws(); if (s[i++] !== ')') throw new Error('missing )'); return v; } if (s[i] === '-') { i++; return -num(); } const m = /^\d*\.?\d+(e[-+]?\d+)?/i.exec(s.slice(i)); if (!m) throw new Error('not a number'); i += m[0].length; return parseFloat(m[0]); };
  const pow = () => { let v = num(); ws(); while (s[i] === '^') { i++; v = Math.pow(v, num()); ws(); } return v; };
  const mul = () => { let v = pow(); ws(); while ('*/%'.includes(peek() || '_')) { const o = s[i++]; const r = pow(); v = o === '*' ? v * r : o === '/' ? v / r : v % r; ws(); } return v; };
  const add = () => { let v = mul(); ws(); while ('+-'.includes(peek() || '_')) { const o = s[i++]; const r = mul(); v = o === '+' ? v + r : v - r; ws(); } return v; };
  const v = add(); ws(); if (i < s.length) throw new Error('could not read that'); return v;
}
def('calc', 'system', 'calc <expression>', 'a calculator: 0.5*142 · 1.2m/3 · (2+3)^2', (a, raw) => { const e = raw.replace(/^\S+\s?/, ''); try { const v = calc(e); line(`<span class="c">${esc(e)}</span> <span class="f">=</span> <span class="h">${Number.isInteger(v) ? v.toLocaleString('en-US') : v.toPrecision(10).replace(/\.?0+$/, '')}</span>`); } catch (er) { line(`<span class="r">calc: ${esc(er.message)}</span>`); } }, ['=']);
def('convert', 'market', 'convert <amount> <token> <token>', 'what an amount of one token is worth in another, at market', async a => {
  const [n, x, y = 'usdc'] = a; if (!n || !x) throw new Error('Try: convert 2 sol bonk');
  const [A, B] = await Promise.all([api('token', { params: { q: x } }), api('token', { params: { q: y } })]);
  const v = parseFloat(n) * A.token.price / B.token.price; line(`<span class="c">${esc(n)} ${esc(A.token.sym)}</span> <span class="f">=</span> <span class="h">${amt(v)} ${esc(B.token.sym)}</span> <span class="f">· ${usd(parseFloat(n) * A.token.price, 2)}</span>`);
}, ['cv']);

// ---------------------------------------------------------------- live top: refreshes until the next command
let TOP = 0;
def('top', 'market', 'top [5m|1h|6h|24h]', 'a live trending board that refreshes every few seconds', async a => {
  const w = ['5m', '1h', '6h', '24h'].includes(a[0]) ? a[0] : '5m', id = ++TOP;
  const b = block(`top · ${w} · live`, '<p class="d">loading…</p>'); const body = b.querySelector('.bb');
  const paint = async () => { const j = await api('trending', { params: { w } }); body.innerHTML = `<table class="tbl"><thead><tr><th>#</th><th>token</th><th class="n">price</th><th class="n">${w === '24h' ? '24h' : '1h'}</th><th class="n">mcap</th><th class="n">vol 24h</th></tr></thead><tbody>${j.tokens.slice(0, 15).map((t, i) => `<tr><td class="f">${i + 1}</td><td><span class="tok" data-run="token ${esc(t.mint)}"><b>${esc(t.sym)}</b></span> <span class="f">${esc(t.name.slice(0, 20))}</span></td><td class="n">${price(t.price)}</td><td class="n">${pct(w === '24h' ? t.c24h : t.c1h)}</td><td class="n">${usd(t.mcap)}</td><td class="n">${usd(t.v24h)}</td></tr>`).join('')}</tbody></table><p class="f" style="margin:8px 0 0">refreshing · ${new Date().toLocaleTimeString('en-GB')} · runs until your next command</p>`; };
  await paint().catch(() => {}); (async () => { for (let k = 0; k < 40 && id === TOP; k++) { await sleep(6000); if (id !== TOP) break; await paint().catch(() => {}); } if (id === TOP) b.querySelector('.bh').innerHTML += ' <span class="f">· stopped</span>'; })();
}, ['htop']);
export const stopTop = () => { TOP++; };

// ---------------------------------------------------------------- the look: themes; aliases; the dark
const THEMES = ['mono', 'phosphor', 'amber', 'blood'];
export function applyTheme(t) { document.documentElement.classList.remove(...THEMES.map(x => 't-' + x)); if (t && t !== 'mono') document.documentElement.classList.add('t-' + t); try { localStorage.setItem('st3:theme', t); } catch {} }
try { applyTheme(localStorage.getItem('st3:theme') || 'mono'); } catch {}
def('theme', 'system', 'theme [mono|phosphor|amber|blood]', 'change the colour of the terminal', a => { const t = THEMES.includes(a[0]) ? a[0] : THEMES[(THEMES.indexOf((() => { try { return localStorage.getItem('st3:theme'); } catch { return 'mono'; } })() || 'mono') + 1) % THEMES.length]; applyTheme(t); line(`<span class="o">✓</span> theme ${esc(t)}`); });
let ALIASES = {}; try { ALIASES = JSON.parse(localStorage.getItem('st3:alias') || '{}'); } catch {}
export const aliasOf = n => ALIASES[n];
def('alias', 'system', 'alias [name=command]', 'your own shortcuts, kept in this browser', (a, raw) => {
  const body = raw.replace(/^\S+\s?/, '').trim(); if (!body) { const k = Object.keys(ALIASES); return k.length ? k.forEach(n => line(`<span class="c">${esc(n)}</span> <span class="f">=</span> ${esc(ALIASES[n])}`)) : line('<span class="d">no aliases. try</span> <span class="c">alias ape=buy bonk 0.1</span>'); }
  const m = /^([a-z0-9_-]{1,16})\s*=\s*(.+)$/i.exec(body); if (!m) throw new Error('Try: alias ape=buy bonk 0.1');
  if (CMDS[m[1].toLowerCase()]) throw new Error(`${m[1]} is already a command.`); ALIASES[m[1].toLowerCase()] = m[2]; try { localStorage.setItem('st3:alias', JSON.stringify(ALIASES)); } catch {} line(`<span class="o">✓</span> ${esc(m[1])} <span class="f">→</span> ${esc(m[2])}`);
});
def('unalias', 'system', 'unalias <name>', 'remove a shortcut', a => { delete ALIASES[a[0]]; try { localStorage.setItem('st3:alias', JSON.stringify(ALIASES)); } catch {} line('<span class="o">✓</span> removed'); });
def('stats', 'system', 'stats', 'this session, in numbers', async () => {
  line(dots('commands run', `<span class="c">${RUNS}</span>`)); line(dots('session uptime', `<span class="c">${Math.round((Date.now() - T0) / 1000)}s</span>`)); line(dots('signer', `<span class="c">${SG.state().active ? 'yes' : 'none'}</span>`));
  line(dots('this session', `<span class="c">${Math.round((Date.now() - T0) / 1000)}s · ${RUNS} commands · ${history().length} in history</span>`));
});
def('matrix', 'system', 'matrix', 'the void, falling', async () => {
  const out = $('#out'), cv = document.createElement('canvas'); cv.className = 'mx'; out.parentElement.appendChild(cv);
  const r = out.getBoundingClientRect(), pr = out.parentElement.getBoundingClientRect(); Object.assign(cv.style, { position: 'absolute', left: (r.left - pr.left) + 'px', top: (r.top - pr.top) + 'px', width: r.width + 'px', height: r.height + 'px', pointerEvents: 'none', zIndex: 5 });
  cv.width = r.width; cv.height = r.height; const g = cv.getContext('2d'), cols = Math.floor(r.width / 14), y = Array(cols).fill(0).map(() => Math.random() * -50), ch = 'st3alth01░▒▓█ØΛΞ'.split('');
  const t0 = performance.now();
  await new Promise(res => { const f = now => { g.fillStyle = 'rgba(4,4,5,.18)'; g.fillRect(0, 0, cv.width, cv.height); g.font = '13px JB, monospace'; for (let i = 0; i < cols; i++) { g.fillStyle = Math.random() < .03 ? '#fff' : 'rgba(236,235,230,.55)'; g.fillText(ch[(Math.random() * ch.length) | 0], i * 14, y[i] * 16); if (y[i] * 16 > cv.height && Math.random() > .975) y[i] = 0; y[i] += .9; } if (now - t0 < 4200) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  cv.style.transition = 'opacity .6s'; cv.style.opacity = 0; setTimeout(() => cv.remove(), 700); line('<span class="f">wake up, anon.</span>');
});
// a qr code for any address: fund a burner from a phone or an exchange without typing it
def('qr', 'wallet', 'qr [address]', 'a scannable code for an address (your burner by default)', async a => {
  const addr = a[0] && isAddr(a[0]) ? a[0] : (SG.burnerPub() || SG.active()); if (!addr) throw new Error('Give an address, or make a burner first (burner new).');
  const { default: qrcode } = await import('./qr.js?v=1'); const q = qrcode(0, 'M'); q.addData(addr); q.make();
  const n = q.getModuleCount(), px = Math.max(4, Math.floor(232 / (n + 8))), size = (n + 8) * px, cv = document.createElement('canvas'); cv.width = cv.height = size; cv.style.cssText = `width:${size}px;height:${size}px;border-radius:10px;display:block`;
  const g = cv.getContext('2d'); g.fillStyle = '#ecebe6'; g.fillRect(0, 0, size, size); g.fillStyle = '#040405';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + 4) * px, (r + 4) * px, px, px);
  const b = block(`qr · ${short(addr)}`, `<div class="row" style="align-items:flex-start;gap:18px"><div data-q></div><div><p class="m" style="margin:0 0 8px;word-break:break-all">${esc(addr)}</p><p class="d" style="margin:0">scan it to send SOL here. ${addr === SG.burnerPub() ? 'this is your burner: fund it from an exchange or a ring for a clean break from your main wallet.' : ''}</p></div></div>`);
  b.querySelector('[data-q]').appendChild(cv);
}, ['qrcode']);

// ---------------------------------------------------------------- trades you made here, and what they are worth now (kept in this browser only)
const QUOTE = new Set(['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD2WiKqCfsV3N7MdL1XXXcp']);
let TRADES = []; try { TRADES = JSON.parse(localStorage.getItem('st3:trades') || '[]'); } catch {}
const saveTrades = () => { try { localStorage.setItem('st3:trades', JSON.stringify(TRADES.slice(-300))); } catch {} };
addEventListener('st3:trade', e => { TRADES.push(e.detail); saveTrades(); });
def('pnl', 'wallet', 'pnl', 'profit and loss on what you bought and sold from this terminal', async () => {
  if (!TRADES.length) return line('<span class="m">no trades from this browser yet. after a</span> <span class="c">buy</span> <span class="m">or</span> <span class="c">sell</span><span class="m">, they show up here.</span>');
  const pos = new Map();
  for (const t of TRADES) {
    const buy = QUOTE.has(t.in.mint) && !QUOTE.has(t.out.mint), sell = !QUOTE.has(t.in.mint) && QUOTE.has(t.out.mint); if (!buy && !sell) continue;
    const k = buy ? t.out : t.in, p = pos.get(k.mint) || { sym: k.sym, held: 0, cost: 0, back: 0, n: 0 };
    if (buy) { p.held += t.outUi; p.cost += t.usd || 0; } else { p.held -= t.inUi; p.back += t.usd || 0; } p.n++; pos.set(k.mint, p);
  }
  if (!pos.size) return line('<span class="d">only token-to-token swaps so far; pnl tracks buys and sells against SOL or USDC.</span>');
  const sp = spinner('pricing your positions'); const pr = await api('price', { params: { ids: [...pos.keys()].join(',') } }); sp.done(`<span class="o">✓</span> ${dots('positions', `<span class="c">${pos.size}</span>`)}`);
  let tot = 0, totCost = 0;
  const rows = [...pos.entries()].map(([m, p]) => { const px = pr.prices[m] ? pr.prices[m].usd : null, val = px != null ? Math.max(0, p.held) * px : null, pl = val != null ? val + p.back - p.cost : null; tot += pl || 0; totCost += p.cost; return `<tr><td><span class="tok" data-run="token ${esc(m)}"><b>${esc(p.sym)}</b></span></td><td class="n">${amt(Math.max(0, p.held))}</td><td class="n">${usd(p.cost, 2)}</td><td class="n">${usd(p.back, 2)}</td><td class="n">${usd(val, 2)}</td><td class="n ${pl >= 0 ? 'up' : 'dn'}">${pl == null ? '—' : (pl >= 0 ? '+' : '') + usd(pl, 2)}</td><td class="n">${p.cost && pl != null ? pct(pl / p.cost * 100) : '—'}</td></tr>`; });
  block(`pnl · ${TRADES.length} trades from this browser`, `<table class="tbl"><thead><tr><th>token</th><th class="n">held</th><th class="n">cost</th><th class="n">sold for</th><th class="n">worth now</th><th class="n">pnl</th><th class="n">%</th></tr></thead><tbody>${rows.join('')}</tbody></table><p class="${tot >= 0 ? 'up' : 'dn'}" style="margin:10px 0 0">total ${tot >= 0 ? '+' : ''}${usd(tot, 2)} ${totCost ? `(${(tot / totCost * 100).toFixed(1)}%)` : ''} <span class="f">· prices now · fees and gas not counted</span></p>`);
}, ['positions', 'pos']);
def('trades', 'wallet', 'trades', 'every trade you made from this browser', () => { if (!TRADES.length) return line('<span class="d">none yet</span>'); block('trades', `<table class="tbl"><tbody>${TRADES.slice(-40).reverse().map(t => `<tr><td class="f">${new Date(t.at).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td>${amt(t.inUi)} ${esc(t.in.sym)} → ${amt(t.outUi)} ${esc(t.out.sym)}</td><td class="n">${usd(t.usd, 2)}</td><td>${t.sig ? `<a href="https://solscan.io/tx/${esc(t.sig)}" target="_blank" rel="noopener noreferrer">tx ↗</a>` : ''}</td></tr>`).join('')}</tbody></table>`); });

// ---------------------------------------------------------------- price alerts while this tab is open
let ALERTS = []; try { ALERTS = JSON.parse(localStorage.getItem('st3:alerts') || '[]'); } catch {}
const saveAlerts = () => { try { localStorage.setItem('st3:alerts', JSON.stringify(ALERTS)); } catch {} };
def('alert', 'market', 'alert <token> <above|below> <price>', 'tell me when a price crosses a line (while this tab is open)', async a => {
  const [q, dirW, pw] = a; if (!q || !dirW || !pw) throw new Error('Try: alert bonk above 0.00003  ·  alert sol below 120');
  const dir = /^(>|above|over)$/.test(dirW) ? 'above' : /^(<|below|under)$/.test(dirW) ? 'below' : null; if (!dir) throw new Error('Say above or below.');
  const px = parseFloat(pw.replace('$', '')); if (!(px > 0)) throw new Error('Give a price in dollars.');
  const { token: t } = await api('token', { params: { q } }); ALERTS.push({ mint: t.mint, sym: t.sym, dir, px, at: Date.now() }); saveAlerts();
  line(`<span class="o">✓</span> ${dots('alert', `<span class="c">${esc(t.sym)} ${dir} $${px}</span> <span class="f">· now ${price(t.price)}</span>`)}`);
  if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch {} }
}, ['notify']);
def('alerts', 'market', 'alerts', 'your price alerts', () => { if (!ALERTS.length) return line('<span class="d">no alerts. try</span> <span class="c">alert sol above 200</span>'); ALERTS.forEach((x, i) => line(`<span class="f">${i + 1}</span>  <span class="c">${esc(x.sym)}</span> ${x.dir} $${x.px}  <span class="tok f" data-run="unalert ${i + 1}">remove</span>`)); });
def('unalert', 'market', 'unalert <n>', 'remove an alert', a => { const i = parseInt(a[0]) - 1; if (ALERTS[i]) { ALERTS.splice(i, 1); saveAlerts(); line('<span class="o">✓</span> removed'); } else line('<span class="r">no such alert</span>'); });
setInterval(async () => {
  if (!ALERTS.length || document.hidden) return;
  try { const p = await api('price', { params: { ids: [...new Set(ALERTS.map(x => x.mint))].join(',') } });
    for (const x of ALERTS.slice()) { const v = p.prices[x.mint] && p.prices[x.mint].usd; if (v == null) continue; if ((x.dir === 'above' && v >= x.px) || (x.dir === 'below' && v <= x.px)) {
      ALERTS = ALERTS.filter(y => y !== x); saveAlerts(); line(`<span class="h">■ alert</span> <span class="c">${esc(x.sym)} is ${x.dir} $${x.px}</span> <span class="f">· now ${price(v)}</span> <span class="tok c" data-run="token ${esc(x.mint)}">report</span>`); toast(`${x.sym} ${x.dir} $${x.px}`);
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification(`st3alth · ${x.sym} ${x.dir} $${x.px}`, { body: `now ${v}`, icon: '/assets/hood-192.png', silent: true }); } catch {} } } } catch {}
}, 20000);
