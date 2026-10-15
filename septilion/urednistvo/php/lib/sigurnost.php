<?php
// Lozinke, dvostruka potvrda (TOTP, RFC 6238) i rezervni kodovi — samo ugrađene PHP funkcije.
//  - lozinke: Argon2id (OWASP: m=19 MiB, t=2, p=1); bez njega bcrypt (cost 12) nad SHA-256 (bcrypt reže na 72 bajta)
//  - TOTP: SHA-1, 6 znamenki, 30 s, ±1 korak, isti ili stariji korak se ne prihvaća dvaput
//  - rezervni kodovi: jednokratni, spremaju se samo kao SHA-256
declare(strict_types=1);

function normaliziraj_lozinku(string $l): string
{
    return class_exists('Normalizer') ? (Normalizer::normalize($l, Normalizer::FORM_KC) ?: $l) : $l;
}

function hash_lozinke(string $lozinka): string
{
    $l = normaliziraj_lozinku($lozinka);
    if (defined('PASSWORD_ARGON2ID')) return password_hash($l, PASSWORD_ARGON2ID, ['memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1]);
    return password_hash(base64_encode(hash('sha256', $l, true)), PASSWORD_BCRYPT, ['cost' => 12]);
}

function provjeri_lozinku(string $lozinka, ?string $zapis): bool
{
    if (!$zapis) return false;
    $l = normaliziraj_lozinku($lozinka);
    if (str_starts_with($zapis, '$2y$')) $l = base64_encode(hash('sha256', $l, true));
    return password_verify($l, $zapis);
}

/** lažni zapis: provjera traje jednako dugo i kad korisnik ne postoji (napadač ne može pogađati imena) */
function lazni_zapis(): string
{
    static $z = null;
    return $z ??= hash_lozinke(nasumicno());
}

const CESTE_LOZINKE = ['123456789012', 'password1234', 'lozinka12345', 'qwertyuiopas', 'septillion12', 'pastarhymes1', 'jellyfish123', 'zagreb123456',
    'administrator', 'iloveyou1234', '111111111111', 'abcdefghijkl', 'welcome12345', 'letmein12345', 'passw0rd1234'];

/** poruka greške ili null ako je lozinka u redu (ista pravila kao Node) */
function provjeri_novu_lozinku(mixed $lozinka, string $ime = ''): ?string
{
    $l = is_string($lozinka) ? $lozinka : '';
    if (duljina16($l) < 12) return 'Lozinka mora imati barem 12 znakova (najbolje nekoliko riječi).';
    if (duljina16($l) > 200) return 'Lozinka je predugačka.';
    $n = mb_strtolower($l, 'UTF-8');
    if ($ime !== '' && str_contains($n, mb_strtolower($ime, 'UTF-8'))) return 'Lozinka ne smije sadržavati korisničko ime.';
    if (count(array_unique(mb_str_split($n, 1, 'UTF-8'))) < 5) return 'Lozinka ima premalo različitih znakova.';
    foreach (CESTE_LOZINKE as $c) if (str_contains($n, $c)) return 'Lozinka je prečesta, odaberi drugu.';
    return null;
}

// ---------------- TOTP ----------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_KORAK = 30;

function base32(string $bin): string
{
    $bitovi = 0; $v = 0; $izlaz = '';
    foreach (str_split($bin) as $c) {
        $v = (($v << 8) | ord($c)) & 0xFFFF; $bitovi += 8;
        while ($bitovi >= 5) { $izlaz .= B32[($v >> ($bitovi - 5)) & 31]; $bitovi -= 5; }
    }
    if ($bitovi > 0) $izlaz .= B32[($v << (5 - $bitovi)) & 31];
    return $izlaz;
}
function iz_base32(string $s): string
{
    $c = preg_replace('/[^A-Z2-7]/', '', strtoupper($s));
    $bitovi = 0; $v = 0; $izlaz = '';
    foreach (str_split($c) as $z) {
        if ($z === '') continue;
        $v = (($v << 5) | strpos(B32, $z)) & 0xFFFF; $bitovi += 5;
        if ($bitovi >= 8) { $izlaz .= chr(($v >> ($bitovi - 8)) & 255); $bitovi -= 8; }
    }
    return $izlaz;
}
function nova_totp_tajna(): string { return base32(random_bytes(20)); }
function trenutni_korak(?int $sadMs = null): int { return intdiv($sadMs ?? sad_ms(), TOTP_KORAK * 1000); }
function totp_kod(string $tajna, int $korak): string
{
    $h = hash_hmac('sha1', pack('J', $korak), iz_base32($tajna), true);
    $o = ord($h[19]) & 15;
    $n = ((ord($h[$o]) & 127) << 24) | (ord($h[$o + 1]) << 16) | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
    return str_pad((string) ($n % 1000000), 6, '0', STR_PAD_LEFT);
}
/** potrošeni korak ili null */
function provjeri_totp(string $tajna, mixed $kod, int $zadnjiKorak = -1): ?int
{
    $k = preg_replace('/\s/', '', is_scalar($kod) ? (string) $kod : '');
    if (!preg_match('/^\d{6}$/', $k)) return null;
    $t = trenutni_korak();
    foreach ([$t - 1, $t, $t + 1] as $korak) {
        if ($korak <= $zadnjiKorak) continue;
        if (hash_equals(totp_kod($tajna, $korak), $k)) return $korak;
    }
    return null;
}
function otpauth_uri(string $tajna, string $ime): string
{
    $izdavac = 'Septillion uredništvo';
    return 'otpauth://totp/' . rawurlencode("$izdavac:$ime") . "?secret=$tajna&issuer=" . rawurlencode($izdavac) . '&algorithm=SHA1&digits=6&period=' . TOTP_KORAK;
}

// ---------------- rezervni kodovi ----------------
const ABC_KODA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez 0/O, 1/I/L
function normaliziraj_kod(mixed $kod): string { return preg_replace('/[^A-Z0-9]/', '', strtoupper(is_scalar($kod) ? (string) $kod : '')); }
function nasumicni_kod(int $znakova): string
{
    $s = '';
    foreach (str_split(random_bytes($znakova)) as $b) $s .= ABC_KODA[ord($b) % strlen(ABC_KODA)];
    return $s;
}
function novi_rezervni_kodovi(int $n = 8): array
{
    $kodovi = [];
    for ($i = 0; $i < $n; $i++) { $s = nasumicni_kod(10); $kodovi[] = substr($s, 0, 5) . '-' . substr($s, 5); }
    return ['kodovi' => $kodovi, 'hashevi' => array_map(fn ($k) => sha256(normaliziraj_kod($k)), $kodovi)];
}
/** indeks iskorištenog koda ili -1 */
function pronadji_rezervni(mixed $kod, array $hashevi): int
{
    $h = sha256(normaliziraj_kod($kod));
    foreach ($hashevi as $i => $x) if (is_string($x) && hash_equals($x, $h)) return $i;
    return -1;
}
