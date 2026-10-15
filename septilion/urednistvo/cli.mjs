// Naredbe za korisnike uredništva (pokreću se na poslužitelju, tamo gdje su podaci):
//   npm run urednistvo:pozivnica -- tomislav              pozivnica (korisnik sam postavi lozinku i dvostruku potvrdu)
//   npm run urednistvo:pozivnica -- tomislav --resetiraj  zaboravljena lozinka / izgubljen mobitel: nova pozivnica, odjava svugdje
//   npm run urednistvo:korisnici                          popis korisnika
//   npm run urednistvo:obrisi -- tomislav                 brisanje korisnika (odmah gubi pristup)
import { postavke } from './lib/postavke.mjs';
import { ucitajEnv } from './lib/env.mjs';
import { korisnici as korisniciStore, POZIVNICA_TRAJE_MS, stanjeRacuna } from './lib/korisnici.mjs';

const [naredba, ime, ...ostalo] = process.argv.slice(2);
ucitajEnv();
const p = postavke();
const k = korisniciStore(p.podaci);

try {
  if (naredba === 'pozivnica' && ime) {
    const token = k.pozivnica(ime, { resetiraj: ostalo.includes('--resetiraj') });
    console.log(`\nPozivnica za "${ime.toLowerCase()}" (vrijedi ${POZIVNICA_TRAJE_MS / 3600000} h, jednokratna):\n\n  ${p.origin}/urednistvo/#pozivnica=${token}\n`);
    console.log('Pošalji je osobno (npr. porukom). Tko je otvori, postavlja lozinku i dvostruku potvrdu.\n');
  } else if (naredba === 'popis') {
    const sve = k.sve().korisnici;
    if (!sve.length) console.log(`Nema korisnika. Prvi račun se postavlja na ${p.origin}/urednistvo.`);
    for (const x of sve) {
      console.log(`${x.ime.padEnd(20)} ${(x.uloga ?? 'urednik').padEnd(9)} ${stanjeRacuna(x).padEnd(24)} zadnja prijava: ${x.zadnjaPrijava ?? '—'}  rezervnih kodova: ${x.rezervni?.length ?? 0}`);
    }
  } else if (naredba === 'obrisi' && ime) {
    k.obrisi(ime);
    console.log(`Korisnik "${ime}" obrisan.`);
  } else {
    console.log('Upotreba: pozivnica <ime> [--resetiraj] | popis | obrisi <ime>');
    process.exitCode = 1;
  }
} catch (e) {
  console.error(`Greška: ${e.message}`);
  process.exitCode = 1;
}
