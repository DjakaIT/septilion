<?php
// Provjera jelovnika — ista pravila kao src/data/sadrzaj.mjs (zod), jer isti jelovnik.json poslije čita izgradnja
// stranice. Strogo: nepoznata polja se odbijaju, tekst se obrezuje i ograničava, cijene i ključevi slika po pravilima.
// Greške su { putanja: [...], poruka } — uredništvo ih prikazuje uz polje.
declare(strict_types=1);

const FORMAT_SADRZAJA = 2;
const KLJUC_SLIKE = '/^(?:[a-z0-9_]{1,40}|n-[a-f0-9]{24})$/';
const ID_STAVKE = '/^[a-z0-9]{6,32}$/';

final class Provjera
{
    public array $greske = [];

    private function g(array $put, string $poruka): void { $this->greske[] = ['putanja' => $put, 'poruka' => $poruka]; }
    private static function jeObjekt(mixed $v): bool { return is_array($v) && ($v === [] || !array_is_list($v)); }

    /** objekt s točno zadanim ključevima (strict) */
    private function objekt(mixed $v, array $put, array $kljucevi): bool
    {
        if (!self::jeObjekt($v)) { $this->g($put, 'Očekuje se objekt'); return false; }
        $ok = true;
        foreach (array_keys($v) as $k) if (!in_array($k, $kljucevi, true)) { $this->g($put, "Nepoznato polje: $k"); $ok = false; }
        foreach ($kljucevi as $k) if (!array_key_exists($k, $v)) { $this->g([...$put, $k], 'Nedostaje vrijednost'); $ok = false; }
        return $ok;
    }

    private function niz(mixed $v, array $put, int $max): string
    {
        if (!is_string($v)) { $this->g($put, 'Očekuje se tekst'); return ''; }
        $s = obrezi($v);
        if (duljina16($s) > $max) $this->g($put, "Najviše $max znakova");
        return $s;
    }

    private function tekst(mixed $v, array $put, int $max): array
    {
        if (!$this->objekt($v, $put, ['hr', 'en'])) return ['hr' => '', 'en' => ''];
        return ['hr' => $this->niz($v['hr'], [...$put, 'hr'], $max), 'en' => $this->niz($v['en'], [...$put, 'en'], $max)];
    }

    private function cijena(mixed $v, array $put, bool $nullable = false): int|float|null
    {
        if ($v === null && $nullable) return null;
        if (!(is_int($v) || is_float($v)) || !is_finite((float) $v)) { $this->g($put, 'Upiši cijenu'); return null; }
        if ($v <= 0) $this->g($put, 'Cijena mora biti veća od 0');
        elseif ($v > 9999) $this->g($put, 'Provjeri cijenu');
        elseif (abs(round($v * 100) - $v * 100) >= 1e-6) $this->g($put, 'Najviše dvije decimale');
        return $v;
    }

    private function slika(mixed $v, array $put): ?string
    {
        if ($v === null) return null;
        if (!is_string($v) || !preg_match(KLJUC_SLIKE, $v)) { $this->g($put, 'Neispravan ključ fotografije'); return null; }
        return $v;
    }

    private function id(mixed $v, array $put): string
    {
        if (!is_string($v) || !preg_match(ID_STAVKE, $v)) { $this->g($put, 'Neispravan id stavke'); return ''; }
        return $v;
    }

    private function stavka(mixed $v, array $put): ?array
    {
        $tip = is_array($v) ? ($v['tip'] ?? null) : null;
        if ($tip === 'jelo') {
            if (!$this->objekt($v, $put, ['id', 'tip', 'naziv', 'opis', 'porcija', 'preporuka', 'cijena', 'kolicina', 'cijena2', 'kolicina2', 'slika', 'boja', 'galerija'])) return null;
            $boja = $v['boja'];
            if ($boja !== null && (!is_string($boja) || !preg_match('/^#[0-9A-Fa-f]{6}$/', $boja))) { $this->g([...$put, 'boja'], 'Neispravna boja'); $boja = null; }
            if (!is_bool($v['galerija'])) $this->g([...$put, 'galerija'], 'Očekuje se da/ne');
            return [
                'id' => $this->id($v['id'], [...$put, 'id']), 'tip' => 'jelo',
                'naziv' => $this->tekst($v['naziv'], [...$put, 'naziv'], 120), 'opis' => $this->tekst($v['opis'], [...$put, 'opis'], 600),
                'porcija' => $this->tekst($v['porcija'], [...$put, 'porcija'], 80), 'preporuka' => $this->tekst($v['preporuka'], [...$put, 'preporuka'], 200),
                'cijena' => $this->cijena($v['cijena'], [...$put, 'cijena']), 'kolicina' => $this->niz($v['kolicina'], [...$put, 'kolicina'], 20),
                'cijena2' => $this->cijena($v['cijena2'], [...$put, 'cijena2'], true), 'kolicina2' => $this->niz($v['kolicina2'], [...$put, 'kolicina2'], 20),
                'slika' => $this->slika($v['slika'], [...$put, 'slika']), 'boja' => $boja, 'galerija' => (bool) $v['galerija'],
            ];
        }
        if ($tip === 'skupina') {
            if (!$this->objekt($v, $put, ['id', 'tip', 'naslov', 'napomena', 'preporuka'])) return null;
            return [
                'id' => $this->id($v['id'], [...$put, 'id']), 'tip' => 'skupina',
                'naslov' => $this->tekst($v['naslov'], [...$put, 'naslov'], 80), 'napomena' => $this->tekst($v['napomena'], [...$put, 'napomena'], 80),
                'preporuka' => $this->tekst($v['preporuka'], [...$put, 'preporuka'], 200),
            ];
        }
        $this->g([...$put, 'tip'], 'Nepoznata vrsta stavke');
        return null;
    }

