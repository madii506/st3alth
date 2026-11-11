// st3alth · room tone and pad, synthesized (the same voice as the intro)
const N2F = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n), k = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3]) - 4) * 12; return 440 * Math.pow(2, k / 12); };
export function createSound() {
  let ctx = null, master = null, dry = null, send = null, droneG = null, strG = null, wob = null, whisper = null, drift = 0, live = [];
  const C = () => ctx;
  function ir(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8) * (i < ctx.sampleRate * .012 ? i / (ctx.sampleRate * .012) : 1); } }
    return b;
  }
  function start() {
    if (ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp); master.gain.linearRampToValueAtTime(.85, ctx.currentTime + 1.2);
    const rev = ctx.createConvolver(); rev.buffer = ir(5.5); const wet = ctx.createGain(); wet.gain.value = .62; rev.connect(wet).connect(master);
    send = ctx.createGain(); send.gain.value = 1; send.connect(rev); dry = ctx.createGain(); dry.gain.value = .9; dry.connect(master);
    // the room: two low sines that beat slowly, and filtered noise like air in a big space
    droneG = ctx.createGain(); droneG.gain.value = 0; droneG.connect(dry);
    for (const [f, g] of [[48.99, .14], [49.4, .11], [98.1, .03]]) { const o = ctx.createOscillator(); o.frequency.value = f; const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg).connect(droneG); o.start(); }
    const nb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = nb.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .2965; b2 = .57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * .1848) * .11; }
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360; const ng = ctx.createGain(); ng.gain.value = .45;
    ns.connect(lp).connect(ng).connect(droneG); ns.start(); live.push(ns);
    droneG.gain.linearRampToValueAtTime(.85, ctx.currentTime + 2.5);
    // a whisper: noise through a narrow band that wanders, like wind through a gap, mostly in the reverb
    const ws = ctx.createBufferSource(); ws.buffer = nb; ws.loop = true; ws.playbackRate.value = .7; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.value = 900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = .11; const lg = ctx.createGain(); lg.gain.value = 520; lfo.connect(lg).connect(bp.frequency); lfo.start();
    whisper = ctx.createGain(); whisper.gain.value = 0; ws.connect(bp).connect(whisper); whisper.connect(send); ws.start(); live.push(ws);
    whisper.gain.linearRampToValueAtTime(.32, ctx.currentTime + 4);
    // the strings bus, and the tape wobble every music-box note is tied to
    strG = ctx.createGain(); strG.gain.value = 0; const sl = ctx.createBiquadFilter(); sl.type = 'lowpass'; sl.frequency.value = 700; sl.Q.value = .6; strG.connect(sl); sl.connect(dry); sl.connect(send);
    wob = ctx.createGain(); wob.gain.value = 16; const wl = ctx.createOscillator(); wl.frequency.value = .37; wl.connect(wob); wl.start();
  }
  function noise(len) { const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; return s; }
  // a music-box tine: a sine with a few slightly wrong partials, a fast strike, a long ring, detuned and wobbling
  function box(note, vel = 1, low = false) {
    if (!ctx) return; const t = ctx.currentTime, f = N2F(note) * (low ? .5 : 1), g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.13 * vel, t + .004); g.gain.exponentialRampToValueAtTime(.0006, t + (low ? 3.4 : 2.6));
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = low ? 90 : 260; g.connect(hp); hp.connect(dry); const sg = ctx.createGain(); sg.gain.value = 1.25; hp.connect(sg).connect(send);
    for (const [m, a] of [[1, 1], [2.003, .32], [3.012, .2], [5.07, .07], [7.3, .025]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m; o.detune.value = (Math.random() - .5) * 18 + drift; wob.connect(o.detune); const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + 3.5); }
    const tk = noise(.012), tg = ctx.createGain(); tg.gain.setValueAtTime(.05 * vel, t); tg.gain.exponentialRampToValueAtTime(.0005, t + .012); const tf = ctx.createBiquadFilter(); tf.type = 'highpass'; tf.frequency.value = 4000; tk.connect(tf).connect(tg).connect(dry); tk.start(t);
  }
  // low strings: two saws a semitone apart, slow in, beating against each other
  let str = [];
  function strings(i) {
    if (!ctx) return; const t = ctx.currentTime, sets = [['A1', 'Bb1'], ['F1', 'Gb1'], ['A1', 'Bb1', 'E5', 'F5']];
    str.forEach(o => { o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value, t); o.g.gain.linearRampToValueAtTime(0, t + 1.6); o.o.stop(t + 1.8); }); str = [];
    for (const n of sets[i] || sets[0]) { const hi = /5$/.test(n), o = ctx.createOscillator(); o.type = hi ? 'sine' : 'sawtooth'; o.frequency.value = N2F(n); o.detune.value = (Math.random() - .5) * 8;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(hi ? .016 : .055, t + 2.2); o.connect(g).connect(hi ? send : strG); o.start(t); str.push({ o, g }); }
    strG.gain.cancelScheduledValues(t); strG.gain.setValueAtTime(strG.gain.value, t); strG.gain.linearRampToValueAtTime(1, t + 1.5);
  }
  // a fluorescent tube catching: a click, then a short buzz
  function click(level = 1) {
    if (!ctx) return; const t = ctx.currentTime;
    const n = noise(.05), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.4; const g = ctx.createGain();
    g.gain.setValueAtTime(.18 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); n.connect(bp).connect(g).connect(dry); n.start(t);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 6; const hg = ctx.createGain();
    hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(.014 * level, t + .03); hg.gain.exponentialRampToValueAtTime(.0005, t + .9); o.connect(f).connect(hg).connect(dry); o.start(t); o.stop(t + 1);
  }
  function boom() { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.4); const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + 2.2); o.connect(g); g.connect(dry); g.connect(send); o.start(t); o.stop(t + 2.4); }
  function beat() {
    if (!ctx) return; const t = ctx.currentTime;
    for (const [dt, f, a] of [[0, 62, .55], [.24, 54, .38]]) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(f * .55, t + dt + .2); const g = ctx.createGain(); g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(a, t + dt + .015); g.gain.exponentialRampToValueAtTime(.001, t + dt + .32); o.connect(g).connect(dry); o.start(t + dt); o.stop(t + dt + .4); }
  }
  // the dive: everything rises together (the music box winds down underneath), then a hard cut to nothing
  function swell(len = 1.35) {
    if (!ctx) return; const t = ctx.currentTime;
    drift = -40; const n = noise(len + .3), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .8; bp.frequency.setValueAtTime(160, t); bp.frequency.exponentialRampToValueAtTime(3200, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3, t + len); n.connect(bp).connect(g); g.connect(dry); g.connect(send); n.start(t); n.stop(t + len + .05);
    for (const st of [220, 233.08, 329.63]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(st, t); o.frequency.exponentialRampToValueAtTime(st * 2.2, t + len); const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(.035, t + len); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(5000, t + len); o.connect(f).connect(og); og.connect(dry); og.connect(send); o.start(t); o.stop(t + len + .02); }
    droneG.gain.cancelScheduledValues(t); droneG.gain.setValueAtTime(droneG.gain.value, t); droneG.gain.linearRampToValueAtTime(1.4, t + len);
    strG.gain.cancelScheduledValues(t); strG.gain.setValueAtTime(strG.gain.value, t); strG.gain.linearRampToValueAtTime(1.8, t + len);
  }
  function cut() {
    if (!ctx) return; const t = ctx.currentTime;
    for (const g of [droneG, strG, whisper]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0, t + .01); }
    str.forEach(o => { try { o.o.stop(t + .02); } catch {} }); str = [];
    master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + .03); master.gain.setValueAtTime(0, t + .6); master.gain.linearRampToValueAtTime(.85, t + 1.6);
  }
  // after the dive: a soft, slow pad under the terminal
  function pad() {
    if (!ctx) return; const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = 0; g.connect(dry); g.connect(send);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g);
    const chords = [[146.83, 220, 277.18, 329.63], [130.81, 196, 246.94, 293.66], [110, 164.81, 220, 261.63], [123.47, 185, 233.08, 293.66]];
    chords.forEach((ch, ci) => ch.forEach(f => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = 0; o.connect(og).connect(lp); o.start(t);
      for (let rep = 0; rep < 40; rep++) { const s = t + 1 + (rep * 4 + ci) * 6; og.gain.setValueAtTime(0, s); og.gain.linearRampToValueAtTime(.03, s + 2.5); og.gain.linearRampToValueAtTime(0, s + 6.5); } }));
    g.gain.linearRampToValueAtTime(.45, t + 3);
  }
  return { start, box, strings, click, boom, beat, swell, cut, pad, whoosh: swell, ctx: C, setMuted(m) { if (master) master.gain.setTargetAtTime(m ? 0 : .85, ctx.currentTime, .08); } };
}

