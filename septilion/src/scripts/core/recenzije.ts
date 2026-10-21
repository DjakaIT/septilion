// Google recenzije: uredništvo na hostingu jednom dnevno povuče ocjenu i najbolje recenzije (5★ s tekstom) u
// /recenzije.json (urednistvo/php/lib/recenzije.php); ovdje se samo prikažu — bez skripti i slika s Googlea.
// Strelice mijenjaju recenziju; same se izmjenjuju svakih 8 s dok posjetitelj ne klikne (ne uz smanjeno kretanje).
import { RM } from './dom';

type Rec = { autor: string; autorUrl: string | null; tekst: { hr: string; en: string }; kad: { hr: string; en: string } };
type Lokal = { ocjena: number | null; broj: number; url: string | null; recenzije: Rec[] };

export async function recenzije() {
  const el = document.querySelector<HTMLElement>('[data-google]');
  if (!el) return;
  let d: Record<string, Lokal>;
  try {
    const r = await fetch('/recenzije.json', { cache: 'no-cache' });
    if (!r.ok) return;
    d = await r.json();
  } catch { return; }
  const l = d?.[el.dataset.google!];
  if (!l) return;
  const lang = document.documentElement.lang === 'en' ? 'en' : 'hr';
  const oc = el.querySelector('.g-ocjena');
  if (oc && typeof l.ocjena === 'number') oc.textContent = lang === 'hr' ? l.ocjena.toFixed(1).replace('.', ',') : l.ocjena.toFixed(1);
  const lista = (l.recenzije ?? []).filter((r) => r?.tekst?.hr);
  const box = el.querySelector<HTMLElement>('.g-rec');
  if (!box || !lista.length) return;
  const txt = box.querySelector('.g-txt')!, au = box.querySelector<HTMLAnchorElement>('.g-au')!, kad = box.querySelector('.g-kad')!, n = box.querySelector('.g-n')!;
  const [ot, zt] = lang === 'hr' ? ['„', '”'] : ['“', '”'];
  let i = 0;
  const prikazi = () => {
    const r = lista[i];
    txt.textContent = `${ot}${r.tekst[lang] || r.tekst.hr}${zt}`;
    au.textContent = r.autor;
    if (r.autorUrl) au.href = r.autorUrl; else au.removeAttribute('href');
    const k = r.kad?.[lang] || r.kad?.hr || '';
    kad.textContent = k ? `· ${k}` : '';
    n.textContent = `${i + 1} / ${lista.length}`;
  };
  box.querySelector<HTMLElement>('.g-nav')!.hidden = lista.length < 2;
  let auto = RM || lista.length < 2 ? 0 : window.setInterval(() => { i = (i + 1) % lista.length; prikazi(); }, 8000);
  const ruka = (d: number) => { clearInterval(auto); auto = 0; i = (i + d + lista.length) % lista.length; prikazi(); };
  box.querySelector('.g-prev')!.addEventListener('click', () => ruka(-1));
  box.querySelector('.g-next')!.addEventListener('click', () => ruka(1));
  prikazi();
  box.hidden = false;
}
