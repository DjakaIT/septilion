// Promjene iz uredništva odmah, bez čekanja izgradnje: uredništvo pri svakom spremanju zapiše /jelovnik-uzivo.json
// (nazivi, opisi i cijene jela), a stranica izgrađena sa starijom verzijom jelovnika ih odmah zamijeni.
// Nova i obrisana jela, fotografije, redoslijed i podaci za Google stižu s izgradnjom (minutu-dvije).
import { price } from '../../lib/format';

type T = { hr: string; en: string };
type Jelo = { id: string; naziv: T; opis: T; cijena: number; cijena2: number | null };

const postavi = (el: Element | null, t: string) => { if (el) el.textContent = t; };
/** prvi tekst u elementu (iza njega su npr. <small> s volumenom ili opisom) */
const prviTekst = (el: Element | null, t: string) => {
  if (!el) return;
  const n = [...el.childNodes].find((c) => c.nodeType === Node.TEXT_NODE);
  if (n) n.textContent = t; else el.prepend(t);
};

/** @returns je li stranica dobila novije podatke (npr. otvorena kaseta se tada ponovno iscrta) */
export async function uzivo(): Promise<boolean> {
  const root = document.querySelector<HTMLElement>('[data-jelovnik]');
  if (!root) return false;
  let s: { verzija: number; jela: Jelo[] };
  try {
    const r = await fetch('/jelovnik-uzivo.json', { cache: 'no-store' });
    if (!r.ok) return false;
    s = await r.json();
  } catch { return false; }
  if (!(s?.verzija > (Number(root.dataset.jelovnik) || 0)) || !Array.isArray(s.jela)) return false;
  const lang = document.documentElement.lang === 'en' ? 'en' : 'hr';
  const L = (v: T) => (lang === 'en' ? v.en || v.hr : v.hr);
  const cijena = (v: number) => price(v, lang);
  const jela = new Map(s.jela.map((x) => [x.id, x]));
  for (const el of document.querySelectorAll<HTMLElement>('[data-id]')) {
    const x = jela.get(el.dataset.id!);
    if (!x) continue;
    const naziv = L(x.naziv), opis = x.opis.hr ? L(x.opis) : '';
    if (el.matches('button')) {
      // Pasta, strana A: kaseta pri odabiru čita data-*
      Object.assign(el.dataset, { n: naziv, d: opis, now: cijena(x.cijena) });
      postavi(el.querySelector('.nm'), naziv);
      postavi(el.querySelector('.pr b'), cijena(x.cijena));
    } else if (el.querySelector('.it')) {
      // Jellyfish
      postavi(el.querySelector('.it > b'), naziv);
      if (opis) postavi(el.querySelector('.it > .ds:not(.pp)'), opis);
      prviTekst(el.querySelector('.pr'), [x.cijena, x.cijena2].filter((v): v is number => typeof v === 'number').map(cijena).join(' / '));
    } else {
      // Pasta, strana B
      prviTekst(el.querySelector('.n'), naziv);
      if (opis) postavi(el.querySelector('.n .dd'), opis);
      postavi(el.querySelector('.t b'), cijena(x.cijena));
    }
  }
  return true;
}
