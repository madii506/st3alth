// st3alth · window 7, the checkup: one page that audits a wallet and this browser together, with the fixes in order.
// and `link`: are two wallets tied together on chain? Both read only public data (through helius) and this tab.
import { $, esc, line, block, spinner, dots, api, short, isAddr, toast } from './core.js?v=9';
import { def, showTab } from './cmds.js?v=9';
import * as SG from './signer.js?v=9';
import { readPrint } from './tools.js?v=9';

const ringSvg = (v, col, size = 84, w = 7) => { const r = (size - w) / 2, c = 2 * Math.PI * r; return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#17171a" stroke-width="${w}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${c * v / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})" class="ck-arc"/></svg>`; };
const GCOL = { A: '#a7d7b6', B: '#c9dca5', C: '#e7c58c', D: '#e9ad8a', F: '#ea9f9f' };
const isAll = (amt, bal) => { const a = parseFloat(amt), b = parseFloat(bal); return !isFinite(a) || a >= 1e12 || (isFinite(b) && b > 0 && a >= b); };

// ---------------------------------------------------------------- link
const NOISE = c => c.kind === 'cex' || c.kind === 'defi';            // everyone shares exchanges and protocols: they prove nothing
function cos(a, b) { let x = 0, y = 0, z = 0; for (let i = 0; i < 24; i++) { x += a[i] * b[i]; y += a[i] * a[i]; z += b[i] * b[i]; } return y && z ? x / Math.sqrt(y * z) : 0; }
export function linkOf(A, B) {
  const ev = [], add = (pts, sev, title, detail) => ev.push({ pts, sev, title, detail });
  const ca = new Map(A.counterparties.map(c => [c.addr, c])), cb = new Map(B.counterparties.map(c => [c.addr, c]));
  const ab = ca.get(B.addr), ba = cb.get(A.addr);
  if (ab || ba) { const n = ab ? ab.nIn + ab.nOut : ba.nIn + ba.nOut; add(55, 'hi', `they paid each other · ${n} transfer${n === 1 ? '' : 's'}`, 'a direct transfer is the strongest link there is, and anyone can see it.'); }
  const fa = A.chain.map(c => c.addr), fb = B.chain.map(c => c.addr);
  if (fa.includes(B.addr) || fb.includes(A.addr)) add(50, 'hi', 'one funded the other', 'the first SOL of one wallet came from the other.');
  const sharedF = A.chain.filter(c => fb.includes(c.addr));
  for (const f of sharedF.slice(0, 2)) add(f.kind === 'cex' ? 8 : 35, f.kind === 'cex' ? 'lo' : 'hi', `same funder: ${f.label && f.label.name || short(f.addr)}`, f.kind === 'cex' ? 'both drew from the same exchange wallet. millions do, but the exchange knows the account behind each.' : 'both were funded by the same private wallet. that is exactly how clusters get built.');
  const shared = A.counterparties.filter(c => !NOISE(c) && cb.has(c.addr) && c.addr !== A.addr && c.addr !== B.addr);
  if (shared.length) add(Math.min(30, shared.length * 10), shared.length > 1 ? 'hi' : 'mid', `${shared.length} private wallet${shared.length === 1 ? '' : 's'} in common`, 'both talk to the same wallets that are not exchanges or protocols: a friend, a payer, or a third wallet of yours.');
  const ha = A.stats.hours, hb = B.stats.hours, na = ha.reduce((x, y) => x + y, 0), nb = hb.reduce((x, y) => x + y, 0), r = cos(ha, hb);
  if (na >= 20 && nb >= 20 && r > .85) add(10, 'mid', `the same daily rhythm · ${Math.round(r * 100)}% alike`, 'both move in the same hours (utc). alone it proves little; next to anything else it adds up.');
  const ea = A.chain.find(c => c.kind === 'cex'), eb = B.chain.find(c => c.kind === 'cex');
  if (ea && eb && ea.label && eb.label && ea.label.name === eb.label.name && !sharedF.some(f => f.kind === 'cex')) add(6, 'lo', `both trace back to ${ea.label.name}`, 'the same exchange sits at the root of both, and it knows who opened each account.');
  const s = Math.min(100, ev.reduce((x, e) => x + e.pts, 0));
  return { s, ev, shared, sharedF, direct: !!(ab || ba || fa.includes(B.addr) || fb.includes(A.addr)), verdict: s >= 60 ? 'linked' : s >= 35 ? 'probably linked' : s >= 15 ? 'loosely linked' : 'no visible link' };
}
function linkSvg(A, B, L) {
  const mid = [...L.sharedF.map(f => ({ n: f.label && f.label.name || short(f.addr), k: f.kind === 'cex' ? 'cex' : 'fund' })), ...L.shared.slice(0, 4).map(c => ({ n: c.label && c.label.name || short(c.addr), k: 'cp' }))].slice(0, 5);
  const W = 600, H = Math.max(150, 50 + mid.length * 40), ay = H / 2; let g = '';
  mid.forEach((m, i) => { const y = 25 + (i + .5) * (H - 50) / mid.length; g += `<path d="M78 ${ay} C 190 ${ay} 210 ${y} 300 ${y} S 410 ${ay} 522 ${ay}" class="lk-l ${m.k}" style="animation-delay:${i * 120}ms"/><circle cx="300" cy="${y}" r="5.5" class="lk-n ${m.k}"/><text x="300" y="${y - 11}" text-anchor="middle">${esc(m.n)}</text>`; });
  if (L.direct) g += `<line x1="78" y1="${ay}" x2="522" y2="${ay}" class="lk-l direct"/>`;
  if (!mid.length && !L.direct) g += `<line x1="78" y1="${ay}" x2="522" y2="${ay}" class="lk-l none"/><text x="300" y="${ay - 12}" text-anchor="middle" class="f">nothing in common that we can see</text>`;
  return `<svg class="lks" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}<circle cx="64" cy="${ay}" r="13" class="lk-n a"/><circle cx="536" cy="${ay}" r="13" class="lk-n b"/><text x="64" y="${ay + 32}" text-anchor="middle">${esc(short(A.addr))}</text><text x="536" y="${ay + 32}" text-anchor="middle">${esc(short(B.addr))}</text><text x="64" y="${ay + 4}" text-anchor="middle" class="lk-k">a</text><text x="536" y="${ay + 4}" text-anchor="middle" class="lk-k">b</text></svg>`;
}
def('link', 'privacy', 'link <wallet a> [wallet b]', 'are two wallets tied together on chain? direct transfers, shared funders, wallets in common, the same hours. one address compares it with yours', async a => {
  const s = SG.state(); let [x, y] = a; if (x && !y && s.active) { y = x; x = s.active; }
  if (!x || !y) throw new Error('Try: link <wallet a> <wallet b>, or link <wallet> to compare it with yours.');
  if (x === y) throw new Error('Give two different wallets.');
  for (const v of [x, y]) if (!isAddr(v) && !/^[a-z0-9-]{1,63}\.sol$/i.test(v)) throw new Error(`${v} is not a Solana address or a .sol name.`);
  const sp = spinner('reading both trails through helius'); let A, B;
  try { [A, B] = await Promise.all([api('trace', { params: { addr: x } }), api('trace', { params: { addr: y } })]); } catch (e) { sp.fail(esc(e.message)); return; }
  const L = linkOf(A, B), col = L.s >= 60 ? 'var(--down)' : L.s >= 35 ? 'var(--warn)' : L.s >= 15 ? 'var(--fg2)' : 'var(--up)';
  sp.done(`<span class="o">✓</span> ${dots('link', `<span style="color:${col}">${L.verdict}</span> <span class="f">· ${L.s}/100</span>`)}`);
  block(`link · ${esc(short(A.addr))} ↔ ${esc(short(B.addr))}`, `
    <div class="lk-top"><b style="color:${col}">${L.verdict}</b><span>${L.s}/100 · from what anyone can read on chain</span></div>
    ${linkSvg(A, B, L)}
    <div class="lk-ev">${L.ev.length ? L.ev.map((e, i) => `<div class="leak ${e.sev}" style="animation-delay:${i * 70}ms"><span class="ic2">${e.sev === 'hi' ? '!' : e.sev === 'mid' ? '~' : '·'}</span><div><b>${esc(e.title)}</b><p>${esc(e.detail)}</p></div><em>+${e.pts}</em></div>`).join('') : '<p class="d">no direct transfers, no shared funder, no private wallets in common, different hours. from the outside these look like two strangers.</p>'}</div>
    <div class="rvl"><i></i><div><b>to keep two wallets apart:</b> never send between them, fund each from a different source, do not pay the same people from both, and do not use them in the same hours. a <span class="tok" data-run="burner new">burner</span> per job makes this the default.</div></div>`);
}, ['linked', 'compare']);

// ---------------------------------------------------------------- checkup
let RUNNING = 0;
async function checkup(addr) {
  const box = $('#checkbox'); if (!box) return; const my = ++RUNNING, s = SG.state(), who = addr || s.active;
  const third = u => { try { return new URL(u, location.href).origin !== location.origin; } catch { return false; } };
  const ck = document.cookie ? document.cookie.split(';').length : 0, tp = performance.getEntriesByType('resource').filter(r => third(r.name)).length, masked = document.body.classList.contains('masked');
  box.innerHTML = `<div class="ck-head"><div><div class="eyebrow">checkup</div><h2>${who ? `a full look at <span class="sens">${esc(short(who))}</span> and this browser` : 'this browser, and a wallet when you have one'}</h2><p class="d">public chain data through helius, plus what this tab can see. nothing is stored.</p></div><div class="ck-grade" id="ck-grade"><span>…</span></div></div><div class="ck-grid" id="ck-grid">${'<div class="ck-c"><div class="skel" style="width:60%"></div><div class="skel" style="width:85%"></div><div class="skel" style="width:40%"></div></div>'.repeat(6)}</div><div class="ck-fix" id="ck-fix"></div>`;
  const [T, P, R] = await Promise.all([who ? api('trace', { params: { addr: who } }).catch(e => ({ err: e })) : null, readPrint().catch(() => null), who ? api('approvals', { params: { owner: who } }).catch(e => ({ err: e })) : null]);
  if (my !== RUNNING) return;
  let score = 100; const fixes = [], cards = [];
  // 1 exposure
  if (!who) cards.push(['exposure', '<p class="d">no wallet yet.</p>', '<span class="tok c" data-run="connect">connect</span> <span class="f">·</span> <span class="tok c" data-run="burner new">burner new</span>', '']);
  else if (T.err) cards.push(['exposure', `<p class="w">${esc(T.err.message)}</p>`, '', '']);
  else {
    score -= Math.round(T.score * .45);
    cards.push(['exposure', `<div class="ck-ring">${ringSvg(T.score, T.score >= 75 ? 'var(--down)' : T.score >= 50 ? 'var(--warn)' : T.score >= 25 ? 'var(--fg2)' : 'var(--up)')}<b>${T.score}</b></div><div><b class="ck-big">${esc(T.grade)}</b><p class="d">${esc(T.leaks[0] ? T.leaks[0].title : 'nothing obvious')}</p></div>`, `<span class="tok c" data-run="trace ${esc(who)}">open the trace</span>`, T.score >= 50 ? 'hi' : T.score >= 25 ? 'mid' : 'ok']);
    if (T.score >= 50) fixes.push([`this wallet is ${T.grade}. trade from a fresh burner funded from somewhere else.`, 'burner new']);
    // 2 threats
    const th = T.threats || [], po = th.filter(x => x.kind === 'poison'), du = th.find(x => x.kind === 'dust');
    if (po.length) { score -= 20; fixes.unshift([`${po.length} look-alike address${po.length === 1 ? '' : 'es'} planted in its history. never copy an address from your history.`, `trace ${who}`]); }
    if (du) score -= 4;
    cards.push(['threats', po.length || du ? `<b class="ck-big ${po.length ? 'r' : 'w'}">${po.length ? po.length + ' poisoning' : du.n + ' dust'}</b><p class="d">${po.length ? 'a look-alike of a wallet it pays sent it something tiny' : `tiny transfers from ${du.from} stranger${du.from === 1 ? '' : 's'}`}</p>` : '<b class="ck-big g">none seen</b><p class="d">no look-alikes, no dust in the transfers we read</p>', `<span class="tok c" data-run="trace ${esc(who)}">see them</span>`, po.length ? 'hi' : du ? 'mid' : 'ok']);
  }
  if (!who) cards.push(['threats', '<p class="d">needs a wallet.</p>', '', '']);
  // 3 approvals
  if (!who) cards.push(['approvals', '<p class="d">needs a wallet.</p>', '', '']);
  else if (!R || R.err) cards.push(['approvals', `<p class="w">${esc(R && R.err ? R.err.message : 'could not read')}</p>`, '', '']);
  else {
    const all = R.approvals.filter(x => isAll(x.amount, x.balance)).length, n = R.approvals.length;
    score -= Math.min(30, all * 15 + (n - all) * 5);
    if (n) fixes.unshift([`${n} token approval${n === 1 ? '' : 's'} open${all ? `, ${all} for everything` : ''}. revoke them in one signature.`, `approvals ${who}`]);
    cards.push(['approvals', n ? `<b class="ck-big ${all ? 'r' : 'w'}">${n} open</b><p class="d">${all ? all + ' can move every token in the account' : 'limited amounts'}</p>` : `<b class="ck-big g">none</b><p class="d">nobody else can move its tokens · ${R.checked} accounts checked</p>`, `<span class="tok c" data-run="approvals ${esc(who)}">${n ? 'revoke' : 'details'}</span>`, all ? 'hi' : n ? 'mid' : 'ok']);
  }
  // 4 browser
  if (P) { const dnt = P.rows.find(r => r[0] === 'do not track'); cards.push(['browser', `<b class="ck-big">${P.id.slice(0, 8).replace(/(.{4})(?=.)/g, '$1·')}</b><p class="d">${P.rows.length} signals any site reads without asking${dnt && /on/.test(dnt[1]) ? ' · do-not-track is on, which is itself a clue' : ''}</p>`, '<span class="tok c" data-run="fingerprint">fingerprint</span>', 'mid']); fixes.push(['every site can fingerprint this browser. use one that randomizes canvas and audio for anything that matters.', 'fingerprint']); }
  // 5 this session
  if (ck || tp) score -= 10;
  cards.push(['this tab', `<b class="ck-big ${ck || tp ? 'w' : 'g'}">${ck} cookies · ${tp} third-party</b><p class="d">${ck || tp ? 'something here talks to someone else' : 'this tab talks to st3alth and nobody else'}</p>`, `<span class="tok c" data-run="privacy">what it talks to</span>`, ck || tp ? 'mid' : 'ok']);
  // 6 signer
  const kind = s.active ? SG.activeKind() : null;
  if (who && who === s.active && kind !== 'burner') { score -= 5; fixes.push(['you are signing with your main wallet. a burner keeps trades off it.', 'burner new']); }
  cards.push(['signer', kind ? `<b class="ck-big ${kind === 'burner' ? 'g' : 'w'}">${kind === 'burner' ? 'a burner' : 'your wallet'}</b><p class="d">${kind === 'burner' ? 'born in this tab, never on a server' : 'every trade lands in its public history'}</p>` : '<b class="ck-big">none</b><p class="d">connect a wallet or make a burner</p>', `<span class="tok c" data-run="${kind === 'burner' ? 'burner' : 'burner new'}">${kind === 'burner' ? 'burner' : 'make a burner'}</span>`, kind === 'burner' ? 'ok' : kind ? 'mid' : '']);
  score = Math.max(0, Math.min(100, score)); const G = !who ? '–' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  $('#ck-grade').innerHTML = who ? `<b style="color:${GCOL[G]}">${G}</b><span>${score}/100</span>` : '<b>–</b><span>needs a wallet</span>';
  $('#ck-grid').innerHTML = cards.map(([k, body, act, sev], i) => `<div class="ck-c ${sev}" style="animation-delay:${i * 60}ms"><h5>${esc(k)}</h5><div class="ck-b">${body}</div>${act ? `<div class="ck-a">${act}</div>` : ''}</div>`).join('');
  $('#ck-fix').innerHTML = fixes.length ? `<h5>fix these first</h5>${fixes.slice(0, 5).map(([t, c], i) => `<div class="ck-f" style="animation-delay:${200 + i * 70}ms"><span>${i + 1}</span><p>${esc(t)}</p><button type="button" class="btn ghost sm" data-run="${esc(c)}">${esc(c.split(' ')[0])}</button></div>`).join('')}` : '<h5>nothing urgent</h5><p class="d">keep doing what you are doing.</p>';
}
export function openCheck(addr) { showTab('check'); checkup(addr); }
def('checkup', 'privacy', 'checkup [address]', 'one page that audits a wallet and this browser together: exposure, threats, approvals, fingerprint, this tab, your signer, and the fixes in order', async a => {
  if (a[0] && !isAddr(a[0])) throw new Error('That is not a Solana address.'); openCheck(a[0] || null);
}, ['audit', 'check']);
addEventListener('st3:win', e => { if (e.detail === 'check' && !$('#ck-grid')) checkup(null); });
SG.onSigner(() => { if (document.body.dataset.win === 'check') checkup(null); });

// ---------------------------------------------------------------- follow: a live tail on any wallet
const FOL = new Map();
const amtS = n => n === 0 ? '0' : n < .001 ? n.toExponential(1) : String(+n.toFixed(4));
function moveLine(addr, m) {
  const dir = m.dir === 'in' ? '<span class="up">↓ in </span>' : '<span class="dn">↑ out</span>';
  const who = m.label ? `<b>${esc(m.label)}</b>` : m.cp ? `<span class="tok" data-run="trace ${esc(m.cp)}">${esc(short(m.cp))}</span>` : '<span class="f">?</span>';
  return `<span class="fol-dot"></span><span class="f">${new Date(m.t * 1000).toLocaleTimeString('en-GB')}</span> <span class="c">${esc(short(addr))}</span> ${dir} <b>${amtS(m.amount)} ${esc(m.sym || 'tokens')}</b> <span class="f">${m.dir === 'in' ? 'from' : 'to'}</span> ${who} <a href="https://solscan.io/tx/${esc(m.sig)}" target="_blank" rel="noopener noreferrer">tx ↗</a>`;
}
function paintFol() { const el = document.getElementById('st-fol'); if (el) { el.hidden = !FOL.size; el.innerHTML = FOL.size ? `<i class="live"></i>following ${FOL.size}` : ''; } }
function stopFollow(addr, why) { const F = FOL.get(addr); if (!F) return line(`<span class="m">not following</span> <span class="c">${esc(short(addr))}</span>`); clearInterval(F.timer); FOL.delete(addr); line(`<span class="f">· no longer following ${esc(short(addr))}${why ? ' · ' + esc(why) : ''}</span>`); paintFol(); }
async function pollFollow(addr) {
  const F = FOL.get(addr); if (!F) return;
  if (Date.now() - F.since > 30 * 60e3) return stopFollow(addr, 'stopped after 30 minutes. follow it again to keep going');
  try {
    const r = await api('moves', { params: { addr } }); const fresh = r.moves.filter(m => !F.seen.has(m.sig)).reverse();
    for (const m of fresh) { F.seen.add(m.sig); line(moveLine(addr, m), 'fol'); }
    if (fresh.length) { toast(`${short(addr)} moved · ${fresh.length} new`); try { window.__st3Sound && window.__st3Sound.tick(1500, .03); } catch { } }
    F.err = 0;
  } catch (e) { F.err = (F.err || 0) + 1; if (F.err === 1) line(`<span class="w">!</span> <span class="m">follow ${esc(short(addr))}: ${esc(e.message)}</span>`); if (F.err >= 3) stopFollow(addr, 'stopped after three failed reads'); }
}
def('follow', 'privacy', 'follow <wallet>', 'a live tail on any wallet: every transfer in or out prints in the console as it lands, labelled. up to three at once', async a => {
  const addr = a[0]; if (!addr || !isAddr(addr)) throw new Error('Try: follow <wallet address>');
  if (FOL.has(addr)) return line(`<span class="m">already following</span> <span class="c">${esc(short(addr))}</span>`);
  if (FOL.size >= 3) throw new Error('Following three already. unfollow one first.');
  const sp = spinner(`reading the newest moves of ${esc(short(addr))}`); let r;
  try { r = await api('moves', { params: { addr } }); } catch (e) { sp.fail(esc(e.message)); return; }
  sp.done(`<span class="o">✓</span> ${dots('follow', `<span class="c">${esc(short(addr))}</span> <span class="f">· live every 15 s · unfollow to stop</span>`)}`);
  const F = { seen: new Set(r.moves.map(m => m.sig)), since: Date.now(), timer: 0, err: 0 }; FOL.set(addr, F);
  r.moves.slice(0, 5).reverse().forEach(m => line(moveLine(addr, m), 'fol old'));
  F.timer = setInterval(() => { if (!document.hidden) pollFollow(addr); }, 15000); paintFol();
}, ['tail']);
def('unfollow', 'privacy', 'unfollow [wallet]', 'stop following a wallet, or all of them', async a => { if (!FOL.size) return line('<span class="m">not following anything.</span>'); if (a[0]) return stopFollow(a[0]); for (const k of [...FOL.keys()]) stopFollow(k); });
