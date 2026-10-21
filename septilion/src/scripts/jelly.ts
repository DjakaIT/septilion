// JELLYFISH IN SPACE — interakcije iz prototipa v4 (+ skupine u dugim kategorijama jelovnika).
import { $, $$, clamp, lerp, RM } from './core/dom';
import { job } from './core/loop';
import { initNav } from './core/nav';
import { initChrome } from './core/chrome';
import { Swarm } from './swarm';
import { coverflow } from './jelly/coverflow';
import { uzivo } from './core/uzivo';

initNav();
initChrome('jellyfish-in-space');
const v = $('.view-jelly');

/* ================= ORBITA — kategorije jelovnika ================= */
// Blok (orbita + jelovnik) ima stalnu visinu na svakom uređaju: odabir mijenja samo sadržaj
// (naslov, fotku, popis), a popis stavki se skrola iznutra.
const orbit = $('#orbit'), core = $('.core', orbit), chipsBox = $('#chips'), ph = $('#pn-ph'), pi = $<HTMLImageElement>('#pn-img');
const planets = $$<HTMLButtonElement>('.planet', orbit), chips = $$<HTMLButtonElement>('button', chipsBox);
// .pcat = tabpanel kategorije (nosi podatke i hidden); unutra je .plist (popis koji se skrola)
const lists = $$('.pcat', v), groupBars = $$('.pgroups', v);
const pnT = $('#pn-t'), pnD = $('#pn-d'), panel = $('.panel', v), owrap = $('.orbit-wrap', v), ogrid = $('.orbit-grid', v);
// na desktopu je blok cijela rešetka (s naslovom; .orbit-wrap je tada display:contents i nema svoj okvir)
const block = () => (owrap.getClientRects().length ? owrap : ogrid);
const NCAT = planets.length, step = (Math.PI * 2) / NCAT;
let th = Math.PI / 2, thT = Math.PI / 2, sel = 0, odrag = false, idle = 0;
const topbarBottom = () => $('.topbar')?.getBoundingClientRect().bottom || 0;

// nakon odabira cijeli blok stane na ekran: ispod gornje trake i iznad donje trake za narudžbu
function frame() {
  const r = block().getBoundingClientRect(), top = topbarBottom() + 8, ob = $('#orderbar');
  const obOn = ob && document.body.classList.contains('show-ob') && getComputedStyle(ob).display !== 'none';
  const bottom = innerHeight - (obOn ? ob.offsetHeight + 20 : 12);
  const dy = r.top < top ? r.top - top : r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : 0;
  if (Math.abs(dy) > 4) window.scrollBy({ top: dy, behavior: RM ? 'auto' : 'smooth' });
}

function select(i: number, go?: 'orbit' | 'chip' | false) {
  sel = i;
  planets.forEach((p, k) => p.setAttribute('aria-pressed', String(k === i)));
  chips.forEach((c, k) => { c.setAttribute('aria-selected', String(k === i)); c.tabIndex = k === i ? 0 : -1; });
  // samo vodoravno pomakni traku kategorija (prototip je zvao scrollIntoView, koji je na mobitelu
  // pri učitavanju odvukao cijelu stranicu do orbite)
  const chip = chips[i];
  if (chipsBox.scrollWidth > chipsBox.clientWidth) {
    const left = chip.offsetLeft - (chipsBox.clientWidth - chip.offsetWidth) / 2;
    chipsBox.scrollTo({ left: Math.max(0, left), behavior: RM || go === undefined ? 'auto' : 'smooth' });
  }
  let want = Math.PI / 2 - i * step;
  while (want - thT > Math.PI) want -= Math.PI * 2;
  while (thT - want > Math.PI) want += Math.PI * 2;
  thT = want; idle = 0;
  const l = lists[i];
  lists.forEach((x, k) => { x.hidden = k !== i; });
  groupBars.forEach((g) => {
    g.hidden = +g.dataset.cat! !== i;
    $$('button', g).forEach((b) => b.removeAttribute('aria-current'));
  });
  pnT.textContent = l.dataset.title!; pnD.textContent = l.dataset.desc!;
  if (l.dataset.src) {
    pi.style.opacity = '0';
    setTimeout(() => { pi.srcset = l.dataset.srcset!; pi.src = l.dataset.src!; pi.alt = l.dataset.title!; ph.classList.remove('nophoto'); pi.style.opacity = '1'; }, 180);
  } else { ph.classList.add('nophoto'); pi.alt = ''; }
  // novi popis uvijek kreće od prve stavke
  $('.plist', l).scrollTop = 0;
  if (go) frame();
}
planets.forEach((p, i) => p.addEventListener('click', () => select(i, 'orbit')));
chips.forEach((c, i) => c.addEventListener('click', () => select(i, 'chip')));
// tablist: strelice mijenjaju kategoriju
chipsBox.addEventListener('keydown', (e) => {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
  e.preventDefault(); const n = (sel + d + NCAT) % NCAT; select(n, false); chips[n].focus();
});