    /** oblik kategorije (zod Kategorija); vraća obrezanu kategoriju */
    public function kategorija(mixed $v, array $put): array
    {
        if (!$this->objekt($v, $put, ['naslov', 'slika', 'planet', 'napomena', 'stavke'])) return [];
        $stavke = [];
        if (!is_array($v['stavke']) || !array_is_list($v['stavke'])) $this->g([...$put, 'stavke'], 'Očekuje se popis');
        elseif (count($v['stavke']) > 400) $this->g([...$put, 'stavke'], 'Najviše 400 stavki');
        else foreach ($v['stavke'] as $i => $s) $stavke[] = $this->stavka($s, [...$put, 'stavke', $i]);
        return [
            'naslov' => $this->tekst($v['naslov'], [...$put, 'naslov'], 60), 'slika' => $this->slika($v['slika'], [...$put, 'slika']),
            'planet' => $this->slika($v['planet'], [...$put, 'planet']), 'napomena' => $this->tekst($v['napomena'], [...$put, 'napomena'], 400),
            'stavke' => $stavke,
        ];
    }

    /** oblik cijelog sadržaja (zod Sadrzaj) */
    public function sadrzaj(mixed $v): array
    {
        if (!$this->objekt($v, [], ['format', 'verzija', 'azurirano', 'azurirao', 'kategorije'])) return [];
        if ($v['format'] !== FORMAT_SADRZAJA) $this->g(['format'], 'Nepoznat format');
        if (!is_int($v['verzija']) || $v['verzija'] < 1) $this->g(['verzija'], 'Neispravna verzija');
        $kategorije = [];
        if (!self::jeObjekt($v['kategorije'])) $this->g(['kategorije'], 'Očekuje se objekt');
        else foreach ($v['kategorije'] as $k => $kat) $kategorije[(string) $k] = $this->kategorija($kat, ['kategorije', (string) $k]);
        return ['format' => $v['format'], 'verzija' => $v['verzija'], 'azurirano' => $this->niz($v['azurirano'], ['azurirano'], 40),
            'azurirao' => $this->niz($v['azurirao'], ['azurirao'], 40), 'kategorije' => $kategorije];
    }
}

/**
 * Nadogradnja starijeg sadržaja (kao migriraj u sadrzaj.mjs). Format 1 -> 2: jela Jellyfisha bez fotografije dobiju
 * zadanu prema nazivu (konfiguracija.json: zadaneFotografije). Ostalo ide dalje nepromijenjeno — provjera ga ionako odbije.
 */
function migriraj_sadrzaj(mixed $s, array $zadane): mixed
{
    if (!is_array($s) || ($s['format'] ?? null) !== 1 || !is_array($s['kategorije'] ?? null)) return $s;
    $kljuc = fn (mixed $n) => is_string($n) ? trim(preg_replace('/\s+/u', ' ', mb_strtolower($n, 'UTF-8'))) : '';
    foreach ($s['kategorije'] as $kk => $k) {
        if (!str_starts_with((string) $kk, 'jellyfish-in-space/') || !is_array($k['stavke'] ?? null)) continue;
        foreach ($k['stavke'] as $i => $x) {
            if (!is_array($x) || ($x['tip'] ?? null) !== 'jelo' || !array_key_exists('slika', $x) || $x['slika'] !== null) continue;
            $z = $zadane[$kljuc($x['naziv']['hr'] ?? null)] ?? null;
            if (is_string($z)) $s['kategorije'][$kk]['stavke'][$i]['slika'] = $z;
        }
    }
    $s['format'] = 2;
    return $s;
}

