// PASTA RHYMES — interakcije iz prototipa v4.
import { $, $$, clamp, lerp, RM } from './core/dom';
import { job } from './core/loop';
import { initNav } from './core/nav';
import { initChrome } from './core/chrome';
import { tracksHtml } from '../lib/tracks';
import { Beat, recs, state as beatState } from './pasta/beat';
import { lightbox } from './pasta/lightbox';

initNav();
initChrome('pasta-rhymes');

const v = $('.view-pasta'), hero = $('.pr-hero', v), box = $('#pr-stickers');

/* ---------- naljepnice u heroju: mogu se odlijepiti i premjestiti ---------- */
const stks = $$('.stk', box);
function drag(el: HTMLElement) {
  let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
  el.addEventListener('pointerdown', (e) => {
    on = true; el.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY;
    ox = parseFloat(el.dataset.dx || '0'); oy = parseFloat(el.dataset.dy || '0'); el.style.zIndex = '10'; el.style.transition = 'none';
  });
  el.addEventListener('pointermove', (e) => {
    if (!on) return;
    const dx = ox + e.clientX - sx, dy = oy + e.clientY - sy;
    el.dataset.dx = String(dx); el.dataset.dy = String(dy); el.style.translate = `${dx}px ${dy}px`; el.style.rotate = `${(e.clientX - sx) * 0.04}deg`;
  });
  const up = () => { on = false; el.style.transition = 'rotate .5s var(--ease-out)'; el.style.rotate = '0deg'; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
stks.forEach(drag);

/* ---------- marquee: ubrzava se sa skrolom ---------- */
const mq = $('#pr-mq');
let mqx = 0, lastY = scrollY, vel = 0;
function marquee(_t: number, dt: number) {
  vel = lerp(vel, Math.abs(scrollY - lastY) / Math.max(dt, 0.001), 0.1); lastY = scrollY;
  mqx -= (60 + Math.min(vel, 2400) * 0.35) * dt;
  const half = mq.scrollWidth / 2; if (half && mqx <= -half) mqx += half;
  mq.style.transform = `translate3d(${mqx.toFixed(1)}px,0,0)`;
}

/* ---------- THE SPRAYLIST: hrptovi kaseta ---------- */
const spines = $$<HTMLButtonElement>('.spine', v), deck = $('#deck'), deckCol = $('.deck-col', v), cas = $('#cas'), jc = $('#inlay');
const cNo = $('#c-no'), cName = $('#c-name'), cImg = $<HTMLImageElement>('#c-img'), cTracks = $('#c-tracks');
const mobile = () => matchMedia('(max-width:900px)').matches;
let cur = -1;
function filler(i: number) {
  const sp = spines[i], li = sp.parentElement!, d = sp.dataset, cs = getComputedStyle(li);
  const c = cs.getPropertyValue('--c').trim(), tc = cs.getPropertyValue('--t').trim();
  return () => {
    cas.style.setProperty('--lab', c); cas.style.setProperty('--ink', tc);
    cNo.textContent = `${cNo.dataset.label} · ${String(i + 1).padStart(2, '0')}`;
    cName.textContent = d.n!;
    cImg.srcset = d.srcset!; cImg.src = d.src!; cImg.alt = d.n!;
    cTracks.innerHTML = tracksHtml(d.d!, cTracks.dataset.bonus!);
  };
}
function load(i: number) {
  if (mobile()) { mLoad(i); return; }
  const sp = spines[i];
  spines.forEach((x) => x.setAttribute('aria-expanded', 'false')); sp.setAttribute('aria-expanded', 'true');
  if (deck.parentElement !== deckCol) deckCol.appendChild(deck);
  const fill = filler(i);
  if (cur === -1 || RM) { fill(); cur = i; return; }
  cur = i; cas.classList.add('out'); jc.classList.add('out');
  setTimeout(() => { fill(); requestAnimationFrame(() => { cas.classList.remove('out'); jc.classList.remove('out'); }); }, 260);
}
// pomak bez animacije: hrbat pod prstom ostaje točno gdje je bio
function pin(el: HTMLElement, before: number) {
  const dy = el.getBoundingClientRect().top - before; if (Math.abs(dy) < 1) return;
  const h = document.documentElement, o = h.style.scrollBehavior; h.style.scrollBehavior = 'auto'; window.scrollBy(0, dy); h.style.scrollBehavior = o;
}
// ako kaseta ne stane na ekran, stranica se mirno pomakne prema dolje, samo koliko treba
function reveal(sp: HTMLElement) {
  const topLim = ($('.topbar')?.getBoundingClientRect().bottom || 0) + 10;
  const ob = $('.orderbar'), botLim = innerHeight - (ob && document.body.classList.contains('show-ob') ? ob.offsetHeight + 22 : 14);
  const need = $('.cas-wrap', deck).getBoundingClientRect().bottom - botLim, room = sp.getBoundingClientRect().top - topLim;
  const dy = Math.min(need, room); if (dy > 4) window.scrollBy({ top: dy, behavior: RM ? 'auto' : 'smooth' });
}
function mLoad(i: number) {
  const sp = spines[i], li = sp.parentElement!, before = sp.getBoundingClientRect().top;
  const closing = cur === i && sp.getAttribute('aria-expanded') === 'true';
  spines.forEach((x) => x.setAttribute('aria-expanded', 'false')); cas.classList.remove('out'); jc.classList.remove('out');
  if (closing) { deckCol.appendChild(deck); cur = -1; pin(sp, before); return; }
  sp.setAttribute('aria-expanded', 'true'); filler(i)(); li.appendChild(deck); cur = i;
  pin(sp, before);
  if (!RM) { deck.classList.remove('enter'); void deck.offsetWidth; deck.classList.add('enter'); }
  requestAnimationFrame(() => reveal(sp));
}
spines.forEach((sp, i) => sp.addEventListener('click', () => load(i)));
let wasMobile = mobile();
addEventListener('resize', () => {
  const m = mobile(); if (m === wasMobile) return; wasMobile = m;
  if (!m) { deckCol.appendChild(deck); if (cur < 0) load(0); }
  else { deckCol.appendChild(deck); spines.forEach((x) => x.setAttribute('aria-expanded', 'false')); cur = -1; }
});
if (!mobile()) load(0);

/* ---------- GALERIJA: vodoravna traka + puni prikaz ---------- */
// Brojač prati trenutnu fotku (gk). Fotka je trenutna kad je poravnata uz lijevi rub trake. Zadnje fotke se
// ne mogu poravnati (traka prije završi), pa na kraju trake brojač ide razmjerno pomaku sve do zadnje, a
// strelice ih prolaze jednu po jednu (traka tada miruje jer su već na ekranu). Prije je brojač stao na 08/06.
const gt = $('#gtrack'), cards = $$('.gcard', gt), gp = $<HTMLButtonElement>('#g-prev'), gn = $<HTMLButtonElement>('#g-next'), gbar = $('#g-bar'), gcur = $('#g-cur');
const gN = cards.length, gMax = () => gt.scrollWidth - gt.clientWidth;
// položaj trake kad je fotka k uz lijevi rub (za zadnje fotke veći od kraja trake)
const gAt = (k: number) => cards[k].offsetLeft - gt.offsetLeft - parseFloat(getComputedStyle(gt).paddingLeft);
function gFromScroll() {
  const s = gt.scrollLeft, max = gMax(); if (max <= 2) return 0;
  const p = cards.map((_, k) => gAt(k));
  let j = p.findIndex((x) => x >= max - 2); if (j < 0) j = gN; // prva fotka koja se ne može poravnati
  const a = p[j - 1];
  if (j < gN && s >= a) return Math.round(j - 1 + ((s - a) / Math.max(1, max - a)) * (gN - j));
  for (let k = 0; k < j - 1; k++) if (s < p[k + 1]) return s - p[k] < (p[k + 1] - p[k]) / 2 ? k : k + 1;
  return j - 1;
}
let gk = 0, gHold = false, gHoldT = 0;
// je li traka tamo gdje bi bila za fotku gk (na kraju trake to vrijedi za sve zadnje fotke)
const gSettled = () => Math.abs(gt.scrollLeft - clamp(gAt(gk), 0, gMax())) <= 2;
function gUpd() {
  const max = gMax();
  gcur.textContent = String(gk + 1).padStart(2, '0'); gbar.style.width = (max > 0 ? (gt.scrollLeft / max) * 100 : 100) + '%';
  gp.disabled = gk === 0; gn.disabled = gk === gN - 1;
}
// dok traka klizi na fotku odabranu strelicom, skrol ne mijenja brojač
const gRelease = () => { gHold = false; if (!gSettled()) gk = gFromScroll(); gUpd(); };
const gHoldOn = () => { gHold = true; clearTimeout(gHoldT); gHoldT = window.setTimeout(gRelease, 180); };
const gGo = (d: number) => {
  const k = clamp(gk + d, 0, gN - 1); if (k === gk) return;
  gk = k; gHoldOn();
  const left = clamp(gAt(k), 0, gMax());
  if (Math.abs(gt.scrollLeft - left) > 1) gt.scrollTo({ left, behavior: RM ? 'auto' : 'smooth' });
  gUpd();
};
gp.addEventListener('click', () => gGo(-1)); gn.addEventListener('click', () => gGo(1));
gt.addEventListener('scroll', () => { if (gHold) gHoldOn(); else gk = gFromScroll(); gUpd(); }, { passive: true });
// prst ili vodoravni kotačić na traci: brojač odmah prati ručni pomak
const gManual = () => { gHold = false; clearTimeout(gHoldT); };
gt.addEventListener('pointerdown', gManual, { passive: true }); gt.addEventListener('touchstart', gManual, { passive: true });
gt.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) gManual(); }, { passive: true });
gt.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); gGo(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); gGo(-1); } });
const gSync = () => { if (!gHold && !gSettled()) gk = gFromScroll(); gUpd(); };
setTimeout(gSync, 50); addEventListener('resize', gSync); gUpd();
const lb = lightbox(cards.map((c) => {
  const b = $<HTMLButtonElement>('.gopen', c), im = $<HTMLImageElement>('img', c);
  return { src: b.dataset.full!, alt: im.alt, title: $('figcaption b', c).textContent || '', sub: $('figcaption span', c).textContent || '' };
}));
$$<HTMLButtonElement>('.gopen', gt).forEach((b) => b.addEventListener('click', () => lb.open(+b.dataset.i!)));

