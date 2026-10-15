// Sesije na poslužitelju, na disku (podaci/sesije/): preživljavaju ponovno pokretanje poslužitelja.
// Kolačić nosi samo nasumični id (256 bita); datoteka se zove po SHA-256 tog id-a, pa ni kopija mape ne daje
// upotrebljiv kolačić. Kolačić: HttpOnly, SameSite=Strict, Secure (+ prefiks __Host-) kad stranica ide preko HTTPS-a.
// Istek: 30 min bez aktivnosti korisnika (pozadinske provjere statusa se ne broje), najdulje 12 h; korak prijave 5 min.
// Promjena lozinke / reset / brisanje korisnika poništava sesije preko sesijaVerzija (provjerava api.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { nasumicno, sha256 } from './sigurnost.mjs';
import { citajJson, pisiJson } from './datoteke.mjs';

export const NEAKTIVNOST_MS = 30 * 60 * 1000;
export const NAJDULJE_MS = 12 * 3600 * 1000;
export const KORAK_2FA_MS = 5 * 60 * 1000;
const ZAPISI_DODIR_MS = 60 * 1000; // aktivnost se na disk zapisuje najviše jednom u minuti

/** zašto sesija više ne vrijedi: 'trajanje' (12 h), 'neaktivnost' (30 min), 'korak' (korak prijave) ili null */
export function razlogIsteka(s, t = Date.now()) {
  if (t - s.kreirano > NAJDULJE_MS) return 'trajanje';
  if (s.korak === 'puno') return t - s.aktivno > NEAKTIVNOST_MS ? 'neaktivnost' : null;
  return t - s.aktivno > KORAK_2FA_MS ? 'korak' : null;
}

export function sesije({ sigurno, dir }) {
  const IME = sigurno ? '__Host-sx-urednistvo' : 'sx-urednistvo';
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const datoteka = (id) => path.join(dir, `${sha256(id)}.json`);
  const ukloni = (p) => { try { fs.rmSync(p, { force: true }); } catch { /* već obrisano */ } };

  function ocisti() {
    const t = Date.now();
    for (const f of fs.readdirSync(dir)) {
      if (!/^[a-f0-9]{64}\.json$/.test(f)) continue;
      let s = null;
      try { s = citajJson(path.join(dir, f)); } catch { /* oštećena */ }
      if (!s || razlogIsteka(s, t)) ukloni(path.join(dir, f));
    }
  }
  ocisti();
  const ciscenje = setInterval(ocisti, 10 * 60_000);
  ciscenje.unref();

  function kolacic(vrijednost, maxAge) {
    return `${IME}=${vrijednost}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${sigurno ? '; Secure' : ''}`;
  }
  function idIzZahtjeva(req) {
    for (const dio of String(req.headers.cookie ?? '').split(';')) {
      const i = dio.indexOf('=');
      if (i > 0 && dio.slice(0, i).trim() === IME) return dio.slice(i + 1).trim();
    }
    return null;
  }
  const spremi = (ses) => { ses.s.zapisano = Date.now(); pisiJson(datoteka(ses.id), ses.s); };

  return {
    IME,
    /**
     * Sesija iz kolačića. Kad je kolačić tu, a sesija ne vrijedi, razlog ostaje u req.razlogIsteka.
     * @param {{ pozadina?: boolean }} [o] pozadina = automatska provjera (ne produljuje sesiju)
     * @returns {{ id: string, s: object } | null}
     */
    procitaj(req, { pozadina = false } = {}) {
      const id = idIzZahtjeva(req);
      if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
      let s = null;
      try { s = citajJson(datoteka(id)); } catch { /* oštećena */ }
      if (!s) { req.razlogIsteka = 'nema'; return null; }
      const t = Date.now();
      const razlog = razlogIsteka(s, t);
      if (razlog) { ukloni(datoteka(id)); req.razlogIsteka = razlog; return null; }
      const ses = { id, s };
      if (!pozadina) { s.aktivno = t; if (t - (s.zapisano ?? 0) > ZAPISI_DODIR_MS) spremi(ses); }
      return ses;
    },
    /** zapiši promjene sesije (npr. broj pokušaja) */
    spremi,
    /** nova sesija (uvijek novi id — zaštita od fiksacije sesije) */
    stvori(res, podaci, staraId) {
      if (staraId) ukloni(datoteka(staraId));
      const id = nasumicno(32);
      const t = Date.now();
      const ses = { id, s: { ...podaci, csrf: nasumicno(32), kreirano: t, aktivno: t } };
      spremi(ses);
      res.setHeader('Set-Cookie', kolacic(id, Math.floor(NAJDULJE_MS / 1000)));
      return ses.s;
    },
    obrisi(res, id) { if (id) ukloni(datoteka(id)); res.setHeader('Set-Cookie', kolacic('', 0)); },
    /** odjava korisnika svugdje (npr. nakon promjene lozinke), osim po želji jedne sesije */
    odjaviKorisnika(ime, osim) {
      const zadrzi = osim ? `${sha256(osim)}.json` : null;
      for (const f of fs.readdirSync(dir)) {
        if (f === zadrzi || !/^[a-f0-9]{64}\.json$/.test(f)) continue;
        try { if (citajJson(path.join(dir, f))?.ime === ime) ukloni(path.join(dir, f)); } catch { /* preskoči */ }
      }
    },
    zatvori() { clearInterval(ciscenje); },
  };
}
