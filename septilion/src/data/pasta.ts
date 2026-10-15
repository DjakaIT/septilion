// Pasta Rhymes jelovnik. Izvor: uredništvo (podaci/jelovnik.json) ako postoji, inače lokalni podaci (pasta-local.mjs).
import { LOCAL_SIDE_A, LOCAL_SALADS, LOCAL_SIDES } from './pasta-local.mjs';
import { ucitajZaBuild, uPasta } from './sadrzaj.mjs';

export type L = { hr: string; en: string };
export type PastaItem = { name: string; nameEn?: string; desc: L; price: number; img?: string | null; color?: string; ink?: string; gallery?: boolean };
type Side = PastaItem & { nameEn: string };

const izUrednistva = ucitajZaBuild();
const izvor: { SIDE_A: PastaItem[]; SALADS: Side[]; SIDES: Side[] } = izUrednistva
  ? uPasta(izUrednistva)
  : { SIDE_A: LOCAL_SIDE_A, SALADS: LOCAL_SALADS, SIDES: LOCAL_SIDES };
export const { SIDE_A, SALADS, SIDES } = izvor;

/** naziv jela na jeziku stranice (talijanski nazivi paste su isti na oba jezika, osim ako ih urednik prevede) */
export const nameOf = (x: PastaItem, lang: 'hr' | 'en') => (lang === 'en' ? x.nameEn ?? x.name : x.name);

export const pastaPrices = () => [...SIDE_A, ...SALADS, ...SIDES].map((x) => x.price);
