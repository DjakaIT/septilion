// BEAT — originalni ritmovi, generirani u pregledniku (Web Audio), prenijeto iz prototipa v4.
// Brzina ploče = brzina i visina zvuka. Stane ploča, stane ritam.
type Rec = { name: string; bpm: number; swing: number; lab: string; cut: number; kick: number[]; snare: number[]; ghost: number[]; hat: number[]; ohat: number[]; bass: [number, number][]; chords: number[][] };
const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
export const recs: Rec[] = [
  { name: 'Boom bap', bpm: 90, swing: 0.58, lab: '#FFCE53', cut: 2600, kick: [0, 7, 10], snare: [4, 12], ghost: [15], hat: [0, 2, 4, 6, 8, 10, 12, 14], ohat: [],
    bass: [[0, 33], [7, 33], [10, 29]], chords: [[57, 60, 64, 67], [53, 57, 60, 64]] },
  { name: 'Lo-fi', bpm: 78, swing: 0.62, lab: '#63CFFE', cut: 1500, kick: [0, 9, 10], snare: [4, 12], ghost: [7], hat: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14], ohat: [],
    bass: [[0, 29], [9, 29]], chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]] },
  { name: 'Funk', bpm: 100, swing: 0.53, lab: '#FF8800', cut: 3400, kick: [0, 3, 8, 11], snare: [4, 12], ghost: [7, 15], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], ohat: [6, 14],
    bass: [[0, 28], [3, 28], [6, 31], [8, 28], [11, 33], [14, 31]], chords: [[52, 56, 59, 62]] },
];

let ctx: AudioContext | null = null, out: GainNode, lp: BiquadFilterNode, nb: AudioBuffer, crackG: GainNode;
const sc: { o?: OscillatorNode; bp?: BiquadFilterNode; g?: GainNode } = {};
let rate = 0, next = 0, step = 0, timer = 0;
export const state = { rec: 0 };

function setup() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  out = ctx.createGain(); out.gain.value = 0.5;
  lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3;
  lp.connect(out); out.connect(ctx.destination);
  nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // pucketanje ploče
  const cb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), cd = cb.getChannelData(0);
  for (let i = 0; i < cd.length; i++) { cd[i] = (Math.random() * 2 - 1) * 0.012; if (Math.random() < 0.0006) cd[i] += (Math.random() * 2 - 1) * 0.7; }
  const crack = ctx.createBufferSource(); crack.buffer = cb; crack.loop = true;
  crackG = ctx.createGain(); crackG.gain.value = 0;
  const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 2200; cf.Q.value = 0.6;
  crack.connect(cf); cf.connect(crackG); crackG.connect(out); crack.start();
  // grebanje
  sc.o = ctx.createOscillator(); sc.o.type = 'sawtooth';
  sc.bp = ctx.createBiquadFilter(); sc.bp.type = 'bandpass'; sc.bp.Q.value = 5;
  sc.g = ctx.createGain(); sc.g.gain.value = 0;
  sc.o.connect(sc.bp); sc.bp.connect(sc.g); sc.g.connect(lp); sc.o.start();
  next = ctx.currentTime + 0.05;
  timer = window.setInterval(tick, 25);
}
function env(g: GainNode, t: number, peak: number, dec: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
}
function noise(t: number, dur: number, type: BiquadFilterType, f: number, peak: number, dec: number) {
  const c = ctx!, s = c.createBufferSource(); s.buffer = nb;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
  const g = c.createGain(); s.connect(fl); fl.connect(g); g.connect(lp); env(g, t, peak, dec); s.start(t, Math.random() * 0.5, dur);
}
function kick(t: number, r: number) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(150 * r, t); o.frequency.exponentialRampToValueAtTime(46 * r, t + 0.13);
  o.connect(g); g.connect(lp); env(g, t, 0.95, 0.34 / Math.max(r, 0.4)); o.start(t); o.stop(t + 0.5 / Math.max(r, 0.3));
}
function snare(t: number, r: number, v: number) {
  noise(t, 0.25, 'highpass', 1300 * r, v, 0.17 / Math.max(r, 0.4));
  const c = ctx!, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle';
  o.frequency.value = 188 * r; o.connect(g); g.connect(lp); env(g, t, v * 0.5, 0.09); o.start(t); o.stop(t + 0.2);
}
function hat(t: number, r: number, v: number, open: boolean) { noise(t, open ? 0.3 : 0.06, 'highpass', 7200 * Math.max(r, 0.5), v, open ? 0.22 : 0.035); }
function bass(t: number, f: number, dur: number) {
  const c = ctx!, o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f;
  fl.type = 'lowpass'; fl.frequency.value = 420; o.connect(fl); fl.connect(g); g.connect(lp); env(g, t, 0.42, dur); o.start(t); o.stop(t + dur + 0.05);
}
function chord(t: number, fs: number[], dur: number) {
  const c = ctx!;
  fs.forEach((f) => (['sine', 'triangle'] as OscillatorType[]).forEach((w, k) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = w; o.frequency.value = f; o.detune.value = k ? 5 : -3;
    o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }));
}
function tick() {
  if (!ctx) return;
  const R = recs[state.rec];
  lp.frequency.setTargetAtTime(R.cut * Math.max(0.35, Math.min(1, rate)), ctx.currentTime, 0.05);
  crackG.gain.setTargetAtTime(rate > 0.05 ? 0.9 : 0, ctx.currentTime, 0.08);
  if (rate < 0.12) { next = ctx.currentTime + 0.03; return; }
  while (next < ctx.currentTime + 0.12) {
    const r = rate, sd = 60 / R.bpm / 4 / r, s = step % 16, bar = Math.floor(step / 16);
    const t = next + (step % 2 ? (R.swing - 0.5) * 2 * sd : 0);
    if (R.kick.includes(s)) kick(t, r);
    if (R.snare.includes(s)) snare(t, r, 0.5);
    if (R.ghost.includes(s)) snare(t, r, 0.12);
    if (R.hat.includes(s)) hat(t, r, s % 4 === 0 ? 0.16 : 0.08, false);
    if (R.ohat.includes(s)) hat(t, r, 0.1, true);
    R.bass.forEach(([st, n]) => { if (st === s) bass(t, mtof(n) * r, sd * 2.4); });
    if (s === 0) chord(t, R.chords[bar % R.chords.length].map((n) => mtof(n) * r), sd * 15);
    next += sd; step++;
  }
}

export const Beat = {
  /** Zvuk se smije pokrenuti tek nakon geste korisnika. */
  init() { if (!ctx) setup(); else if (ctx.state === 'suspended') ctx.resume(); },
  setRate(r: number) { rate = r; },
  scratch(v: number) {
    if (!ctx || !sc.g || !sc.o || !sc.bp) return;
    const a = Math.abs(v), now = ctx.currentTime;
    sc.g.gain.setTargetAtTime(a < 20 ? 0 : Math.min(0.3, a / 1400), now, 0.012);
    sc.o.frequency.setTargetAtTime(60 + a * 0.3, now, 0.01); sc.bp.frequency.setTargetAtTime(380 + a * 2.2, now, 0.01);
  },
  pause() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  dispose() { clearInterval(timer); },
};
