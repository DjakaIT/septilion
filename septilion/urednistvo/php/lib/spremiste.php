<?php
// Konfiguracija (generira je izgradnja: urednistvo/php/pripremi.mjs) i jelovnik uredništva:
// podaci/jelovnik.json + povijest verzija (podaci/povijest/) + dnevnik promjena (podaci/dnevnik.log).
// Svako spremanje: provjera (sadrzaj.php) -> nova verzija -> atomarno pisanje. Sukob verzija = 409.
declare(strict_types=1);

const ZADRZI_VERZIJA = 60;

/** lokali, boje, javna adresa, lokalne slike i početni sadržaj — sve iz istih datoteka kao stranica (src/data) */
final class Konfiguracija
{
    public readonly array $lokali;
    public readonly array $boje;
    public readonly string $origin;
    public readonly array $lokalneSlike;
    /** zadane fotografije jela Jellyfisha (naziv malim slovima -> ključ slike) za nadogradnju formata 1 */
    public readonly array $zadaneFotografije;

    public function __construct(public readonly string $dir)
    {
        $k = citaj_json($dir . '/konfiguracija.json');
        if (!is_array($k)) throw new RuntimeException('Nema konfiguracija.json (pokreni urednistvo/php/pripremi.mjs)');
        $this->lokali = $k['lokali'];
        $this->boje = $k['boje'];
        $this->origin = rtrim($k['origin'], '/');
        $this->lokalneSlike = array_flip($k['lokalneSlike']);
        $this->zadaneFotografije = $k['zadaneFotografije'] ?? [];
    }

    public function pocetni(): array { return citaj_json($this->dir . '/pocetni.json'); }
    public function kategorija(string $kljuc): ?array
    {
        [$l, $k] = array_pad(explode('/', $kljuc, 2), 2, '');
        foreach ($this->lokali as $lokal) {
            if ($lokal['id'] !== $l) continue;
            foreach ($lokal['kategorije'] as $kat) if ($kat['kljuc'] === $k) return ['lokal' => $lokal, 'kat' => $kat];
        }
        return null;
    }
}

final class Spremiste
{
    private string $datoteka;
    private string $povijestDir;

    public function __construct(private string $dir, private Konfiguracija $konf, private Closure $slikaPostoji)
    {
        $this->datoteka = $dir . '/jelovnik.json';
        $this->povijestDir = $dir . '/povijest';
    }

    public function dnevnik(array $zapis): void
    {
        if (!is_dir($this->dir)) @mkdir($this->dir, 0700, true);
        $f = $this->dir . '/dnevnik.log';
        // ne raste bez granice (npr. tisuće neuspjelih prijava): iznad 1 MB postaje dnevnik.1.log, a prethodni se briše
        if (@filesize($f) > 1024 * 1024) @rename($f, $this->dir . '/dnevnik.1.log');
        file_put_contents($f, u_json(['vrijeme' => iso_vrijeme(), ...$zapis]) . "\n", FILE_APPEND | LOCK_EX);
    }

    private function snimiVerziju(array $s, string $opis): void
    {
        pisi_json(sprintf('%s/%06d.json', $this->povijestDir, $s['verzija']), ['opis' => $opis, 'sadrzaj' => $s]);
        $sve = glob($this->povijestDir . '/[0-9][0-9][0-9][0-9][0-9][0-9].json') ?: [];
        sort($sve);
        foreach (array_slice($sve, 0, max(0, count($sve) - ZADRZI_VERZIJA)) as $f) @unlink($f);
    }

    /** stariji format nadograđen (na disk ide pri sljedećem spremanju) */
    private function migriraj(mixed $s): mixed { return migriraj_sadrzaj($s, $this->konf->zadaneFotografije); }

    /** trenutni jelovnik; prvi put se stvara iz početnog sadržaja stranice */
    public function ucitaj(): array
    {
        $s = citaj_json($this->datoteka);
        if (is_array($s)) return $this->migriraj($s);
        return s_bravom($this->dir, function () {
            $s = citaj_json($this->datoteka);
            if (is_array($s)) return $this->migriraj($s);
            $pocetni = array_merge($this->konf->pocetni(), ['verzija' => 1, 'azurirano' => iso_vrijeme(), 'azurirao' => 'početni sadržaj']);
            pisi_json($this->datoteka, $pocetni);
            $this->snimiVerziju($pocetni, 'Početni sadržaj');
            return $pocetni;
        });
    }

