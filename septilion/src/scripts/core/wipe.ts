// Prijelaz između lokala: valoviti rub prelazi ekran (prototip v4).
// Faza "cover" pokriva slijeva na staroj stranici; faza "reveal" otkriva nadesno na novoj.
import { $, clamp, lerp, easeIO, seamAt } from './dom';

const wrap = $('#wipe');
const cv = $<HTMLCanvasElement>('#wipe canvas');
const cx = cv.getContext('2d')!;
const DUR = 520, N = 28;

function size() {
  const dpr = Math.min(2, devicePixelRatio), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W, H };
}

function draw(phase: 0 | 1, e: number, color: string, edge: string, W: number, H: number) {
  const tt = performance.now() / 1000, base = lerp(-0.15, 1.15, e);
  cx.clearRect(0, 0, W, H); cx.beginPath();
  if (phase === 0) { cx.moveTo(0, 0); for (let i = 0; i <= N; i++) { const u = i / N; cx.lineTo(seamAt(u, tt, base, 2.2) * W, u * H); } cx.lineTo(0, H); }
  else { cx.moveTo(W, 0); for (let i = 0; i <= N; i++) { const u = i / N; cx.lineTo(seamAt(u, tt, base, 2.2) * W, u * H); } cx.lineTo(W, H); }
  cx.closePath(); cx.fillStyle = color; cx.fill();
  cx.beginPath();
  for (let i = 0; i <= N; i++) { const u = i / N, x = seamAt(u, tt, base, 2.2) * W; if (i) cx.lineTo(x, u * H); else cx.moveTo(x, 0); }
  cx.strokeStyle = edge; cx.lineWidth = 3; cx.shadowColor = edge; cx.shadowBlur = 18; cx.stroke(); cx.shadowBlur = 0;
}

function run(phase: 0 | 1, color: string, edge: string, onFirstFrame?: () => void) {
  return new Promise<void>((res) => {
    wrap.style.visibility = 'visible';
    const { W, H } = size();
    const t0 = performance.now();
    let first = true;
    function frame(now: number) {
      const k = clamp((now - t0) / DUR, 0, 1);
      draw(phase, easeIO(k), color, edge, W, H);
      if (first) { first = false; onFirstFrame?.(); }
      if (k < 1) requestAnimationFrame(frame);
      else {
        if (phase === 1) { cx.clearRect(0, 0, W, H); wrap.style.visibility = 'hidden'; }
        res();
      }
    }
    // prvi kadar odmah, da nema bljeska između stranica
    frame(t0);
  });
}

export const Wipe = {
  cover: (color: string, edge: string) => run(0, color, edge),
  reveal: (color: string, edge: string, onFirstFrame?: () => void) => run(1, color, edge, onFirstFrame),
  clear() { cx.clearRect(0, 0, cv.width, cv.height); wrap.style.visibility = 'hidden'; },
};
