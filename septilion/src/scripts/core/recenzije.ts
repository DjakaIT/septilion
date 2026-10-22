// Google recenzije: stranica dolazi s recenzijama koje je odabrao naručitelj (src/data/recenzije.ts, prva je već u HTML-u).
// Ako uredništvo na hostingu povlači recenzije s Googlea (Places API ključ), /recenzije.json ih zamijeni svježima.
// Strelice mijenjaju recenziju; same se izmjenjuju svakih 8 s dok posjetitelj ne klikne (ne uz smanjeno kretanje).
import { RM } from './dom';
import { GOOGLE_RECENZIJE, ocjenaTekst, navodnici } from '../../data/recenzije';

type Rec = { autor: string; autorUrl: string | null; tekst: { hr: string; en: string }; kad: { hr: string; en: string } | null };
type Lokal = { ocjena: number | null; recenzije: Rec[] };

export async function recenzije() {
  const el = document.querySelector<HTMLElement>('[data-google]');
  const box = el?.querySelector<HTMLElement>('.g-rec');
  if (!el || !box) return;
  const kljuc = el.dataset.google as keyof typeof GOOGLE_RECENZIJE;
  const lang = document.documentElement.lang === 'en' ? 'en' : 'hr';
  const txt = box.querySelector('.g-txt')!, au = box.querySelector<HTMLAnchorElement>('.g-au')!, kad = box.querySelector('.g-kad')!, n = box.querySelector('.g-n')!;
  const nav = box.querySelector<HTMLElement>('.g-nav')!;
  // Pasta: kartica ima crveni navodnik (kao recenzije članaka), pa tekst ide bez navodnika
  const [ot, zt] = el.hasAttribute('data-bez-navodnika') ? ['', ''] : navodnici(lang);
  let lista: Rec[] = (GOOGLE_RECENZIJE[kljuc]?.recenzije ?? []).map((r) => ({ ...r, autorUrl: null, kad: null }));
  let i = 0;
  const prikazi = () => {
    const r = lista[i];
    if (!r) return;
    txt.textContent = `${ot}${r.tekst[lang] || r.tekst.hr}${zt}`;
    au.textContent = r.autor;
    if (r.autorUrl) au.href = r.autorUrl; else au.removeAttribute('href');
    const k = r.kad?.[lang] || r.kad?.hr || '';
    kad.textContent = k ? ` · ${k}` : '';
    n.textContent = `${i + 1} / ${lista.length}`;
    nav.hidden = lista.length < 2;
  };
  const korak = () => { i = (i + 1) % lista.length; prikazi(); };
  let auto = 0, rucno = false;
  const pokreni = () => { clearInterval(auto); auto = RM || lista.length < 2 ? 0 : window.setInterval(korak, 8000); };
  const ruka = (d: number) => { clearInterval(auto); auto = 0; rucno = true; i = (i + d + lista.length) % lista.length; prikazi(); };
  box.querySelector('.g-prev')!.addEventListener('click', () => ruka(-1));
  box.querySelector('.g-next')!.addEventListener('click', () => ruka(1));
  pokreni();

  // svježe s Googlea (samo kad ih uredništvo povlači; inače datoteke nema)
  let d: Record<string, Lokal> | null = null;
  try {
    const r = await fetch('/recenzije.json', { cache: 'no-cache' });
    if (r.ok) d = await r.json();
  } catch { /* nema ili nije JSON: ostaju odabrane */ }
  const l = d?.[kljuc];
  const svjeze = (l?.recenzije ?? []).filter((r) => r?.tekst?.hr);
  if (!l || !svjeze.length) return;
  const oc = el.querySelector('.g-ocjena');
  if (oc && typeof l.ocjena === 'number') oc.textContent = ocjenaTekst(l.ocjena, lang);
  lista = svjeze; i = 0; prikazi();
  if (!rucno) pokreni();
}