    private function spremi(array $novi, string $ime, string $opis): array
    {
        $r = provjeri_sadrzaj($novi, $this->konf->lokali, $this->konf->boje, $this->slikaPostoji);
        if (!$r['ok']) throw new Greska(422, 'Sadržaj nije ispravan', ['greske' => $r['greske']]);
        pisi_json($this->datoteka, $r['sadrzaj']);
        $this->snimiVerziju($r['sadrzaj'], $opis);
        $this->dnevnik(['ime' => $ime, 'radnja' => 'spremanje', 'verzija' => $r['sadrzaj']['verzija'], 'opis' => $opis]);
        return $r['sadrzaj'];
    }

    /** spremi jednu kategoriju; bazna verzija mora biti trenutna (inače je netko drugi u međuvremenu spremio) */
    public function spremiKategoriju(string $kljuc, mixed $kategorija, int $baznaVerzija, string $ime): array
    {
        $this->ucitaj();
        return s_bravom($this->dir, function () use ($kljuc, $kategorija, $baznaVerzija, $ime) {
            $trenutni = $this->migriraj(citaj_json($this->datoteka));
            if (!array_key_exists($kljuc, $trenutni['kategorije'])) throw new Greska(404, 'Nepoznata kategorija');
            if ($trenutni['verzija'] !== $baznaVerzija) throw new Greska(409, 'Jelovnik je u međuvremenu promijenjen', ['verzija' => $trenutni['verzija']]);
            $p = new Provjera();
            $k = $p->kategorija($kategorija, ['kategorije', $kljuc]);
            if ($p->greske) throw new Greska(422, 'Sadržaj nije ispravan', ['greske' => $p->greske]);
            $c = $this->konf->kategorija($kljuc);
            $naziv = ($c['kat']['naziv'] ?? '') ?: ($k['naslov']['hr'] ?: $kljuc);
            $novi = array_merge($trenutni, ['verzija' => $trenutni['verzija'] + 1, 'azurirano' => iso_vrijeme(), 'azurirao' => $ime]);
            $novi['kategorije'][$kljuc] = $k;
            return $this->spremi($novi, $ime, ($c['lokal']['naziv'] ?? '') . ": $naziv");
        });
    }

    public function povijest(): array
    {
        $sve = glob($this->povijestDir . '/[0-9][0-9][0-9][0-9][0-9][0-9].json') ?: [];
        rsort($sve);
        return array_map(function ($f) {
            $v = citaj_json($f);
            return ['verzija' => $v['sadrzaj']['verzija'], 'azurirano' => $v['sadrzaj']['azurirano'], 'azurirao' => $v['sadrzaj']['azurirao'], 'opis' => $v['opis']];
        }, $sve);
    }

    /** vrati staru verziju (kao novu verziju — povijest se ne briše) */
    public function vrati(mixed $verzija, mixed $bazna, string $ime): array
    {
        if (!is_int($verzija) || $verzija < 1) throw new Greska(404, 'Verzija ne postoji');
        return s_bravom($this->dir, function () use ($verzija, $bazna, $ime) {
            $trenutni = citaj_json($this->datoteka);
            if ($trenutni['verzija'] !== $bazna) throw new Greska(409, 'Jelovnik je u međuvremenu promijenjen', ['verzija' => $trenutni['verzija']]);
            $stara = citaj_json(sprintf('%s/%06d.json', $this->povijestDir, $verzija));
            if (!$stara) throw new Greska(404, 'Verzija ne postoji');
            $novi = array_merge($this->migriraj($stara['sadrzaj']), ['verzija' => $trenutni['verzija'] + 1, 'azurirano' => iso_vrijeme(), 'azurirao' => $ime]);
            return $this->spremi($novi, $ime, "Vraćena verzija $verzija");
        });
    }
}
