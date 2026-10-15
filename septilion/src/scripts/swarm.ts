// MEDUZE — zajednička klasa (ulaz + Jellyfish pozadina), prenijeto iz prototipa v4.
type Jelly = { x: number; y: number; z: number; s: number; ph: number; sp: number; vx: number; vy: number; sway: number; tent: number };
type Opts = { count?: number; stars?: boolean; region?: (() => { x0: number; x1: number }) | null };

export class Swarm {
  cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; count: number; stars: boolean; region: Opts['region'];
  mx = -9999; my = -9999; items: Jelly[] = []; W = 0; H = 0;
  sky?: HTMLCanvasElement; tw: { x: number; y: number; p: number }[] = [];

  constructor(cv: HTMLCanvasElement, { count = 14, stars = false, region = null }: Opts = {}) {
    this.cv = cv; this.cx = cv.getContext('2d')!; this.count = count; this.stars = stars; this.region = region;
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => { const r = this.cv.getBoundingClientRect(); this.mx = e.clientX - r.left; this.my = e.clientY - r.top; }, { passive: true });
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio);
    this.W = r.width || innerWidth; this.H = r.height || innerHeight;
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr;
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.items.length) for (let i = 0; i < this.count; i++) this.items.push(this.spawn(true));
    if (this.stars) { // statično nebo, crta se jednom
      const o = (this.sky = document.createElement('canvas'));
      o.width = this.cv.width; o.height = this.cv.height;
      const c = o.getContext('2d')!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((this.W * this.H) / 5200);
      for (let i = 0; i < n; i++) {
        const a = Math.random();
        c.fillStyle = `rgba(237,235,230,${0.15 + a * 0.55})`;
        c.beginPath(); c.arc(Math.random() * this.W, Math.random() * this.H, a < 0.93 ? 0.7 : 1.4, 0, 7); c.fill();
      }
      this.tw = Array.from({ length: 40 }, () => ({ x: Math.random() * this.W, y: Math.random() * this.H, p: Math.random() * 6 }));
    }
  }
  spawn(initial: boolean): Jelly {
    const z = 0.35 + Math.random() * 0.65, rg = this.region ? this.region() : { x0: 0, x1: 1 };
    return {
      x: (rg.x0 + Math.random() * (rg.x1 - rg.x0)) * this.W, y: initial ? Math.random() * this.H : this.H + 80,
      z, s: (26 + Math.random() * 44) * z * (this.W < 700 ? 0.75 : 1), ph: Math.random(), sp: 0.22 + Math.random() * 0.2, vx: 0, vy: 0,
      sway: Math.random() * 6, tent: 6 + Math.floor(Math.random() * 3),
    };
  }
  step(t: number, dt: number) {
    const cx = this.cx, W = this.W, H = this.H;
    cx.clearRect(0, 0, W, H);
    if (this.sky) {
      cx.drawImage(this.sky, 0, 0, W, H);
      for (const s of this.tw) { const a = 0.5 + 0.5 * Math.sin(t * 1.6 + s.p); cx.fillStyle = `rgba(255,255,255,${a * 0.8})`; cx.fillRect(s.x, s.y, 1.6, 1.6); }
    }
    this.items.sort((a, b) => a.z - b.z);
    cx.globalCompositeOperation = 'lighter';
    for (const j of this.items) {
      const cyc = (t * j.sp + j.ph) % 1, pulse = cyc < 0.28 ? Math.sin((cyc / 0.28) * Math.PI) : 0;
      j.vy += (-(10 + 34 * pulse) * j.z - j.vy) * dt * 2.2;
      j.vx += (Math.sin(t * 0.3 + j.sway) * 6 * j.z - j.vx) * dt * 1.5;
      const dx = j.x - this.mx, dy = j.y - this.my, d2 = dx * dx + dy * dy;
      if (d2 < 160 * 160) { const d = Math.sqrt(d2) || 1, f = (1 - d / 160) * 140; j.vx += (dx / d) * f * dt; j.vy += (dy / d) * f * dt; }
      j.x += j.vx * dt; j.y += j.vy * dt;
      if (j.y < -j.s * 4) Object.assign(j, this.spawn(false));
      this.draw(j, t, pulse);
    }
    cx.globalCompositeOperation = 'source-over';
  }
  draw(j: Jelly, t: number, c: number) {
    const cx = this.cx, s = j.s, w = s * (1 - 0.16 * c), h = s * 0.72 * (1 + 0.14 * c), a = 0.18 + 0.55 * j.z;
    cx.save(); cx.translate(j.x, j.y); cx.rotate(Math.sin(t * 0.5 + j.sway) * 0.12);
    cx.lineCap = 'round';
    for (let i = 0; i < j.tent; i++) { // krakovi
      const ox = (i / (j.tent - 1) - 0.5) * w * 1.7;
      cx.beginPath(); cx.moveTo(ox, h * 0.08);
      const len = s * (2.2 + (i % 3) * 0.5);
      for (let k = 1; k <= 12; k++) { const q = k / 12; cx.lineTo(ox + Math.sin(t * 2.1 - q * 4 + i) * s * 0.16 * q + ox * q * 0.25, h * 0.08 + q * len); }
      cx.strokeStyle = `rgba(237,235,230,${a * 0.32})`; cx.lineWidth = Math.max(0.6, s * 0.025); cx.stroke();
    }
    for (let i = 0; i < 3; i++) { // oralni krakovi
      const ox = (i - 1) * w * 0.28;
      cx.beginPath(); cx.moveTo(ox, h * 0.05);
      for (let k = 1; k <= 10; k++) { const q = k / 10; cx.lineTo(ox + Math.sin(t * 1.4 - q * 3 + i * 2) * s * 0.22 * q, h * 0.05 + q * s * 1.5); }
      cx.strokeStyle = `rgba(237,235,230,${a * 0.42})`; cx.lineWidth = Math.max(1, s * 0.07 * (1 - 0.5)); cx.stroke();
    }
    // zvono
    const g = cx.createRadialGradient(0, -h * 0.35, s * 0.05, 0, -h * 0.2, s * 1.1);
    g.addColorStop(0, `rgba(245,243,238,${a * 0.55})`); g.addColorStop(0.55, `rgba(210,220,235,${a * 0.18})`); g.addColorStop(1, 'rgba(200,210,230,0)');
    cx.beginPath(); cx.moveTo(-w, 0);
    cx.bezierCurveTo(-w, -h * 1.35, w, -h * 1.35, w, 0);
    for (let k = 8; k >= 0; k--) { const x = -w + (k / 8) * 2 * w; cx.quadraticCurveTo(x + w / 8, h * 0.16, x, 0); }
    cx.fillStyle = g; cx.fill();
    cx.strokeStyle = `rgba(245,243,238,${a * 0.7})`; cx.lineWidth = Math.max(0.8, s * 0.03); cx.stroke();
    cx.beginPath(); cx.ellipse(0, -h * 0.45, w * 0.38, h * 0.28, 0, 0, Math.PI * 2); cx.strokeStyle = `rgba(255,255,255,${a * 0.25})`; cx.stroke();
    cx.restore();
  }
}
