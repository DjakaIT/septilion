// Prvo postavljanje (još nema nijednog korisnika) — uvijek na /urednistvo, bez posebne poveznice.
// Lokalno (zahtjev s ovog računala, ne produkcija) račun se postavlja odmah. Na serveru treba kod iz datoteke
// PRVO-POSTAVLJANJE.txt u mapi s podacima: vidi je samo tko ima pristup serveru (npr. cPanel -> File Manager).
// Kod je stalan dok se ne iskoristi (ne mijenja se pri ponovnom pokretanju); datoteka se briše nakon postavljanja.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pisiAtomarno } from './datoteke.mjs';
import { jednako } from './sigurnost.mjs';

const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez 0/O, 1/I/L
const normaliziraj = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function postavljanje(podaciDir, adresa) {
  const datoteka = path.join(podaciDir, 'PRVO-POSTAVLJANJE.txt');

  /** kod iz datoteke; stvara ga ako ga još nema */
  function kod() {
    try {
      const m = /^ {2}([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})$/m.exec(fs.readFileSync(datoteka, 'utf8'));
      if (m) return m[1];
    } catch { /* nema datoteke */ }
    const s = Array.from(crypto.randomBytes(15), (b) => ABC[b % ABC.length]).join('');
    const k = `${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10)}`;
    pisiAtomarno(datoteka, `Septillion uredništvo — prvo postavljanje\n\nOtvori ${adresa}/urednistvo i upiši ovaj kod:\n\n  ${k}\n\n`
      + 'Kod vrijedi dok se ne postavi prvi račun; nakon toga se ova datoteka sama briše.\n');
    return k;
  }

  return {
    kod,
    datoteka,
    provjeri: (unos) => jednako(normaliziraj(unos), normaliziraj(kod())),
    ukloni: () => fs.rmSync(datoteka, { force: true }),
  };
}