// skupine u dugim kategorijama (Sushi, Kokteli, Pića): skok na međunaslov unutar popisa
groupBars.forEach((bar) => $$<HTMLButtonElement>('button', bar).forEach((b) => b.addEventListener('click', () => {
  const h = document.getElementById(b.dataset.target!); if (!h) return;
  $$('button', bar).forEach((x) => x.removeAttribute('aria-current')); b.setAttribute('aria-current', 'true');
  const l = h.closest('.plist') as HTMLElement;
  l.scrollTo({ top: l.scrollTop + h.getBoundingClientRect().top - l.getBoundingClientRect().top, behavior: RM ? 'auto' : 'smooth' });
  frame();
})));

// kategorije na mobitelu idu između orbite i cjenika
const chipsHome = chipsBox.parentElement!, chipsNext = chipsBox.nextElementSibling;
function placeChips() {
  if (innerWidth <= 900) { if (chipsBox.parentElement !== owrap) owrap.insertBefore(chipsBox, panel); }
  else if (chipsBox.parentElement !== chipsHome) chipsHome.insertBefore(chipsBox, chipsNext);
}
placeChips(); addEventListener('resize', placeChips);

// orbita: vodoravni potez (i preko planeta) okreće sustav, okomiti ostaje skrol stranice
let og: { x: number; y: number; lx: number; id: number; on: boolean } | null = null, oMoved = false;
orbit.addEventListener('pointerdown', (e) => { if (e.button > 0) return; og = { x: e.clientX, y: e.clientY, lx: e.clientX, id: e.pointerId, on: false }; oMoved = false; });
orbit.addEventListener('pointermove', (e) => {
  if (!og || e.pointerId !== og.id) return;
  const dx = e.clientX - og.x, dy = e.clientY - og.y;
  if (!og.on) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { og = null; return; }
    if (Math.abs(dx) < 8) return;
    og.on = true; odrag = true; oMoved = true; orbit.classList.add('spin');
    try { orbit.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  const dir = e.pointerType === 'touch' ? -1 : 1; thT += dir * (e.clientX - og.lx) * 0.006; og.lx = e.clientX; idle = 0;
});
const oup = () => {
  if (!og) return; const on = og.on; og = null; odrag = false; orbit.classList.remove('spin');
  if (on) { const k = Math.round((Math.PI / 2 - thT) / step); select(((k % NCAT) + NCAT) % NCAT, 'orbit'); }
};
orbit.addEventListener('pointerup', oup); orbit.addEventListener('pointercancel', oup);
orbit.addEventListener('click', (e) => { if (oMoved) { e.stopPropagation(); e.preventDefault(); oMoved = false; } }, true);
$('.oc-btn.p', v).addEventListener('click', () => select((sel + NCAT - 1) % NCAT, 'orbit'));
$('.oc-btn.n', v).addEventListener('click', () => select((sel + 1) % NCAT, 'orbit'));
function orbitStep(_t: number, dt: number) {
  idle += dt; if (idle > 5 && !odrag && !RM) thT += dt * 0.1;
  th = lerp(th, thT, RM ? 1 : Math.min(1, dt * (odrag ? 14 : 4)));
  const W = orbit.clientWidth, H = orbit.clientHeight, cx = W / 2, cy = H / 2, rx = W * 0.39, ry = H * 0.34;
  planets.forEach((p, i) => {
    const a = th + i * step, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, z = Math.sin(a);
    const s = 0.6 + (0.46 * (z + 1)) / 2, pw = p.offsetWidth;
    p.style.transform = `translate(${(x - pw / 2).toFixed(1)}px,${(y - pw / 2).toFixed(1)}px) scale(${s.toFixed(3)})`;
    p.style.zIndex = String(Math.round(z * 10) + 30); p.style.opacity = (0.45 + (0.55 * (z + 1)) / 2).toFixed(2);
  });
  core.style.zIndex = '30';
}
let orbitOn = false;
new IntersectionObserver((es) => es.forEach((e) => { orbitOn = e.isIntersecting; }), { rootMargin: '100px' }).observe(orbit);

/* ================= KOKTELI — veliki listovi koje skrol prelistava ================= */
const ckTrack = $('#ck-track'), stage = $('.ck-stage', v), cards = $$('.ck-card', v), bgImgs = $$<HTMLImageElement>('#ck-bg img');
const capsEl = $('.ck-caps', v), capEls = $$('.ck-cap', v), ckProg = $('#ck-prog'), ckCopy = $('.ck-copy', v);
const NC = cards.length, ROT = [-5, 4, -3, 6, -4, 3];
let ckTop = 0, ckH = 1, cW = 400, fS = -1, ckCover = false, ckOff = 0;
const cPrev: Record<string, string> = {}, bPrev: Record<string, string> = {}, kPrev: Record<string, string | boolean> = {};
function cMeasure() {
  ckTop = ckTrack.getBoundingClientRect().top + scrollY; ckH = Math.max(1, ckTrack.offsetHeight - innerHeight); cW = cards[0].offsetWidth || cW;
  const m = innerWidth <= 900;
  if (m && capsEl.parentElement !== stage) { stage.appendChild(capsEl); capsEl.classList.add('ck-mcaps'); }
  else if (!m && capsEl.parentElement !== ckCopy) { ckCopy.appendChild(capsEl); capsEl.classList.remove('ck-mcaps'); }
  for (const o of [cPrev, bPrev, kPrev]) for (const k in o) delete o[k];
}
// piše stil samo kad se stvarno promijenio
const put = (arr: Record<string, unknown>, i: number | string, el: HTMLElement, key: string, val: string) => {
  const k = i + key; if (arr[k] !== val) { arr[k] = val; el.style.setProperty(key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), val); }
};
const sm = (t: number) => t * t * (3 - 2 * t);
function cockTarget(): [number, number] {
  const p = clamp((scrollY - ckTop) / ckH, 0, 1), raw = clamp((p - 0.03) / 0.9, 0, 1) * (NC - 1);
  // list kratko stoji (30 % koraka), a ostatak puta klizi
  const base = Math.min(Math.floor(raw), NC - 1), fr = raw - base;
  return [p, Math.min(base + sm(clamp((fr - 0.3) / 0.7, 0, 1)), NC - 1)];
}
function cock(_t: number, dt: number) {
  const r = ckTrack.getBoundingClientRect(); ckCover = r.top <= 0 && r.bottom >= innerHeight;
  if (r.bottom < -50 || r.top > innerHeight + 50) { fS = -1; return; }
  const [p, fT] = cockTarget();
  // listovi prate skrol s blagom inercijom
  if (fS < 0 || !dt) fS = fT; else fS += (fT - fS) * (1 - Math.exp(-dt * 9));
  if (Math.abs(fT - fS) < 0.0008) fS = fT;
  const f = clamp(fS + ckOff, 0, NC - 1);
  cards.forEach((c, i) => {
    const d = i - f; let o = 1, x = 0, y = 0, rot = ROT[i], s = 1, z = 100 - i;
    if (d < -1) o = 0;
    else if (d < 0) { const u = -d; x = -cW * 1.2 * u; y = -60 * u; rot = ROT[i] * 0.35 - 22 * u; o = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45; s = 1 + 0.03 * u; z = 200; }
    else { const k = Math.min(d, 3); x = k * 22; y = k * 14; rot = ROT[i] * (0.35 + k * 0.3); s = 1 - k * 0.05; o = d > 3.2 ? 0 : 1 - Math.max(0, d - 2.2) * 0.8; z = 100 - Math.round(d * 10); }
    o = clamp(o, 0, 1);
    put(cPrev, i, c, 'opacity', o.toFixed(3)); put(cPrev, i, c, 'visibility', o < 0.005 ? 'hidden' : 'visible'); put(cPrev, i, c, 'zIndex', String(z));
    put(cPrev, i, c, 'transform', `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(3)})`);
  });
  bgImgs.forEach((im, i) => { const o = clamp(1 - Math.abs(f - i) * 1.4, 0, 1); put(bPrev, i, im, 'opacity', o.toFixed(2)); put(bPrev, i, im, 'visibility', o < 0.01 ? 'hidden' : 'visible'); });
  const cur = Math.round(f);
  capEls.forEach((c, i) => {
    const o = i === cur ? clamp(1 - (Math.abs(f - i) - 0.3) / 0.2, 0, 1) : 0;
    put(kPrev, i, c, 'opacity', o.toFixed(3)); put(kPrev, i, c, 'transform', `translate3d(0,${((i - f) * 10).toFixed(1)}px,0)`);
    put(kPrev, i, c, 'visibility', o < 0.005 ? 'hidden' : 'visible');
    if (kPrev[i + 'aria'] !== o < 0.5) { kPrev[i + 'aria'] = o < 0.5; c.setAttribute('aria-hidden', String(o < 0.5)); }
  });
  put(kPrev, 'p', ckProg, 'transform', `scaleY(${p.toFixed(4)})`);
}
// smanjeno kretanje: bez skrol-lista, svi koktel listovi kao statičan niz
function cockStatic() {
  cards.forEach((c, i) => { c.style.opacity = i === 0 ? '1' : '0'; c.style.visibility = i === 0 ? 'visible' : 'hidden'; });
  bgImgs.forEach((im, i) => { im.style.opacity = i === 0 ? '1' : '0'; im.style.visibility = i === 0 ? 'visible' : 'hidden'; });
  capEls.forEach((c, i) => { c.style.opacity = i === 0 ? '1' : '0'; c.style.visibility = i === 0 ? 'visible' : 'hidden'; });
}
// kokteli na dodir: vodoravni potez ili tipke prelistavaju, okomito ostaje skrol
let cg: { x: number; y: number; id: number; on: boolean } | null = null;
const ckY = (k: number) => ckTop + (0.03 + (0.9 * Math.min(NC - 1, k + 0.12)) / (NC - 1)) * ckH;
const ckCur = () => Math.round(fS < 0 ? 0 : fS);
let rmIdx = 0;
const ckGo = (k: number) => {
  k = clamp(k, 0, NC - 1);
  if (RM) { // bez skrol-animacije: list se samo zamijeni
    rmIdx = k;
    cards.forEach((c, i) => { c.style.opacity = i === k ? '1' : '0'; c.style.visibility = i === k ? 'visible' : 'hidden'; });
    bgImgs.forEach((im, i) => { im.style.opacity = i === k ? '1' : '0'; im.style.visibility = i === k ? 'visible' : 'hidden'; });
    capEls.forEach((c, i) => { c.style.opacity = i === k ? '1' : '0'; c.style.visibility = i === k ? 'visible' : 'hidden'; });
    return;
  }
  window.scrollTo({ top: ckY(k), behavior: 'smooth' });
};
$('.ck-btn.p', v).addEventListener('click', () => ckGo((RM ? rmIdx : ckCur()) - 1));
$('.ck-btn.n', v).addEventListener('click', () => ckGo((RM ? rmIdx : ckCur()) + 1));
stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' || (e.target as Element).closest('button')) return; cg = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false }; });
stage.addEventListener('pointermove', (e) => {
  if (!cg || e.pointerId !== cg.id) return; const dx = e.clientX - cg.x, dy = e.clientY - cg.y;
  if (!cg.on) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { cg = null; return; }
    if (Math.abs(dx) < 10) return; cg.on = true;
    try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  if (!RM) ckOff = clamp(-dx / (cW * 1.1), -1, 1);
  else ckOff = -dx;
});
const cgUp = () => {
  if (!cg) return; const on = cg.on, off = ckOff; cg = null; if (!on) return;
  if (RM) { ckOff = 0; if (Math.abs(off) > 40) ckGo(rmIdx + (off > 0 ? 1 : -1)); return; }
  const base = ckCur(); fS = clamp(fS + ckOff, 0, NC - 1); ckOff = 0; ckGo(Math.abs(off) > 0.18 ? base + Math.sign(off) : base);
};
stage.addEventListener('pointerup', cgUp); stage.addEventListener('pointercancel', cgUp);

/* ================= GALERIJA — karusel ================= */
const gal = coverflow();

/* ================= POKRETANJE ================= */
const swarm = new Swarm($<HTMLCanvasElement>('#swarm'), { count: innerWidth < 700 ? 9 : 16, stars: true });
addEventListener('resize', cMeasure); addEventListener('load', cMeasure);
select(0);
requestAnimationFrame(() => { cMeasure(); if (RM) cockStatic(); else cock(0, 0); gal.measure(); gal.render(); });
// smanjeno kretanje: nebo s meduzama je statičan kadar
if (RM) { swarm.step(0, 0); addEventListener('resize', () => swarm.step(0, 0)); }
else job('swarm', (t, dt) => { if (!ckCover) swarm.step(t, dt); });
job('orbit', (t, dt) => { if (orbitOn) orbitStep(t, dt); });
job('gal', gal.step);
if (!RM) job('cock', cock);
uzivo(); // nove cijene i tekstovi iz uredništva odmah, bez čekanja izgradnje
