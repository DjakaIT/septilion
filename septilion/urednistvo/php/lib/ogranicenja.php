<?php
// Ograničenje pokušaja (pogađanje lozinki i kodova), klizni prozor od 15 min. PHP nema trajni proces,
// pa se brojači čuvaju u podaci/ogranicenja.json (pod bravom).
declare(strict_types=1);

const NAJVISE_ZAPISA = 2000;

final class Ogranicenja
{
    private string $datoteka;

    /** @param array<string, array{prozorMs:int, najvise:int}> $vrste npr. ['ip' => [...], 'korisnik' => [...]] */
    public function __construct(private string $dir, private array $vrste) { $this->datoteka = $dir . '/ogranicenja.json'; }

    private function svjezi(array $sve, string $vrsta, string $kljuc, int $t): array
    {
        $prozor = $this->vrste[$vrsta]['prozorMs'];
        return array_values(array_filter($sve["$vrsta:$kljuc"] ?? [], fn ($x) => $t - $x < $prozor));
    }

    /** sekundi čekanja (0 = smije) */
    public function cekaj(string $vrsta, string $kljuc): int
    {
        $t = sad_ms();
        $v = $this->svjezi(citaj_json($this->datoteka, []), $vrsta, $kljuc, $t);
        ['prozorMs' => $prozor, 'najvise' => $najvise] = $this->vrste[$vrsta];
        return count($v) < $najvise ? 0 : (int) ceil(($prozor - ($t - $v[0])) / 1000);
    }

    public function zabiljezi(string $vrsta, string $kljuc): void
    {
        s_bravom($this->dir, function () use ($vrsta, $kljuc) {
            $t = sad_ms();
            $sve = citaj_json($this->datoteka, []);
            // stari zapisi se usput brišu
            foreach ($sve as $k => $v) {
                $prozor = $this->vrste[explode(':', $k, 2)[0]]['prozorMs'] ?? 0;
                $sve[$k] = array_values(array_filter($v, fn ($x) => $t - $x < $prozor));
                if (!$sve[$k]) unset($sve[$k]);
            }
            $sve["$vrsta:$kljuc"] = [...$this->svjezi($sve, $vrsta, $kljuc, $t), $t];
            // napad s puno adresa ili izmišljenih imena: datoteka ostaje mala (čuvaju se najnoviji zapisi)
            if (count($sve) > NAJVISE_ZAPISA) {
                uasort($sve, fn ($a, $b) => max($b) <=> max($a));
                $sve = array_slice($sve, 0, NAJVISE_ZAPISA, true);
            }
            pisi_json($this->datoteka, $sve);
        });
    }

    public function ponisti(string $vrsta, string $kljuc): void
    {
        s_bravom($this->dir, function () use ($vrsta, $kljuc) {
            $sve = citaj_json($this->datoteka, []);
            if (!isset($sve["$vrsta:$kljuc"])) return;
            unset($sve["$vrsta:$kljuc"]);
            pisi_json($this->datoteka, $sve);
        });
    }
}
