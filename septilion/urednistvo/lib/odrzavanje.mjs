// Održavanje stranice: dok je uključeno, posjetitelji umjesto stranice dobiju odrzavanje.html (503 — tražilice dođu poslije),
// a uredništvo radi normalno i spremanja se i dalje objavljuju. Uključuje ga administrator (izbornik -> Održavanje stranice).
// Lokalno je oznaka podaci/odrzavanje.json; na hostingu PHP piše public_html/.odrzavanje, a provjerava je public/.htaccess.
import fs from 'node:fs';
import path from 'node:path';
import { pisiJson } from './datoteke.mjs';

/** preglednik s ovim kolačićem (administrator koji je uključio održavanje) i dalje vidi stranicu */
export const KOLACIC_PREGLEDA = 'septillion_pregled';
/** za vrijeme održavanja rade samo datoteke (slike, fontovi, CSS, JS…), ne stranice — isto pravilo je u public/.htaccess */
export const DATOTEKA = /\.(css|js|mjs|woff2|svg|ico|png|jpe?g|webp|avif|gif|pdf|xml|txt|webmanifest)$/i;

export const imaPregled = (req) => new RegExp(`(?:^|;\\s*)${KOLACIC_PREGLEDA}=1(?:;|$)`).test(String(req.headers.cookie ?? ''));

export function kolacicPregleda(ukljucen, sigurno) {
  return `${KOLACIC_PREGLEDA}=${ukljucen ? '1' : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ukljucen ? 30 * 86400 : 0}${sigurno ? '; Secure' : ''}`;
}

export function odrzavanje(podaciDir) {
  const datoteka = path.join(podaciDir, 'odrzavanje.json');
  const ukljuceno = () => fs.existsSync(datoteka);
  return {
    ukljuceno,
    /** { ukljuceno, od, ime } — i ručno napravljena prazna datoteka znači uključeno */
    stanje() {
      if (!ukljuceno()) return { ukljuceno: false, od: null, ime: null };
      let s = null;
      try { s = JSON.parse(fs.readFileSync(datoteka, 'utf8')); } catch { /* prazna ili neispravna datoteka */ }
      return { ukljuceno: true, od: typeof s?.od === 'string' ? s.od : null, ime: typeof s?.ime === 'string' ? s.ime : null };
    },
    postavi(uklj, ime) {
      if (!uklj) fs.rmSync(datoteka, { force: true });
      else if (!ukljuceno()) pisiJson(datoteka, { od: new Date().toISOString(), ime });
      return this.stanje();
    },
  };
}
