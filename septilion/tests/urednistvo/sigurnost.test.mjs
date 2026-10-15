// Kriptografija uredništva: scrypt, TOTP (RFC 6238 vektori), zaštita od ponovne upotrebe koda, rezervni kodovi, pravila lozinke.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashLozinke, provjeriLozinku, totpKod, provjeriTotp, base32, izBase32, noviRezervniKodovi, pronadjiRezervni, provjeriNovuLozinku, jednako,
} from '../../urednistvo/lib/sigurnost.mjs';

test('scrypt: ispravna i kriva lozinka, sol po hashu, OWASP parametri', async () => {
  const h1 = await hashLozinke('plava kaseta svira jazz');
  const h2 = await hashLozinke('plava kaseta svira jazz');
  assert.match(h1, /^scrypt\$17\$8\$1\$/);
  assert.notEqual(h1, h2, 'ista lozinka mora dati različit hash (sol)');
  assert.equal(await provjeriLozinku('plava kaseta svira jazz', h1), true);
  assert.equal(await provjeriLozinku('plava kaseta svira jaz', h1), false);
  assert.equal(await provjeriLozinku('x', 'nije-hash'), false);
});

test('TOTP: službeni vektori RFC 6238 (SHA-1)', () => {
  const tajna = base32(Buffer.from('12345678901234567890'));
  assert.equal(tajna, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.deepEqual(izBase32(tajna), Buffer.from('12345678901234567890'));
  for (const [t, ocek] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']]) {
    assert.equal(totpKod(tajna, Math.floor(t / 30)), ocek, `T=${t}`);
  }
});

test('TOTP: ±1 korak, ali isti ili stariji korak se ne prihvaća dvaput', () => {
  const tajna = base32(Buffer.from('12345678901234567890'));
  const sad = 1_700_000_000_000, korak = Math.floor(sad / 30000);
  assert.equal(provjeriTotp(tajna, totpKod(tajna, korak), -1, sad), korak);
  assert.equal(provjeriTotp(tajna, totpKod(tajna, korak - 1), -1, sad), korak - 1);
  assert.equal(provjeriTotp(tajna, totpKod(tajna, korak + 2), -1, sad), null, 'predaleko u budućnosti');
  assert.equal(provjeriTotp(tajna, totpKod(tajna, korak), korak, sad), null, 'ponovljeni kod');
  assert.equal(provjeriTotp(tajna, '12345', -1, sad), null);
  assert.equal(provjeriTotp(tajna, 'abcdef', -1, sad), null);
});

test('rezervni kodovi: spremaju se samo kao hash, svaki se prepoznaje (bez obzira na crticu i mala slova)', () => {
  const { kodovi, hashevi } = noviRezervniKodovi();
  assert.equal(kodovi.length, 8);
  assert.equal(new Set(kodovi).size, 8);
  assert.ok(hashevi.every((h) => /^[a-f0-9]{64}$/.test(h)) && !hashevi.some((h) => kodovi.includes(h)));
  assert.equal(pronadjiRezervni(kodovi[3], hashevi), 3);
  assert.equal(pronadjiRezervni(kodovi[3].toLowerCase().replace('-', ''), hashevi), 3);
  assert.equal(pronadjiRezervni('AAAAA-AAAAA', hashevi), -1);
});

test('pravila lozinke', () => {
  assert.match(provjeriNovuLozinku('kratka'), /12 znakova/);
  assert.match(provjeriNovuLozinku('tomislav je glavni kuhar', 'tomislav'), /korisničko ime/);
  assert.match(provjeriNovuLozinku('aaaaaaaaaaaaaaaa'), /različitih/);
  assert.match(provjeriNovuLozinku('Password1234!!'), /prečesta/);
  assert.equal(provjeriNovuLozinku('plava kaseta svira jazz', 'tomislav'), null);
  assert.equal(jednako('abc', 'abc'), true);
  assert.equal(jednako('abc', 'abcd'), false);
});

test('QR biblioteka u sučelju je ista kao paket qrcode-generator (nadogradnje ne prolaze neprimijećeno)', async () => {
  const { readFileSync } = await import('node:fs');
  const { ROOT } = await import('../../urednistvo/lib/postavke.mjs');
  const kopija = readFileSync(`${ROOT}/urednistvo/sucelje/qrcode.mjs`, 'utf8');
  const paket = readFileSync(`${ROOT}/node_modules/qrcode-generator/dist/qrcode.mjs`, 'utf8');
  assert.equal(kopija, paket, 'kopiraj node_modules/qrcode-generator/dist/qrcode.mjs u urednistvo/sucelje/qrcode.mjs');
});
