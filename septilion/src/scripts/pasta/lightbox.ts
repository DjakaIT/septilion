// Puni prikaz fotografije — Pasta Rhymes (prototip v4): tipke, prevlačenje, zamka fokusa.
import { $, $$ } from '../core/dom';

type Shot = { src: string; alt: string; title: string; sub: string };
const L = document.documentElement.lang === 'en'
  ? { photo: 'Photo', close: 'Close', prev: 'Previous', next: 'Next' }
  : { photo: 'Fotografija', close: 'Zatvori', prev: 'Prethodna', next: 'Sljedeća' };

export function lightbox(shots: Shot[]) {
  const lb = document.createElement('div');
  lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', L.photo);
  lb.innerHTML = `<div class="lb-top"><span class="lb-n"></span><button class="lb-x" type="button" aria-label="${L.close}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>
    <div class="lb-stage"><img alt=""><button class="lb-nav p" type="button" aria-label="${L.prev}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg></button><button class="lb-nav n" type="button" aria-label="${L.next}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg></button></div>
    <p class="lb-cap"><b></b><span></span></p>`;
  document.body.appendChild(lb);
  const img = $<HTMLImageElement>('.lb-stage img', lb), stage = $('.lb-stage', lb);
  let i = 0, lastFocus: HTMLElement | null = null;
  const pad = (n: number) => String(n).padStart(2, '0');
  function show(k: number) {
    i = (k + shots.length) % shots.length; const s = shots[i];
    img.src = s.src; img.alt = s.alt; $('.lb-cap b', lb).textContent = s.title; $('.lb-cap span', lb).textContent = s.sub;
    $('.lb-n', lb).textContent = `${pad(i + 1)} / ${pad(shots.length)}`;
  }
  function open(k: number) { lastFocus = document.activeElement as HTMLElement; show(k); lb.classList.add('on'); document.documentElement.style.overflow = 'hidden'; $('.lb-x', lb).focus(); }
  function close() { lb.classList.remove('on'); document.documentElement.style.overflow = ''; lastFocus?.focus(); }
  $('.lb-x', lb).addEventListener('click', close);
  $('.lb-nav.p', lb).addEventListener('click', () => show(i - 1)); $('.lb-nav.n', lb).addEventListener('click', () => show(i + 1));
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'Tab') { const f = $$<HTMLButtonElement>('button', lb), fi = f.indexOf(document.activeElement as HTMLButtonElement); e.preventDefault(); f[(fi + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
  });
  // prevlačenje (vodoravno lista; okomito zatvara)
  let sx: number | null = null, sy = 0;
  stage.addEventListener('pointerdown', (e) => { if ((e.target as Element).closest('button')) return; sx = e.clientX; sy = e.clientY; });
  stage.addEventListener('pointermove', (e) => { if (sx === null) return; img.style.transform = `translateX(${(e.clientX - sx) * 0.9}px)`; });
  stage.addEventListener('pointerup', (e) => {
    if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null; img.style.transform = '';
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) show(i + (dx < 0 ? 1 : -1)); else if (dy > 110) close();
  });
  stage.addEventListener('pointercancel', () => { sx = null; img.style.transform = ''; });
  return { open, close, el: lb };
}
