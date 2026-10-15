// Jedna rAF petlja za cijelu stranicu; poslovi se pale i gase po potrebi (kao u prototipu).
type Job = (t: number, dt: number) => void;
const JOBS = new Map<string, Job>();
export const T0 = performance.now();
let last = T0;

function loop(now: number) {
  const t = (now - T0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const f of JOBS.values()) f(t, dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// pauza kad kartica nije vidljiva: bez skoka u animaciji po povratku
document.addEventListener('visibilitychange', () => { last = performance.now(); });

export const job = (k: string, f: Job) => JOBS.set(k, f);
export const unjob = (k: string) => JOBS.delete(k);
export const now = () => (performance.now() - T0) / 1000;
