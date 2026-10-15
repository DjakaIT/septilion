// Karusel galerije: aktivna fotka u sredini, ostale lepezasto u dubinu; beskonačno se vrti (prototip v4).
import { $, $$, clamp, RM } from '../core/dom';

const L = document.documentElement.lang === 'en'
  ? { photo: 'Photo', close: 'Close', prev: 'Previous', next: 'Next' }
  : { photo: 'Fotografija', close: 'Zatvori', prev: 'Prethodna', next: 'Sljedeća' };

export function coverflow() {
  const pgrid = $('#pgrid'), cfStage = $('#cf-stage'), figs = $$('.pg', cfStage), NG = figs.length, dots = $$<HTMLButtonElement>('.cf-dot', pgrid);
  const cfN = $('#cf-n'), cfCap = $('#cf-cap');
  let gPos = 0, gTarget = 0, gAct = -1, gW = 400, gMoved = false;
  let gDrag: { x: number; y: number; p: number; id: number; t: number; lx: number; v: number; on: boolean } | null = null;
  const wrapD = (d: number) => { d = ((d % NG) + NG) % NG; return d > NG / 2 ? d - NG : d; };
  const measure = () => { gW = figs[0].offsetWidth || gW; };
  function render() {
    const mob = innerWidth <= 760, sp1 = mob ? 0.78 : 0.74, sp2 = mob ? 0.3 : 0.44;
    figs.forEach((f, i) => {
      const o = wrapD(i - gPos), a = Math.abs(o), sg = Math.sign(o);
      const x = sg * (a <= 1 ? a * sp1 : sp1 + (a - 1) * sp2) * gW, s = 1 - 0.13 * Math.min(a, 3), ry = -sg * Math.min(a, 1) * 24;
      const op = a > 2.7 ? 0 : a > 2 ? 1 - (a - 2) / 0.7 : 1;
      f.style.transform = `translate3d(${x.toFixed(1)}px,0,${(-a * 60).toFixed(0)}px) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      f.style.opacity = op.toFixed(3); f.style.visibility = op < 0.01 ? 'hidden' : 'visible'; f.style.zIndex = String(100 - Math.round(a * 10));
      f.style.setProperty('--dim', Math.min(0.62, a * 0.42).toFixed(3));
    });
    const act = ((Math.round(gPos) % NG) + NG) % NG;
    if (act !== gAct) {
      gAct = act; const im = $<HTMLImageElement>('img', figs[act]);
      cfN.textContent = String(act + 1).padStart(2, '0'); cfCap.textContent = im.alt;
      figs.forEach((f, i) => { f.classList.toggle('on', i === act); $<HTMLButtonElement>('.pg-open', f).tabIndex = i === act ? 0 : -1; });
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === act)));
    }
  }
  function step(_t: number, dt: number) {
    if (gDrag) return; const d = gTarget - gPos;
    if (Math.abs(d) < 0.0005) { if (gPos !== gTarget) { gPos = gTarget; render(); } return; }
    gPos += d * (1 - Math.exp(-dt * (RM ? 60 : 9))); render();
  }
  const goTo = (i: number) => { gTarget = gPos + wrapD(i - gPos); if (RM) { gPos = gTarget; render(); } };
  const by = (d: number) => { gTarget = Math.round(gTarget) + d; if (RM) { gPos = gTarget; render(); } };
  $('.cf-nav.p', pgrid).addEventListener('click', () => by(-1)); $('.cf-nav.n', pgrid).addEventListener('click', () => by(1));
  dots.forEach((d) => d.addEventListener('click', () => goTo(+d.dataset.i!)));
  pgrid.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { by(1); e.preventDefault(); } if (e.key === 'ArrowLeft') { by(-1); e.preventDefault(); } });
  // povlačenje prstom ili mišem; vodoravno vrti karusel, okomito ostavlja skrol stranici
  cfStage.addEventListener('pointerdown', (e) => { if (e.button > 0) return; gDrag = { x: e.clientX, y: e.clientY, p: gPos, id: e.pointerId, t: performance.now(), lx: e.clientX, v: 0, on: false }; gMoved = false; });
  cfStage.addEventListener('pointermove', (e) => {
    if (!gDrag || e.pointerId !== gDrag.id) return; const dx = e.clientX - gDrag.x, dy = e.clientY - gDrag.y;
    if (!gDrag.on) {
      if (Math.abs(dx) < 8) { if (Math.abs(dy) > 10) gDrag = null; return; }
      gDrag.on = true; gMoved = true; cfStage.classList.add('drag');
      try { cfStage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    const now = performance.now(); gDrag.v = (e.clientX - gDrag.lx) / Math.max(1, now - gDrag.t); gDrag.t = now; gDrag.lx = e.clientX;
    gPos = gDrag.p - dx / (gW * 0.78); render();
  });
  const up = () => { if (!gDrag) return; const on = gDrag.on, v = gDrag.v; gDrag = null; cfStage.classList.remove('drag'); if (on) gTarget = Math.round(gPos - clamp(v * 1.6, -2, 2)); };
  cfStage.addEventListener('pointerup', up); cfStage.addEventListener('pointercancel', up);
  cfStage.addEventListener('click', (e) => { if (gMoved) { e.stopPropagation(); e.preventDefault(); gMoved = false; } }, true);
  addEventListener('resize', () => { measure(); render(); });

  // puni prikaz — Jellyfish
  const jlb = document.createElement('div');
  jlb.className = 'jlb'; jlb.setAttribute('role', 'dialog'); jlb.setAttribute('aria-modal', 'true'); jlb.setAttribute('aria-label', L.photo);
  jlb.innerHTML = `<div class="jlb-top"><span class="jlb-n"></span><button class="jlb-x" type="button" aria-label="${L.close}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>
    <div class="jlb-stage"><img alt=""><button class="jlb-nav p" type="button" aria-label="${L.prev}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg></button><button class="jlb-nav n" type="button" aria-label="${L.next}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg></button></div>
    <p class="jlb-cap"></p>`;
  document.body.appendChild(jlb);
  const jImg = $<HTMLImageElement>('.jlb-stage img', jlb), btns = $$<HTMLButtonElement>('.pg-open', pgrid);
  let ji = 0, jFocus: HTMLElement | null = null;
  const pad = (n: number) => String(n).padStart(2, '0');
  function show(i: number) {
    ji = (i + btns.length) % btns.length; const b = btns[ji], im = $<HTMLImageElement>('img', b);
    jImg.src = b.dataset.full!; jImg.alt = im.alt; $('.jlb-cap', jlb).textContent = im.alt;
    $('.jlb-n', jlb).textContent = `${pad(ji + 1)} / ${pad(btns.length)}`; goTo(ji);
  }
  function open(i: number) { jFocus = document.activeElement as HTMLElement; show(i); jlb.classList.add('on'); document.documentElement.style.overflow = 'hidden'; $('.jlb-x', jlb).focus(); }
  function close() { jlb.classList.remove('on'); document.documentElement.style.overflow = ''; jFocus?.focus(); }
  btns.forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i!, tg = ((Math.round(gTarget) % NG) + NG) % NG;
    if (i === tg || i === gAct) open(i); else goTo(i);
  }));
  $('.jlb-x', jlb).addEventListener('click', close);
  $('.jlb-nav.p', jlb).addEventListener('click', () => show(ji - 1)); $('.jlb-nav.n', jlb).addEventListener('click', () => show(ji + 1));
  jlb.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(ji + 1); if (e.key === 'ArrowLeft') show(ji - 1);
    if (e.key === 'Tab') { const f = $$<HTMLButtonElement>('button', jlb), fi = f.indexOf(document.activeElement as HTMLButtonElement); e.preventDefault(); f[(fi + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
  });
  let jx: number | null = null, jy = 0; const jst = $('.jlb-stage', jlb);
  jst.addEventListener('pointerdown', (e) => { if ((e.target as Element).closest('button')) return; jx = e.clientX; jy = e.clientY; });
  jst.addEventListener('pointermove', (e) => { if (jx === null) return; jImg.style.transform = `translateX(${(e.clientX - jx) * 0.9}px)`; });
  jst.addEventListener('pointerup', (e) => {
    if (jx === null) return; const dx = e.clientX - jx, dy = e.clientY - jy; jx = null; jImg.style.transform = '';
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) show(ji + (dx < 0 ? 1 : -1)); else if (dy > 110) close();
  });
  jst.addEventListener('pointercancel', () => { jx = null; jImg.style.transform = ''; });

  return { measure, render, step };
}
