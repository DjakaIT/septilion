// Kriptografija uredništva — samo ugrađeni node:crypto, bez vanjskih paketa.
//  - lozinke: scrypt (OWASP: N=2^17, r=8, p=1), sol po korisniku, usporedba u stalnom vremenu
//  - dvostruka potvrda: TOTP (RFC 6238, SHA-1, 6 znamenki, 30 s), zaštita od ponovne upotrebe koda
//  - rezervni kodovi: jednokratni, spremaju se samo kao SHA-256
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const DULJINA = 64;

export const nasumicno = (bajtova = 32) => crypto.randomBytes(bajtova).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
/** usporedba nizova u stalnom vremenu (i za različite duljine) */
export function jednako(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------------- lozinke ----------------
export async function hashLozinke(lozinka) {
  const sol = crypto.randomBytes(16);
  const h = await scrypt(String(lozinka).normalize('NFKC'), sol, DULJINA, SCRYPT);
  return `scrypt$${Math.log2(SCRYPT.N)}$${SCRYPT.r}$${SCRYPT.p}$${sol.toString('base64')}$${h.toString('base64')}`;
}

export async function provjeriLozinku(lozinka, zapis) {
  const [vrsta, logN, r, p, sol, h] = String(zapis ?? '').split('$');
  if (vrsta !== 'scrypt') return false;
  const ocekivano = Buffer.from(h, 'base64');
  const dobiveno = await scrypt(String(lozinka).normalize('NFKC'), Buffer.from(sol, 'base64'), ocekivano.length,
    { N: 2 ** Number(logN), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return dobiveno.length === ocekivano.length && crypto.timingSafeEqual(dobiveno, ocekivano);
}

// lažni zapis: provjera traje jednako dugo i kad korisnik ne postoji (napadač ne može pogađati imena)
let lazni = null;
export async function lazniZapis() { return (lazni ??= await hashLozinke(nasumicno())); }

// česte lozinke i obrasci (kratak popis; glavna zaštita je duljina + dvostruka potvrda + ograničenje pokušaja)
const CESTE = ['123456789012', 'password1234', 'lozinka12345', 'qwertyuiopas', 'septillion12', 'pastarhymes1', 'jellyfish123', 'zagreb123456',
  'administrator', 'iloveyou1234', '111111111111', 'abcdefghijkl', 'welcome12345', 'letmein12345', 'passw0rd1234'];
/** @returns {string|null} poruka greške ili null ako je lozinka u redu */
export function provjeriNovuLozinku(lozinka, ime = '') {
  const l = String(lozinka ?? '');
  if (l.length < 12) return 'Lozinka mora imati barem 12 znakova (najbolje nekoliko riječi).';
  if (l.length > 200) return 'Lozinka je predugačka.';
  const n = l.toLowerCase();
  if (ime && n.includes(String(ime).toLowerCase())) return 'Lozinka ne smije sadržavati korisničko ime.';
  if (new Set(n).size < 5) return 'Lozinka ima premalo različitih znakova.';
  if (CESTE.some((c) => n.includes(c))) return 'Lozinka je prečesta, odaberi drugu.';
  return null;
}

// ---------------- TOTP (RFC 6238) ----------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bits = 0, v = 0, out = '';
  for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(v << (5 - bits)) & 31];
  return out;
}
export function izBase32(s) {
  const c = String(s).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, v = 0; const out = [];
  for (const ch of c) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export const novaTotpTajna = () => base32(crypto.randomBytes(20));
export const KORAK = 30;
export const trenutniKorak = (sad = Date.now()) => Math.floor(sad / 1000 / KORAK);

/** HOTP vrijednost za korak (RFC 4226), 6 znamenki */
export function totpKod(tajna, korak, znamenki = 6) {
  const brojac = Buffer.alloc(8);
  brojac.writeBigUInt64BE(BigInt(korak));
  const h = crypto.createHmac('sha1', izBase32(tajna)).update(brojac).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** znamenki).padStart(znamenki, '0');
}

/**
 * Provjera koda: dopušta ±1 korak (sat mobitela malo kasni), a isti ili stariji korak se ne prihvaća dvaput.
 * @returns {number|null} korak koji je potrošen ili null
 */
export function provjeriTotp(tajna, kod, zadnjiKorak = -1, sad = Date.now()) {
  const k = String(kod ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(k)) return null;
  const t = trenutniKorak(sad);
  for (const korak of [t - 1, t, t + 1]) {
    if (korak <= zadnjiKorak) continue;
    if (jednako(totpKod(tajna, korak), k)) return korak;
  }
  return null;
}

export function otpauthUri(tajna, ime) {
  const izdavac = 'Septillion uredništvo';
  return `otpauth://totp/${encodeURIComponent(`${izdavac}:${ime}`)}?secret=${tajna}&issuer=${encodeURIComponent(izdavac)}&algorithm=SHA1&digits=6&period=${KORAK}`;
}

// ---------------- rezervni kodovi ----------------
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez 0/O, 1/I/L
const normaliziraj = (kod) => String(kod ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function noviRezervniKodovi(n = 8) {
  const kodovi = Array.from({ length: n }, () => {
    const b = crypto.randomBytes(10);
    const s = Array.from(b, (x) => ABC[x % ABC.length]).join('');
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { kodovi, hashevi: kodovi.map((k) => sha256(normaliziraj(k))) };
}
/** @returns {number} indeks iskorištenog koda ili -1 */
export function pronadjiRezervni(kod, hashevi) {
  const h = sha256(normaliziraj(kod));
  return (hashevi ?? []).findIndex((x) => jednako(x, h));
}
