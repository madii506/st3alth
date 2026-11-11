// st3alth · candles on a canvas: price, volume, a crosshair, the last price line. Monochrome, like the rest.
export function drawChart(cv, candles, { hover = null } = {}) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!candles || candles.length < 2) { g.fillStyle = '#56554f'; g.font = '12px JB, monospace'; g.fillText('no candles yet', 12, 22); return null; }
  const padR = 74, padB = 22, volH = Math.max(36, H * .16), top = 10, ph = H - padB - volH - top - 6, pw = W - padR - 6;
  const n = candles.length, cw = pw / n;
  let lo = Infinity, hi = -Infinity, vmax = 0;
  for (const c of candles) { lo = Math.min(lo, c[3]); hi = Math.max(hi, c[2]); vmax = Math.max(vmax, c[5]); }
  if (hi === lo) { hi *= 1.01; lo *= .99; }
  const padP = (hi - lo) * .08; hi += padP; lo -= padP;
  const y = p => top + (hi - p) / (hi - lo) * ph, x = i => 4 + i * cw + cw / 2;
  // grid + price scale
  g.strokeStyle = '#141418'; g.lineWidth = 1; g.fillStyle = '#56554f'; g.font = '11px JB, monospace'; g.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) { const p = lo + (hi - lo) * i / 5, yy = Math.round(y(p)) + .5; g.beginPath(); g.moveTo(0, yy); g.lineTo(pw + 4, yy); g.stroke(); g.fillText(fmt(p), pw + 12, yy); }
  // time labels
  g.textBaseline = 'alphabetic'; const step = Math.max(1, Math.round(n / 6));
  for (let i = 0; i < n; i += step) { const d = new Date(candles[i][0] * 1000), lab = span(candles) > 86400 * 2 ? `${d.getMonth() + 1}/${d.getDate()}` : d.toTimeString().slice(0, 5); g.fillText(lab, x(i) - 16, H - 6); }
  // volume
  for (let i = 0; i < n; i++) { const c = candles[i], up = c[4] >= c[1], vh = vmax ? (c[5] / vmax) * volH : 0; g.fillStyle = up ? 'rgba(236,235,230,.16)' : 'rgba(255,157,157,.16)'; g.fillRect(x(i) - cw * .36, H - padB - vh, Math.max(1, cw * .72), vh); }
  // candles: up are solid light, down are hollow red
  for (let i = 0; i < n; i++) {
    const c = candles[i], up = c[4] >= c[1], xx = x(i), bw = Math.max(1, cw * .64);
    g.strokeStyle = up ? '#d9d8d2' : '#ff9d9d'; g.beginPath(); g.moveTo(Math.round(xx) + .5, y(c[2])); g.lineTo(Math.round(xx) + .5, y(c[3])); g.stroke();
    const y1 = y(Math.max(c[1], c[4])), y2 = y(Math.min(c[1], c[4])), bh = Math.max(1, y2 - y1);
    if (up) { g.fillStyle = '#ecebe6'; g.fillRect(xx - bw / 2, y1, bw, bh); } else { g.fillStyle = '#040405'; g.fillRect(xx - bw / 2, y1, bw, bh); g.strokeRect(Math.round(xx - bw / 2) + .5, Math.round(y1) + .5, Math.max(1, Math.round(bw) - 1), Math.max(1, Math.round(bh) - 1)); }
  }
  // last price
  const last = candles[n - 1][4], ly = Math.round(y(last)) + .5;
  g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(0, ly); g.lineTo(pw + 4, ly); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#fff'; g.fillRect(pw + 6, ly - 9, padR - 8, 18); g.fillStyle = '#000'; g.textBaseline = 'middle'; g.fillText(fmt(last), pw + 11, ly);
  // crosshair
  let info = null;
  if (hover) {
    const i = Math.max(0, Math.min(n - 1, Math.floor((hover.x - 4) / cw))), c = candles[i]; info = { i, c };
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(Math.round(x(i)) + .5, top); g.lineTo(Math.round(x(i)) + .5, H - padB); g.stroke();
    if (hover.y > top && hover.y < top + ph) { g.beginPath(); g.moveTo(0, Math.round(hover.y) + .5); g.lineTo(pw + 4, Math.round(hover.y) + .5); g.stroke(); const p = hi - (hover.y - top) / ph * (hi - lo); g.fillStyle = '#25252b'; g.fillRect(pw + 6, hover.y - 9, padR - 8, 18); g.fillStyle = '#fff'; g.fillText(fmt(p), pw + 11, hover.y); }
  }
  return info;
}
function span(c) { return c[c.length - 1][0] - c[0][0]; }
function fmt(p) { if (p >= 1000) return p.toFixed(0); if (p >= 1) return p.toFixed(3); if (p >= .01) return p.toFixed(5); const z = Math.floor(-Math.log10(p)); return p.toFixed(Math.min(12, z + 3)); }
// a small sparkline for token reports
export function spark(cv, closes) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth || 300, H = cv.clientHeight || 46; cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); if (!closes || closes.length < 2) return;
  const lo = Math.min(...closes), hi = Math.max(...closes) || 1, up = closes[closes.length - 1] >= closes[0];
  const pts = closes.map((v, i) => [i / (closes.length - 1) * (W - 2) + 1, H - 3 - (hi === lo ? .5 : (v - lo) / (hi - lo)) * (H - 6)]);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, up ? 'rgba(157,240,189,.22)' : 'rgba(255,157,157,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineTo(W - 1, H); g.lineTo(1, H); g.closePath(); g.fillStyle = gr; g.fill();
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = up ? '#9df0bd' : '#ff9d9d'; g.lineWidth = 1.4; g.stroke();
}
