<?php
// Korisnici (podaci/korisnici.json, prava 600). Nikad se ne spremaju lozinke ni tokeni, samo hashevi.
// Uloge: 'admin' (prvi račun; poziva i uklanja druge) i 'urednik' (uređuje jelovnik).
declare(strict_types=1);

const POZIVNICA_TRAJE_MS = 72 * 3600 * 1000;
const PORUKA_IME = 'Korisničko ime: 2–32 znaka, mala slova, brojke, točka, crtica.';

function normaliziraj_ime(mixed $ime): string { return mb_strtolower(obrezi(is_scalar($ime) ? (string) $ime : ''), 'UTF-8'); }
function ispravno_ime(string $ime): bool { return (bool) preg_match('/^[a-z0-9][a-z0-9._-]{1,31}$/', $ime); }
function stanje_racuna(array $k): string
{
    if (empty($k['lozinka'])) return (($k['pozivnica']['istjece'] ?? 0) > sad_ms()) ? 'čeka pozivnicu' : 'pozivnica istekla';
    return !empty($k['totp']) ? 'aktivan' : 'bez dvostruke potvrde';
}

final class Korisnici
{
    private string $datoteka;

    public function __construct(private string $dir) { $this->datoteka = $dir . '/korisnici.json'; }

    public function sve(): array { return citaj_json($this->datoteka, ['korisnici' => []]); }
    public function broj(): int { return count($this->sve()['korisnici']); }

    public function pronadji(mixed $ime): ?array
    {
        $n = normaliziraj_ime($ime);
        foreach ($this->sve()['korisnici'] as $k) if ($k['ime'] === $n) return $k;
        return null;
    }

    /** promjena jednog korisnika pod bravom (čita svježe stanje, piše odmah); vraća novi zapis */
    public function promijeni(string $ime, callable $fn): array
    {
        return s_bravom($this->dir, function () use ($ime, $fn) {
            $podaci = $this->sve();
            foreach ($podaci['korisnici'] as $i => $k) {
                if ($k['ime'] !== normaliziraj_ime($ime)) continue;
                $podaci['korisnici'][$i] = $fn($k);
                pisi_json($this->datoteka, $podaci);
                return $podaci['korisnici'][$i];
            }
            throw new Greska(404, 'Korisnik ne postoji.');
        });
    }

    private static function novi(string $ime, string $uloga): array
    {
        return ['ime' => $ime, 'uloga' => $uloga, 'lozinka' => null, 'totp' => null, 'rezervni' => [], 'zadnjiKorak' => -1, 'sesijaVerzija' => 1,
            'kreiran' => iso_vrijeme(), 'zadnjaPrijava' => null];
    }

    /** prvi račun (prvo postavljanje): administrator */
    public function stvoriPrvog(string $ime): void
    {
        s_bravom($this->dir, function () use ($ime) {
            $podaci = $this->sve();
            if ($podaci['korisnici']) throw new Greska(409, 'Uredništvo je već postavljeno. Prijavi se.');
            $podaci['korisnici'][] = self::novi($ime, 'admin');
            pisi_json($this->datoteka, $podaci);
        });
    }

    /** nova pozivnica (i novi korisnik ako ne postoji); resetiraj = nova lozinka i dvostruka potvrda, odjava svugdje */
    public function pozivnica(string $ime, bool $resetiraj = false): string
    {
        $n = normaliziraj_ime($ime);
        if (!ispravno_ime($n)) throw new Greska(422, PORUKA_IME);
        $token = nasumicno(32);
        s_bravom($this->dir, function () use ($n, $resetiraj, $token) {
            $podaci = $this->sve();
            $i = null;
            foreach ($podaci['korisnici'] as $j => $k) if ($k['ime'] === $n) $i = $j;
            if ($i === null) {
                $podaci['korisnici'][] = self::novi($n, $podaci['korisnici'] ? 'urednik' : 'admin');
                $i = array_key_last($podaci['korisnici']);
            } elseif ($resetiraj) {
                $podaci['korisnici'][$i] = array_merge($podaci['korisnici'][$i], ['lozinka' => null, 'totp' => null, 'rezervni' => [], 'zadnjiKorak' => -1,
                    'sesijaVerzija' => ($podaci['korisnici'][$i]['sesijaVerzija'] ?? 1) + 1]);
            } elseif (!empty($podaci['korisnici'][$i]['lozinka'])) {
                throw new Greska(409, "Korisnik \"$n\" već postoji.");
            }
            $podaci['korisnici'][$i]['pozivnica'] = ['hash' => sha256($token), 'istjece' => sad_ms() + POZIVNICA_TRAJE_MS];
            pisi_json($this->datoteka, $podaci);
        });
        return $token;
    }

    /** korisnik za valjanu pozivnicu (token se uspoređuje kao hash, u stalnom vremenu) */
    public function poPozivnici(mixed $token): ?array
    {
        if (!is_string($token) || strlen($token) < 20 || strlen($token) > 100) return null;
        $h = sha256($token);
        foreach ($this->sve()['korisnici'] as $k) {
            if (!empty($k['pozivnica']) && $k['pozivnica']['istjece'] > sad_ms() && hash_equals($k['pozivnica']['hash'], $h)) return $k;
        }
        return null;
    }

    public function obrisi(string $ime): void
    {
        s_bravom($this->dir, function () use ($ime) {
            $podaci = $this->sve();
            $prije = count($podaci['korisnici']);
            $podaci['korisnici'] = array_values(array_filter($podaci['korisnici'], fn ($k) => $k['ime'] !== normaliziraj_ime($ime)));
            if (count($podaci['korisnici']) === $prije) throw new Greska(404, 'Korisnik ne postoji.');
            pisi_json($this->datoteka, $podaci);
        });
    }
}
