// Pasta Rhymes jelovnik. Izvor: uredništvo (podaci/jelovnik.json) ako postoji, inače lokalni podaci (pasta-local.mjs).
import { LOCAL_SIDE_A, LOCAL_SALADS, LOCAL_SIDES } from './pasta-local.mjs';
import { ucitajZaBuild, uPasta, BAZNI_DATUM } from './sadrzaj.mjs';
import type { Base } from '../lib/format';

export type L = { hr: string; en: string };
export type PastaItem = { id?: string; name: string; nameEn?: string; desc: L; price: number; base?: Base; img?: string | null; color?: string; ink?: string; gallery?: boolean };
type Side = PastaItem & { nameEn: string };

const izUrednistva = ucitajZaBuild();
const izvor: { SIDE_A: PastaItem[]; SALADS: Side[]; SIDES: Side[] } = izUrednistva
  ? uPasta(izUrednistva)
  : { SIDE_A: LOCAL_SIDE_A, SALADS: LOCAL_SALADS, SIDES: LOCAL_SIDES };
export const { SIDE_A, SALADS, SIDES } = izvor;
/** verzija jelovnika iz uredništva s kojom je stranica izgrađena (novije cijene i tekstove stranica preuzme odmah: core/uzivo.ts) */
export const VERZIJA_JELOVNIKA: number = izUrednistva?.verzija ?? 0;

/** naziv jela na jeziku stranice (talijanski nazivi paste su isti na oba jezika, osim ako ih urednik prevede) */
export const nameOf = (x: PastaItem, lang: 'hr' | 'en') => (lang === 'en' ? x.nameEn ?? x.name : x.name);
/** bazna cijena jela (lokalni podaci bez uredništva: cijena na referentni dan) */
export const baseOf = (x: PastaItem): Base => x.base ?? { prices: [x.price], date: BAZNI_DATUM };

export const pastaPrices = () => [...SIDE_A, ...SALADS, ...SIDES].map((x) => x.price);
