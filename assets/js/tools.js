// st3alth · tools that never leave your tab.
//   fingerprint  what this browser tells every site without asking, hashed the way trackers hash it
//   strip        what a photo gives away (gps, camera, serials, time, software) and a verified clean copy
//   approvals    token accounts that let someone else move your tokens, revoked in one signature
// fingerprint and strip never call the network: every byte is read and written in this tab.
import { $, esc, line, block, spinner, dots, toast, api, short, SEEN, isAddr } from './core.js?v=2';
import { def, showTab, signAndSend } from './cmds.js?v=2';
import * as SG from './signer.js?v=2';

const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? new TextEncoder().encode(s) : s));
const kb = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';

// ---------------------------------------------------------------- fingerprint
function uaShort() {
  const u = navigator.userAgent;
  const b = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'a browser';
  const v = (u.match(/(?:Edg|OPR|Firefox|Chrome|Version)\/(\d+)/) || [])[1];
  const os = /iPhone|iPad/.test(u) ? 'iOS' : /Windows NT/.test(u) ? 'Windows' : /Mac OS X/.test(u) ? 'macOS' : /Android/.test(u) ? 'Android' : /CrOS/.test(u) ? 'ChromeOS' : /Linux/.test(u) ? 'Linux' : 'an unknown system';
  return `${b}${v ? ' ' + v : ''} on ${os}`;
}
function canvasPrint() {
  const c = document.createElement('canvas'); c.width = 300; c.height = 64; const g = c.getContext('2d');
  g.textBaseline = 'top'; g.font = "15px 'Arial'"; g.fillStyle = '#f60'; g.fillRect(110, 2, 70, 22);
  g.fillStyle = '#069'; g.fillText('st3alth · put on the mask ◐', 3, 16); g.fillStyle = 'rgba(102,204,0,.7)'; g.fillText('st3alth · put on the mask ◐', 5, 18);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(255,0,255)'; g.beginPath(); g.arc(52, 40, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgb(0,255,255)'; g.beginPath(); g.arc(78, 40, 30, 0, Math.PI * 2); g.fill();
  return c.toDataURL();
}
function webgl() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl'); if (!gl) return null;
    const d = gl.getExtension('WEBGL_debug_renderer_info'), r = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return String(r || '');
  } catch { return null; }
}
async function audioPrint() {
  try {
    const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) return null;
    const ctx = new C(1, 5000, 44100), o = ctx.createOscillator(), k = ctx.createDynamicsCompressor();
    o.type = 'triangle'; o.frequency.value = 10000; k.threshold.value = -50; k.knee.value = 40; k.ratio.value = 12; k.attack.value = 0; k.release.value = .25;
    o.connect(k); k.connect(ctx.destination); o.start(0); const b = await ctx.startRendering(), d = b.getChannelData(0);
    let s = 0; for (let i = 4500; i < 5000; i++) s += Math.abs(d[i]); return s.toFixed(10);
  } catch { return null; }
}
const FONTS = ['Arial', 'Helvetica Neue', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact', 'Tahoma', 'Segoe UI', 'Calibri', 'Cambria', 'Consolas', 'Menlo', 'Monaco', 'SF Pro Text', 'Lucida Grande', 'Roboto', 'Ubuntu', 'Cantarell', 'DejaVu Sans', 'Noto Sans', 'Fira Code', 'Source Code Pro', 'Inter', 'Futura', 'Gill Sans', 'Optima', 'Avenir', 'Century Gothic', 'Baskerville', 'Didot', 'Franklin Gothic Medium', 'Liberation Sans', 'Bahnschrift', 'Candara'];
function fonts() {
  const g = document.createElement('canvas').getContext('2d'), t = 'mmmmmmmmmmlli10OQW@', base = ['monospace', 'sans-serif', 'serif'];
  const w = f => { g.font = `64px ${f}`; return g.measureText(t).width; }, B = base.map(w);
  return FONTS.filter(f => base.some((b, i) => w(`'${f}',${b}`) !== B[i]));
}
export async function readPrint() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '—', off = -new Date().getTimezoneOffset() / 60;
  const [cv, au] = await Promise.all([sha(canvasPrint()), audioPrint().then(v => v ? sha(v) : null)]), f = fonts(), gl = webgl();
  const rows = [
    ['browser', uaShort(), 'sent with every request'],
    ['system', (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '—', ''],
    ['languages', (navigator.languages || [navigator.language]).join(', '), 'order matters'],
    ['time zone', `${tz} · utc${off >= 0 ? '+' : ''}${off}`, 'roughly where you are'],
    ['screen', `${screen.width}×${screen.height} · ${devicePixelRatio}x · ${screen.colorDepth}-bit`, ''],
    ['cores · memory', `${navigator.hardwareConcurrency || '—'} cores · ${navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'hidden'}`, ''],
    ['touch', navigator.maxTouchPoints ? navigator.maxTouchPoints + ' points' : 'none', ''],
    ['graphics', gl || 'hidden', 'your exact gpu'],
    ['canvas', cv.slice(0, 16), 'how your machine draws text'],
    ['audio', au ? au.slice(0, 16) : 'hidden', 'how your machine processes sound'],
    ['fonts', f.length ? `${f.length} of ${FONTS.length} found · ${f.slice(0, 4).join(', ')}${f.length > 4 ? '…' : ''}` : 'none of the common ones', 'installed fonts are rare'],
    ['do not track', `${navigator.doNotTrack === '1' ? 'on' : 'off'} · gpc ${navigator.globalPrivacyControl ? 'on' : 'off'}`, 'asking not to be tracked is itself a clue'],
  ];
  const id = await sha(rows.map(r => r[0] + '=' + r[1]).join('|'));
  return { rows, id, window: `${innerWidth}×${innerHeight}` };
}
def('fingerprint', 'privacy', 'fingerprint', 'what this browser tells every site without asking, hashed the way trackers do. worked out here, sent nowhere', async () => {
  const sp = spinner('reading what any site can read, without asking');
  const P = await readPrint(), idf = P.id.slice(0, 12).replace(/(.{4})(?=.)/g, '$1·');
  sp.done(`<span class="o">✓</span> ${dots('fingerprint', `<span class="c">${idf}</span> <span class="f">· ${P.rows.length} signals</span>`)}`);
  block('your browser fingerprint', `
    <div class="fpid"><span>fp</span><b>${idf}</b><em>the same on every site you visit · it survives clearing cookies, a new wallet and a private window</em></div>
    <div class="fpt">${P.rows.map(([k, v, n], i) => `<div style="animation-delay:${i * 45}ms"><span>${esc(k)}</span><b>${esc(v)}</b><i>${esc(n)}</i></div>`).join('')}</div>
    <div class="rvl"><i></i><div><b>worked out in this tab, sent nowhere.</b> any site can read all of this in a few milliseconds. to blur it: a browser that randomizes canvas and audio (brave, mullvad browser, tor browser), a default window size, no extra fonts, and a <span class="tok" data-run="burner new">burner</span> for every site you do not trust.</div></div>`);
}, ['fp', 'browser']);

// ---------------------------------------------------------------- strip: exif, gps, xmp, iptc, comments, png text
const ascii = (dv, o, n) => { let s = ''; for (let i = 0; i < n && o + i < dv.byteLength; i++) s += String.fromCharCode(dv.getUint8(o + i)); return s; };
const T0 = { 0x010F: 'make', 0x0110: 'model', 0x0131: 'software', 0x0132: 'changed', 0x013B: 'artist', 0x8298: 'copyright', 0x010E: 'description', 0xA430: 'owner' };
const TX = { 0x9003: 'taken', 0x9010: 'utc offset', 0xA434: 'lens', 0xA433: 'lens make', 0xA431: 'camera serial', 0xA435: 'lens serial', 0xA420: 'image id', 0xA430: 'owner' };
function readTiff(dv, base) {
  const le = dv.getUint16(base) === 0x4949, u16 = o => dv.getUint16(base + o, le), u32 = o => dv.getUint32(base + o, le), SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  if (u16(2) !== 42) return null;
  const val = (type, count, at) => {
    const n = (SZ[type] || 1) * count, p = n > 4 ? u32(at) : at;
    if (type === 2) { let s = ''; for (let i = 0; i < Math.min(count, 200); i++) { const ch = dv.getUint8(base + p + i); if (!ch) break; s += String.fromCharCode(ch); } return s.trim(); }
    if (type === 1 || type === 7) return dv.getUint8(base + p);
    if (type === 3) return u16(p); if (type === 4) return u32(p);
    if (type === 5 || type === 10) { const a = []; for (let i = 0; i < Math.min(count, 4); i++) { const nu = type === 5 ? u32(p + i * 8) : dv.getInt32(base + p + i * 8, le), de = type === 5 ? u32(p + i * 8 + 4) : dv.getInt32(base + p + i * 8 + 4, le); a.push(de ? nu / de : 0); } return count === 1 ? a[0] : a; }
    return null;
  };
  const out = { tags: 0 }, gps = {};
  const walk = (off, map, into, depth) => {
    if (depth > 2 || off <= 0 || base + off + 2 > dv.byteLength) return;
    const n = u16(off);
    for (let i = 0; i < n && i < 400; i++) {
      const e = off + 2 + i * 12; if (base + e + 12 > dv.byteLength) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4); out.tags++;
      try {
        if (tag === 0x8769) walk(u32(e + 8), TX, out, depth + 1);
        else if (tag === 0x8825) walk(u32(e + 8), null, gps, depth + 1);
        else if (map && map[tag]) into[map[tag]] = val(type, count, e + 8);
        else if (!map) into[tag] = val(type, count, e + 8);
      } catch { }
    }
  };
  walk(u32(4), T0, out, 0);
  const dms = a => Array.isArray(a) ? a[0] + (a[1] || 0) / 60 + (a[2] || 0) / 3600 : null;
  if (gps[2] && gps[4]) { const la = dms(gps[2]) * (gps[1] === 'S' ? -1 : 1), lo = dms(gps[4]) * (gps[3] === 'W' ? -1 : 1); if (isFinite(la) && isFinite(lo) && (la || lo)) out.gps = { lat: la, lon: lo, alt: typeof gps[6] === 'number' ? gps[6] : null }; }
  return out;
}
export function readMeta(buf) {
  const dv = new DataView(buf), r = { kind: null, exif: null, xmp: false, iptc: false, comment: null, text: [], icc: false, bytes: 0 };
  try {
    if (dv.getUint16(0) === 0xFFD8) {
      r.kind = 'jpeg'; let o = 2;
      while (o + 4 <= dv.byteLength && dv.getUint8(o) === 0xFF) {
        const m = dv.getUint8(o + 1); if (m === 0xDA || m === 0xD9) break; const len = dv.getUint16(o + 2);
        if (m === 0xE1 && ascii(dv, o + 4, 6) === 'Exif\0\0') { r.exif = readTiff(dv, o + 10); r.bytes += len; }
        else if (m === 0xE1 && ascii(dv, o + 4, 29).startsWith('http://ns.adobe.com/xap/1.0/')) { r.xmp = true; r.bytes += len; }
        else if (m === 0xED) { r.iptc = true; r.bytes += len; }
        else if (m === 0xE2 && ascii(dv, o + 4, 11) === 'ICC_PROFILE') { r.icc = true; }
        else if (m === 0xFE) { r.comment = ascii(dv, o + 4, Math.min(len - 2, 140)).replace(/\0/g, '').trim(); r.bytes += len; }
        else if (m >= 0xE3 && m <= 0xEF) r.bytes += len;
        o += 2 + len;
      }
    } else if (dv.getUint32(0) === 0x89504E47) {
      r.kind = 'png'; let o = 8;
      while (o + 8 <= dv.byteLength) {
        const len = dv.getUint32(o), type = ascii(dv, o + 4, 4);
        if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') { let k = ''; for (let i = 0; i < 80 && dv.getUint8(o + 8 + i); i++) k += String.fromCharCode(dv.getUint8(o + 8 + i)); r.text.push(k); if (/xml:com\.adobe\.xmp/i.test(k)) r.xmp = true; r.bytes += len + 12; }
        else if (type === 'eXIf') { r.exif = readTiff(dv, o + 8); r.bytes += len + 12; }
        else if (type === 'tIME') r.bytes += len + 12;
        if (type === 'IEND') break; o += 12 + len;
      }
    } else if (ascii(dv, 0, 4) === 'RIFF' && ascii(dv, 8, 4) === 'WEBP') {
      r.kind = 'webp'; let o = 12;
      while (o + 8 <= dv.byteLength) {
        const type = ascii(dv, o, 4), len = dv.getUint32(o + 4, true);
        if (type === 'EXIF') { const st = ascii(dv, o + 8, 6) === 'Exif\0\0' ? o + 14 : o + 8; r.exif = readTiff(dv, st); r.bytes += len; }
        else if (type === 'XMP ') { r.xmp = true; r.bytes += len; }
        o += 8 + len + (len & 1);
      }
    }
  } catch { }
  return r;
}
function metaRows(M) {
  const E = M.exif || {}, rows = [];
  if (E.gps) rows.push(['hi', 'where you were', `${E.gps.lat.toFixed(5)}, ${E.gps.lon.toFixed(5)}${E.gps.alt != null ? ` · ${Math.round(E.gps.alt)} m up` : ''}`, 'gps to a few meters. a home, an office, a hotel.']);
  if (E.make || E.model) rows.push(['mid', 'the camera', [E.make, E.model].filter(Boolean).join(' '), 'links this photo to every other one from the same phone']);
  if (E['camera serial'] || E['lens serial']) rows.push(['hi', 'serial numbers', [E['camera serial'], E['lens serial']].filter(Boolean).join(' · '), 'unique to your device']);
  if (E.lens) rows.push(['lo', 'lens', E.lens, '']);
  if (E.taken || E.changed) rows.push(['mid', 'when', E.taken || E.changed, 'to the second']);
  if (E['utc offset']) rows.push(['mid', 'time zone', E['utc offset'], '']);
  if (E.software) rows.push(['lo', 'software', E.software, 'the app and often its version']);
  if (E.artist || E.owner || E.copyright) rows.push(['hi', 'a name', [E.artist, E.owner, E.copyright].filter(Boolean).join(' · '), 'written into the file']);
  if (E['image id']) rows.push(['mid', 'image id', E['image id'], '']);
  if (M.xmp) rows.push(['mid', 'edit history (xmp)', 'present', 'can carry tools, dates and file paths']);
  if (M.iptc) rows.push(['mid', 'captions and credits (iptc)', 'present', '']);
  if (M.comment) rows.push(['mid', 'a comment', M.comment, '']);
  if (M.text.length) rows.push(['mid', 'text chunks', M.text.slice(0, 4).join(', '), 'png notes, often the app that made it']);
  return rows;
}
async function cleanCopy(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
  const type = /png/.test(file.type) ? 'image/png' : /webp/.test(file.type) ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('could not re-encode')), type, .93));
  return { blob, w: c.width, h: c.height, type };
}
const URLS = [];
export async function stripFile(file) {
  showTab('out');
  if (!file || !/^image\//.test(file.type)) return line('<span class="r">✗</span> <span class="m">that is not a photo. try a jpg, png or webp.</span>');
  if (/hei[cf]/i.test(file.type)) return line('<span class="w">!</span> <span class="m">heic photos cannot be opened in a browser. export it as jpg first (it will still carry gps), then strip that.</span>');
  const sp = spinner(`reading ${esc(file.name || 'the photo')} · ${kb(file.size)} · here, in this tab`);
  try {
    const M = readMeta(await file.arrayBuffer()), rows = metaRows(M), C = await cleanCopy(file), M2 = readMeta(await C.blob.arrayBuffer()), left = metaRows(M2).length + (M2.exif ? M2.exif.tags : 0);
    const u = URL.createObjectURL(C.blob), name = (file.name || 'photo').replace(/\.[a-z0-9]+$/i, '') + '-clean.' + (C.type === 'image/png' ? 'png' : C.type === 'image/webp' ? 'webp' : 'jpg'); URLS.push(u);
    sp.done(`<span class="o">✓</span> ${dots('photo', `<span class="c">${rows.length ? rows.length + ' thing' + (rows.length === 1 ? '' : 's') + ' it gives away' : 'nothing hidden found'}</span> <span class="f">· ${M.exif ? M.exif.tags + ' exif tags · ' : ''}${kb(M.bytes)} of metadata</span>`)}`);
    block(`strip · ${esc(file.name || 'photo')}`, `
      <div class="stp"><img src="${u}" alt=""><div>
        ${rows.length ? `<div class="stl">${rows.map(([sev, k, v, n], i) => `<div class="${sev}" style="animation-delay:${i * 60}ms"><span>${esc(k)}</span><b>${esc(String(v))}</b><i>${esc(n)}</i></div>`).join('')}</div>` : '<p class="d">no gps, camera or names found in this file. a clean copy below drops anything we could not read too.</p>'}
        <div class="stc"><span class="${left ? 'w' : 'o'}">${left ? '!' : '✓'}</span> clean copy: <b>${left ? left + ' tags left' : '0 metadata tags'}</b> <span class="f">· ${C.w}×${C.h} · ${kb(C.blob.size)} · checked by reading it back</span></div>
        <div class="row" style="margin-top:12px"><a class="btn" href="${u}" download="${esc(name)}">save clean copy</a><button type="button" class="btn ghost sm" data-run="strip">strip another</button></div>
      </div></div>`);
  } catch (e) { sp.fail(`could not read this photo · ${esc(e.message || 'unknown format')}`); }
}
function pickFile() { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { if (i.files[0]) stripFile(i.files[0]); }; i.click(); }
def('strip', 'privacy', 'strip', 'see what a photo gives away (gps, camera, serials, time) and save a clean copy. it never leaves your tab. or drop a photo anywhere', async () => {
  const b = block('strip a photo', `<div class="drop" data-pick><img src="/assets/mask.svg" alt=""><b>drop a photo here, or choose one</b><span>jpg, png or webp. read and cleaned in this tab, never uploaded.</span></div>`);
  b.querySelector('[data-pick]').onclick = pickFile;
}, ['exif', 'clean']);

// drop a photo anywhere on the terminal
let dragN = 0;
const hasFile = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
addEventListener('dragenter', e => { if (!hasFile(e)) return; dragN++; document.body.classList.add('dropping'); });
addEventListener('dragleave', e => { if (!hasFile(e)) return; dragN = Math.max(0, dragN - 1); if (!dragN) document.body.classList.remove('dropping'); });
addEventListener('dragover', e => { if (hasFile(e)) e.preventDefault(); });
addEventListener('drop', e => { if (!hasFile(e)) return; e.preventDefault(); dragN = 0; document.body.classList.remove('dropping'); const f = [...e.dataTransfer.files].find(x => /^image\//.test(x.type)) || e.dataTransfer.files[0]; if (f) stripFile(f); });

// ---------------------------------------------------------------- approvals: standing permissions on your tokens
const KNOWN = { So11111111111111111111111111111111111111112: 'SOL', EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC', Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT', JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 'JUP', DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'BONK', EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: 'WIF' };
const symOf = m => { if (KNOWN[m]) return KNOWN[m]; for (const [k, v] of SEEN) if (v === m) return k.toUpperCase(); return short(m); };
const isAll = (amt, bal) => { const a = parseFloat(amt), b = parseFloat(bal); return !isFinite(a) || a >= 1e12 || (isFinite(b) && b > 0 && a >= b); };
def('approvals', 'privacy', 'approvals [address]', 'token accounts that let someone else move your tokens, and one signature that revokes them all', async a => {
  const s = SG.state(), who = a[0] || s.active;
  if (!who) return line('<span class="m">connect a wallet or make a burner, or give any address:</span> <span class="c">approvals &lt;address&gt;</span>');
  if (!isAddr(who)) throw new Error('That is not a Solana address.');
  const sp = spinner(`reading every token account of ${esc(short(who))}`); let r;
  try { r = await api('approvals', { params: { owner: who } }); } catch (e) { sp.fail(esc(e.message)); return; }
  const n = r.approvals.length;
  sp.done(`<span class="o">✓</span> ${dots('approvals', n ? `<span class="r">${n} open</span> <span class="f">· ${r.checked} token accounts checked</span>` : `<span class="c">none</span> <span class="f">· ${r.checked} token accounts checked</span>`)}`);
  if (!n) return line('<span class="o">✓</span> <span class="m">nobody else can move tokens out of this wallet.</span>');
  const mine = s.active === who;
  const b = block(`approvals · ${esc(short(who))}`, `
    <div class="apv">${r.approvals.map((x, i) => { const all = isAll(x.amount, x.balance); return `<div class="${all ? 'hi' : 'mid'}" style="animation-delay:${i * 60}ms"><b>${esc(symOf(x.mint))}</b><span>${all ? '<em>all of it</em>' : `${esc(x.amount)} <i>of ${esc(x.balance || '?')}</i>`}</span><span><i>can be moved by</i> ${x.label && x.label.name ? `<b>${esc(x.label.name)}</b>` : `<code>${esc(short(x.delegate))}</code> <i>unknown</i>`}</span></div>`; }).join('')}</div>
    <div class="rvl"><i></i><div><b>an approval is a standing permission.</b> whoever holds it can move those tokens later, without asking you again. drainers ask for one and wait. revoke what you do not use: it costs a fraction of a cent.</div></div>
    <div class="row" style="margin-top:12px">${mine ? `<button type="button" class="btn" data-rv-all>revoke ${n === 1 ? 'it' : 'all ' + n} · 1 signature</button>` : '<span class="d">connect this wallet to revoke them</span>'}</div><div class="err" data-err></div>`);
  const go = b.querySelector('[data-rv-all]');
  if (go) go.onclick = async () => {
    go.disabled = true; b.querySelector('[data-err]').textContent = '';
    try {
      const B = spinner('building one transaction that revokes them all'); let t;
      try { t = await api('revoke', { method: 'POST', body: { owner: who } }); } catch (e) { B.fail(esc(e.message)); throw e; }
      B.done(`<span class="o">✓</span> ${dots('revoke', `<span class="c">${t.n} approval${t.n === 1 ? '' : 's'} in one transaction</span>`)}`);
      await signAndSend(t.tx, 'revoke'); line('<span class="o">✓</span> <span class="m">revoked. run</span> <span class="tok c" data-run="approvals">approvals</span> <span class="m">again to see it clean.</span>');
    } catch (e) { b.querySelector('[data-err]').textContent = e.message; go.disabled = false; }
  };
}, ['allowances', 'delegates', 'revoke']);
