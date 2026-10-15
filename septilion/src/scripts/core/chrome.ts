// Zajedničko sučelje: gornja traka, pojava pri skrolu, donja traka za narudžbu na mobitelu.
import { $, $$ } from './dom';
import type { RouteId } from './nav';

function pill() {
  const p = $('.switch .pill');
  if (!p) return;
  const place = (anim: boolean) => {
    const a = $('.switch a[aria-current="page"]');
    if (!anim) p.style.transition = 'none';
    if (!a) p.style.width = '0';
    else { p.style.left = a.offsetLeft + 'px'; p.style.width = a.offsetWidth + 'px'; }
    if (!anim) requestAnimationFrame(() => { p.style.transition = ''; });
  };
  place(false);
  document.fonts?.ready.then(() => place(false));
  addEventListener('resize', () => place(false));
}

function reveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  $$('.rv').forEach((el) => io.observe(el));
}

function orderbar(route: RouteId) {
  const ob = $('#orderbar');
  if (!ob || route === 'gate') return;
  const hero = $(route === 'pasta-rhymes' ? '.pr-hero' : '.jf-hero'), foot = $(route === 'pasta-rhymes' ? '.pr-foot' : '.jf-foot');
  const upd = () => {
    const past = hero.getBoundingClientRect().bottom < 60, near = foot.getBoundingClientRect().top < innerHeight * 0.92;
    document.body.classList.toggle('show-ob', past && !near);
  };
  addEventListener('scroll', upd, { passive: true });
  addEventListener('resize', upd);
  upd();
}

export function initChrome(route: RouteId) {
  pill();
  reveal();
  const sc = () => document.body.classList.toggle('scrolled', scrollY > 60);
  addEventListener('scroll', sc, { passive: true });
  sc();
  orderbar(route);
}