/* ---------- GRAMOFON koji svira ---------- */
const mus = $('#pr-music'), vw = $('#vinyl'), disc = $('#vinyl-disc'), vst = $('#vinyl-state'), pb = $('#play'), pt = $('#play-t'), vname = $('#v-name');
const L = mus.dataset as { play: string; stop: string; idle: string; playing: string; switching: string };
const sleeves = $$<HTMLButtonElement>('.sleeve', mus);
let ang = 0, av = 0, playing = false, vdrag = false, lastA = 0, lastT = 0, switchTo: number | null = null, onScreen = false;
const angOf = (e: PointerEvent) => { const r = disc.getBoundingClientRect(); return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI; };
const playingText = () => L.playing.replace('{name}', recs[beatState.rec].name);
function setLabel(i: number) { disc.style.setProperty('--lab', recs[i].lab); vname.textContent = recs[i].name; }
function setPlay(on: boolean) {
  Beat.init(); playing = on; mus.classList.toggle('is-playing', on); pb.setAttribute('aria-pressed', String(on));
  pt.textContent = on ? L.stop : L.play;
  vst.textContent = on ? playingText() : L.idle;
}
pb.addEventListener('click', () => setPlay(!playing));
sleeves.forEach((b) => b.addEventListener('click', () => {
  Beat.init(); const i = +b.dataset.rec!;
  sleeves.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  if (i === beatState.rec && playing) return;
  if (playing) { switchTo = i; vst.textContent = L.switching; } else { beatState.rec = i; setLabel(i); setPlay(true); }
}));
// tipkovnica za radio grupu ploča (strelice mijenjaju izbor)
$('.crate', mus).addEventListener('keydown', (e) => {
  const k = (e as KeyboardEvent).key; if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(k)) return;
  e.preventDefault();
  const i = sleeves.findIndex((x) => x === document.activeElement), d = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1;
  const n = sleeves[(Math.max(0, i) + d + sleeves.length) % sleeves.length]; n.focus(); n.click();
});
vw.addEventListener('pointerdown', (e) => { Beat.init(); vdrag = true; vw.setPointerCapture(e.pointerId); lastA = angOf(e); lastT = performance.now(); mus.classList.add('is-scratching'); });
vw.addEventListener('pointermove', (e) => {
  if (!vdrag) return;
  const a = angOf(e), now = performance.now(); let d = a - lastA; if (d > 180) d -= 360; if (d < -180) d += 360;
  const dts = Math.max(0.008, (now - lastT) / 1000); ang += d; av = lerp(av, d / dts, 0.5); lastA = a; lastT = now; Beat.scratch(av);
});
const vup = () => { if (!vdrag) return; vdrag = false; mus.classList.remove('is-scratching'); Beat.scratch(0); if (!playing && Math.abs(av) > 160) setPlay(true); };
vw.addEventListener('pointerup', vup); vw.addEventListener('pointercancel', vup);
new IntersectionObserver((es) => es.forEach((e) => { onScreen = e.isIntersecting; })).observe(mus);
function vinyl(_t: number, dt: number) {
  if (!vdrag) {
    let target = playing ? 200 : 0;
    if (switchTo !== null) {
      target = 0;
      if (Math.abs(av) < 25) { beatState.rec = switchTo; setLabel(switchTo); switchTo = null; vst.textContent = playingText(); }
    }
    av += (target - av) * Math.min(1, dt * (target > av ? 1.9 : 1.25));
    ang += av * dt;
  }
  Beat.setRate(Math.max(0, av / 200));
  if (onScreen) disc.style.transform = `rotate(${ang.toFixed(2)}deg)`;
}
function stopMusic() {
  playing = false; switchTo = null; av = 0; mus.classList.remove('is-playing', 'is-scratching');
  pb.setAttribute('aria-pressed', 'false'); pt.textContent = L.play; vst.textContent = L.idle; Beat.setRate(0); Beat.pause();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); });
addEventListener('pagehide', stopMusic);
setLabel(0);

/* ---------- pokretanje ---------- */
hero.classList.remove('in'); requestAnimationFrame(() => hero.classList.add('in'));
stks.forEach((s, i) => { s.classList.remove('slap'); void s.offsetWidth; s.style.animationDelay = 0.35 + i * 0.14 + 's'; s.classList.add('slap'); });
if (!RM) job('mq', marquee); // smanjeno kretanje: traka miruje
job('vinyl', vinyl); // ploča se vrti samo kad je korisnik pusti