/** pravila po kategoriji (lokali: polja koja kategorija ima) — kao provjeriKategoriju u sadrzaj.mjs */
function provjeri_kategoriju(array $kat, array $k, array $boje, callable $slikaPostoji): array
{
    $g = [];
    $ima = fn (string $p) => in_array($p, $kat['polja'], true);
    if ($ima('naslov') && $k['naslov']['hr'] === '') $g[] = ['putanja' => ['naslov', 'hr'], 'poruka' => 'Upiši naslov kategorije'];
    foreach (['slika', 'planet'] as $polje) {
        if ($k[$polje] !== null && !$slikaPostoji($k[$polje])) $g[] = ['putanja' => [$polje], 'poruka' => 'Fotografija ne postoji'];
    }
    if (!array_filter($k['stavke'], fn ($s) => $s['tip'] === 'jelo')) $g[] = ['putanja' => ['stavke'], 'poruka' => 'Kategorija mora imati barem jedno jelo'];
    $ids = [];
    $dopusteneBoje = array_map(fn ($b) => strtolower($b['vrijednost']), $boje);
    foreach ($k['stavke'] as $i => $s) {
        $p = fn (...$x) => ['stavke', $i, ...$x];
        if (isset($ids[$s['id']])) $g[] = ['putanja' => $p('id'), 'poruka' => 'Dvostruki id stavke'];
        $ids[$s['id']] = true;
        if ($s['tip'] === 'skupina') {
            if (!$ima('skupine')) $g[] = ['putanja' => $p(), 'poruka' => 'Ova kategorija nema skupine'];
            continue;
        }
        if ($s['naziv']['hr'] === '') $g[] = ['putanja' => $p('naziv', 'hr'), 'poruka' => 'Upiši naziv jela'];
        if ($ima('slika') && !$s['slika']) $g[] = ['putanja' => $p('slika'), 'poruka' => 'Dodaj fotografiju jela'];
        if ($s['slika'] && !$slikaPostoji($s['slika'])) $g[] = ['putanja' => $p('slika'), 'poruka' => 'Fotografija ne postoji'];
        if ($ima('boja') && !in_array(strtolower($s['boja'] ?? ''), $dopusteneBoje, true)) $g[] = ['putanja' => $p('boja'), 'poruka' => 'Odaberi boju naljepnice'];
        if ($s['cijena2'] !== null && !$ima('cijena2')) $g[] = ['putanja' => $p('cijena2'), 'poruka' => 'Ova kategorija nema drugu cijenu'];
        if (($s['kolicina'] !== '' || $s['kolicina2'] !== '') && !$ima('kolicina')) $g[] = ['putanja' => $p('kolicina'), 'poruka' => 'Ova kategorija nema količinu'];
        if ($s['kolicina2'] !== '' && $s['cijena2'] === null) $g[] = ['putanja' => $p('cijena2'), 'poruka' => 'Upiši drugu cijenu ili obriši drugu količinu'];
    }
    return $g;
}

/** cijeli sadržaj: oblik + pravila + točno kategorije iz konfiguracije; ['ok' => true, 'sadrzaj'] ili ['ok' => false, 'greske'] */
function provjeri_sadrzaj(mixed $ulaz, array $lokali, array $boje, callable $slikaPostoji): array
{
    $p = new Provjera();
    $s = $p->sadrzaj($ulaz);
    if ($p->greske) return ['ok' => false, 'greske' => $p->greske];
    $greske = [];
    $ocekivano = [];
    foreach ($lokali as $l) foreach ($l['kategorije'] as $kat) $ocekivano["{$l['id']}/{$kat['kljuc']}"] = $kat;
    foreach (array_keys($s['kategorije']) as $k) if (!isset($ocekivano[$k])) $greske[] = ['putanja' => ['kategorije', $k], 'poruka' => 'Nepoznata kategorija'];
    foreach ($ocekivano as $kk => $kat) {
        if (!isset($s['kategorije'][$kk])) { $greske[] = ['putanja' => ['kategorije', $kk], 'poruka' => 'Nedostaje kategorija']; continue; }
        foreach (provjeri_kategoriju($kat, $s['kategorije'][$kk], $boje, $slikaPostoji) as $e) $greske[] = ['putanja' => ['kategorije', $kk, ...$e['putanja']], 'poruka' => $e['poruka']];
    }
    return $greske ? ['ok' => false, 'greske' => $greske] : ['ok' => true, 'sadrzaj' => $s];
}
