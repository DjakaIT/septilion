// Korisnici uredništva (podaci/korisnici.json, prava 600). Nikad se ne spremaju lozinke ni tokeni, samo hashevi.
// Datoteku mijenjaju i poslužitelj i naredba (urednistvo/cli.mjs), pa se čita iznova kad se promijeni.
// Uloge: 'admin' (prvi račun; poziva i uklanja druge) i 'urednik' (uređuje jelovnik).
import fs from 'node:fs';
import path from 'node:path';
import { citajJson, pisiJson } from './datoteke.mjs';
import { nasumicno, sha256, jednako } from './sigurnost.mjs';

export const POZIVNICA_TRAJE_MS = 72 * 3600 * 1000;
export const normalizirajIme = (ime) => String(ime ?? '').trim().toLowerCase();
export const ispravnoIme = (ime) => /^[a-z0-9][a-z0-9._-]{1,31}$/.test(ime);
export const PORUKA_IME = 'Korisničko ime: 2–32 znaka, mala slova, brojke, točka, crtica.';

/** stanje računa za popis korisnika */
export function stanjeRacuna(k, t = Date.now()) {
  if (!k.lozinka) return k.pozivnica?.istjece > t ? 'čeka pozivnicu' : 'pozivnica istekla';
  return k.totp ? 'aktivan' : 'bez dvostruke potvrde';
}

export function korisnici(podaciDir) {
  const datoteka = path.join(podaciDir, 'korisnici.json');
  let cache = null, mtime = 0;

  function sve() {
    let m = 0;
    try { m = fs.statSync(datoteka).mtimeMs; } catch { /* nema datoteke */ }
    if (!cache || m !== mtime) { cache = citajJson(datoteka, { korisnici: [] }); mtime = m; }
    return cache;
  }
  function spremi(podaci) { pisiJson(datoteka, podaci); cache = podaci; mtime = fs.statSync(datoteka).mtimeMs; }
  const pronadji = (ime) => sve().korisnici.find((k) => k.ime === normalizirajIme(ime)) ?? null;
  const novi = (ime, uloga) => ({ ime, uloga, lozinka: null, totp: null, rezervni: [], zadnjiKorak: -1, sesijaVerzija: 1, kreiran: new Date().toISOString(), zadnjaPrijava: null });

  /** promjena jednog korisnika (čita svježe stanje, piše odmah) */
  function promijeni(ime, fn) {
    const podaci = structuredClone(sve());
    const k = podaci.korisnici.find((x) => x.ime === normalizirajIme(ime));
    if (!k) throw new Error('Korisnik ne postoji');
    fn(k);
    spremi(podaci);
    return k;
  }

  /** prvi račun (prvo postavljanje): administrator, lozinka se postavlja odmah nakon toga */
  function stvoriPrvog(ime) {
    const podaci = structuredClone(sve());
    if (podaci.korisnici.length) throw new Error('Uredništvo je već postavljeno');
    podaci.korisnici.push(novi(normalizirajIme(ime), 'admin'));
    spremi(podaci);
  }

  /** nova pozivnica (i novi korisnik ako ne postoji); resetiraj = nova lozinka i dvostruka potvrda, odjava svugdje */
  function pozivnica(ime, { resetiraj = false } = {}) {
    const n = normalizirajIme(ime);
    if (!ispravnoIme(n)) throw new Error(PORUKA_IME);
    const token = nasumicno(32);
    const podaci = structuredClone(sve());
    let k = podaci.korisnici.find((x) => x.ime === n);
    if (!k) {
      k = novi(n, podaci.korisnici.length ? 'urednik' : 'admin');
      podaci.korisnici.push(k);
    } else if (resetiraj) {
      Object.assign(k, { lozinka: null, totp: null, rezervni: [], zadnjiKorak: -1, sesijaVerzija: (k.sesijaVerzija ?? 1) + 1 });
    } else if (k.lozinka) {
      throw new Error('Korisnik već ima lozinku; za novu upotrijebi --resetiraj');
    }
    k.pozivnica = { hash: sha256(token), istjece: Date.now() + POZIVNICA_TRAJE_MS };
    spremi(podaci);
    return token;
  }

  /** korisnik za valjanu pozivnicu (token se uspoređuje kao hash, u stalnom vremenu) */
  function poPozivnici(token) {
    const h = sha256(token);
    return sve().korisnici.find((k) => k.pozivnica && k.pozivnica.istjece > Date.now() && jednako(k.pozivnica.hash, h)) ?? null;
  }

  function obrisi(ime) {
    const podaci = structuredClone(sve());
    const prije = podaci.korisnici.length;
    podaci.korisnici = podaci.korisnici.filter((k) => k.ime !== normalizirajIme(ime));
    if (podaci.korisnici.length === prije) throw new Error('Korisnik ne postoji');
    spremi(podaci);
  }

  return { sve, pronadji, promijeni, stvoriPrvog, pozivnica, poPozivnici, obrisi, broj: () => sve().korisnici.length };
}
