// Jelovnik uredništva: podaci/jelovnik.json + povijest verzija (podaci/povijest/) + dnevnik promjena (podaci/dnevnik.log).
// Svako spremanje: provjera (src/data/sadrzaj.mjs) -> nova verzija -> atomarno pisanje. Sukob verzija = 409.
import fs from 'node:fs';
import path from 'node:path';
import { citajJson, pisiJson, brava } from './datoteke.mjs';
import { provjeri, pocetniSadrzaj, migriraj, Kategorija } from '../../src/data/sadrzaj.mjs';
import { LOKALI, kljucKategorije } from '../../src/data/lokali.mjs';
import { ROOT } from './postavke.mjs';

const ZADRZI_VERZIJA = 60;

export class Greska extends Error {
  constructor(status, poruka, podaci = {}) { super(poruka); this.status = status; this.podaci = podaci; }
}

export function spremiste(podaciDir, { slikaPostoji }) {
  const datoteka = path.join(podaciDir, 'jelovnik.json');
  const povijestDir = path.join(podaciDir, 'povijest');
  const dnevnikDatoteka = path.join(podaciDir, 'dnevnik.log');
  const zakljucaj = brava();

  function dnevnik(zapis) {
    fs.mkdirSync(podaciDir, { recursive: true, mode: 0o700 });
    fs.appendFileSync(dnevnikDatoteka, JSON.stringify({ vrijeme: new Date().toISOString(), ...zapis }) + '\n', { mode: 0o600 });
  }

  function snimiVerziju(s, opis) {
    pisiJson(path.join(povijestDir, `${String(s.verzija).padStart(6, '0')}.json`), { opis, sadrzaj: s });
    const sve = fs.readdirSync(povijestDir).filter((f) => /^\d{6}\.json$/.test(f)).sort();
    for (const f of sve.slice(0, Math.max(0, sve.length - ZADRZI_VERZIJA))) fs.rmSync(path.join(povijestDir, f));
  }

  /** trenutni jelovnik (stariji format nadograđen, na disk ide pri sljedećem spremanju); prvi put se stvara iz lokalnih podataka stranice */
  function ucitaj() {
    const s = citajJson(datoteka);
    if (s) return migriraj(s);
    const pocetni = pocetniSadrzaj(ROOT);
    pisiJson(datoteka, pocetni);
    snimiVerziju(pocetni, 'Početni sadržaj');
    return pocetni;
  }

  function spremi(novi, ime, opis) {
    const r = provjeri(novi, slikaPostoji);
    if (!r.ok) throw new Greska(422, 'Sadržaj nije ispravan', { greske: r.greske });
    pisiJson(datoteka, r.sadrzaj);
    snimiVerziju(r.sadrzaj, opis);
    dnevnik({ ime, radnja: 'spremanje', verzija: r.sadrzaj.verzija, opis });
    return r.sadrzaj;
  }

  return {
    ucitaj,
    dnevnik,
    /** spremi jednu kategoriju; bazna verzija mora biti trenutna (inače je netko drugi u međuvremenu spremio) */
    spremiKategoriju: (kljuc, kategorija, baznaVerzija, ime) => zakljucaj(() => {
      const trenutni = ucitaj();
      if (!(kljuc in trenutni.kategorije)) throw new Greska(404, 'Nepoznata kategorija');
      if (trenutni.verzija !== baznaVerzija) throw new Greska(409, 'Jelovnik je u međuvremenu promijenjen', { verzija: trenutni.verzija });
      const k = Kategorija.safeParse(kategorija);
      if (!k.success) throw new Greska(422, 'Sadržaj nije ispravan', { greske: k.error.issues.map((i) => ({ putanja: ['kategorije', kljuc, ...i.path], poruka: i.message })) });
      const [lokal, kk] = kljuc.split('/');
      const naziv = LOKALI.find((l) => l.id === lokal)?.kategorije.find((c) => c.kljuc === kk)?.naziv || k.data.naslov.hr || kk;
      const novi = { ...trenutni, verzija: trenutni.verzija + 1, azurirano: new Date().toISOString(), azurirao: ime, kategorije: { ...trenutni.kategorije, [kljuc]: k.data } };
      return spremi(novi, ime, `${LOKALI.find((l) => l.id === lokal)?.naziv}: ${naziv}`);
    }),
    povijest() {
      if (!fs.existsSync(povijestDir)) return [];
      return fs.readdirSync(povijestDir).filter((f) => /^\d{6}\.json$/.test(f)).sort().reverse().map((f) => {
        const v = citajJson(path.join(povijestDir, f));
        return { verzija: v.sadrzaj.verzija, azurirano: v.sadrzaj.azurirano, azurirao: v.sadrzaj.azurirao, opis: v.opis };
      });
    },
    /** vrati staru verziju (kao novu verziju — povijest se ne briše) */
    vrati: (verzija, baznaVerzija, ime) => zakljucaj(() => {
      const trenutni = ucitaj();
      if (trenutni.verzija !== baznaVerzija) throw new Greska(409, 'Jelovnik je u međuvremenu promijenjen', { verzija: trenutni.verzija });
      const stara = citajJson(path.join(povijestDir, `${String(Number(verzija)).padStart(6, '0')}.json`));
      if (!stara || !Number.isInteger(Number(verzija))) throw new Greska(404, 'Verzija ne postoji');
      const novi = { ...stara.sadrzaj, verzija: trenutni.verzija + 1, azurirano: new Date().toISOString(), azurirao: ime };
      return spremi(novi, ime, `Vraćena verzija ${verzija}`);
    }),
    kljucevi: () => LOKALI.flatMap((l) => l.kategorije.map((k) => kljucKategorije(l.id, k.kljuc))),
  };
}
