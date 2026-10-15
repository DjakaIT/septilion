<?php
// Osnova PHP uredništva (hosting bez Node.js-a): greške, datoteke, JSON, kriptografija.
// Ugovor i pravila su isti kao u Node inačici (urednistvo/lib/*.mjs); testovi tests/urednistvo/ provjeravaju obje.
declare(strict_types=1);

final class Greska extends RuntimeException
{
    public function __construct(public int $status, string $poruka, public array $podaci = [])
    {
        parent::__construct($poruka);
    }
}

// ---------------- vrijeme ----------------
function sad_ms(): int { return (int) floor(microtime(true) * 1000); }
function iso_vrijeme(?int $ms = null): string
{
    $ms ??= sad_ms();
    return gmdate('Y-m-d\TH:i:s', intdiv($ms, 1000)) . sprintf('.%03dZ', $ms % 1000);
}

// ---------------- datoteke ----------------
/** privremena datoteka u istoj mapi + fsync + preimenovanje: datoteka nikad nije napola zapisana */
function pisi_atomarno(string $put, string $sadrzaj, int $mode = 0600): void
{
    $dir = dirname($put);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException("Ne mogu stvoriti mapu $dir");
    $tmp = $put . '.' . bin2hex(random_bytes(6)) . '.tmp';
    $f = @fopen($tmp, 'xb');
    if ($f === false) throw new RuntimeException("Ne mogu pisati u $dir");
    try {
        if (fwrite($f, $sadrzaj) !== strlen($sadrzaj)) throw new RuntimeException("Zapis nije potpun ($put)");
        fflush($f);
        if (function_exists('fsync')) fsync($f);
    } finally {
        fclose($f);
    }
    @chmod($tmp, $mode);
    if (!@rename($tmp, $put)) { @unlink($tmp); throw new RuntimeException("Ne mogu spremiti $put"); }
}

function u_json(mixed $v, bool $lijepo = false): string
{
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR | ($lijepo ? JSON_PRETTY_PRINT : 0));
}
function iz_json(string $s): mixed { return json_decode($s, true, 64, JSON_THROW_ON_ERROR); }
function pisi_json(string $put, mixed $v): void { pisi_atomarno($put, u_json($v, true)); }
function citaj_json(string $put, mixed $zadano = null): mixed
{
    if (!is_file($put)) return $zadano;
    $s = @file_get_contents($put);
    if ($s === false) return $zadano;
    return iz_json($s);
}

/** isključiva brava nad mapom podataka (spremanje, korisnici, ograničenja) — zahtjevi idu jedan za drugim */
function s_bravom(string $dir, callable $fn): mixed
{
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $f = fopen($dir . '/.brava', 'c');
    if ($f === false) throw new RuntimeException('Ne mogu zaključati podatke');
    try {
        flock($f, LOCK_EX);
        return $fn();
    } finally {
        flock($f, LOCK_UN);
        fclose($f);
    }
}

// ---------------- kriptografija ----------------
function nasumicno(int $bajtova = 32): string { return rtrim(strtr(base64_encode(random_bytes($bajtova)), '+/', '-_'), '='); }
function sha256(string $s): string { return hash('sha256', $s); }
/** usporedba u stalnom vremenu */
function jednako(mixed $a, mixed $b): bool { return is_string($a) && is_string($b) && hash_equals($a, $b); }

/** duljina kao u JavaScriptu (UTF-16 jedinice) — ista ograničenja kao provjera pri izgradnji stranice */
function duljina16(string $s): int { return intdiv(strlen(mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')), 2); }
/** trim kao String.prototype.trim (i Unicode razmaci) */
function obrezi(string $s): string { return preg_replace('/^[\s\p{Zs}\x{FEFF}\x{2028}\x{2029}]+|[\s\p{Zs}\x{FEFF}\x{2028}\x{2029}]+$/u', '', $s) ?? $s; }
