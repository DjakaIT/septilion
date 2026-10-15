<?php
// Postavljanje izgrađene stranice na hosting bez FTP-a (infonet pušta FTP samo s ručno dopuštenih IP adresa):
// GitHub Actions spremi paket kao artefakt "hosting" (.github/workflows/objava.yml), a ovdje se preuzme istim tokenom
// i kopira u public_html — redom: nove datoteke (slike, CSS/JS s hashom, fontovi), uredništvo, pa HTML/XML/TXT i na kraju
// .htaccess, da stranica nikad ne pokazuje na datoteku koje još nema. Ništa se ne briše (kao i prije), iste datoteke se ne
// prepisuju (ETag ostaje), a podaci uredništva su izvan public_html. Prihvaćaju se samo izgradnje s grane main ovog
// repozitorija (ne pull requestovi) i samo uobičajena imena datoteka (bez "..", apsolutnih putanja i sl.).
declare(strict_types=1);

const ARTEFAKT = 'hosting';
const NAJVECI_PAKET = 200 * 1024 * 1024;
const NAJVECE_RASPAKIRANO = 400 * 1024 * 1024;
const NAJVISE_DATOTEKA = 5000;

final class Instalacija
{
    private string $datoteka;

    public function __construct(private string $podaci, private string $javno)
    {
        $this->datoteka = $podaci . '/instalirano.json';
    }

    /** @return array{run:int, broj:int, sha:string, vrijeme:string}|null zadnja postavljena izgradnja */
    public function zadnja(): ?array
    {
        $z = citaj_json($this->datoteka);
        return is_array($z) ? $z : null;
    }

    /** je li ova izgradnja (ili novija) već postavljena */
    public function postavljen(array $run): bool
    {
        return ($this->zadnja()['broj'] ?? 0) >= (int) ($run['run_number'] ?? PHP_INT_MAX);
    }

    /** paket izgradnje ili null (npr. objava je na GitHubu isključena, pa posao nije ni pokrenut) */
    public function artefakt(GitHub $gh, array $run): ?array
    {
        foreach ($gh->mora('GET', '/actions/runs/' . (int) $run['id'] . '/artifacts?name=' . ARTEFAKT)['artifacts'] ?? [] as $a) {
            if (($a['name'] ?? '') === ARTEFAKT && empty($a['expired'])) return $a;
        }
        return null;
    }

    /** preuzmi paket izgradnje i postavi ga; false ako je ista ili novija već postavljena ili postavljanje upravo traje */
    public function postavi(GitHub $gh, array $run, array $artefakt): bool
    {
        $brava = @fopen($this->podaci . '/instalacija.lock', 'c');
        if (!$brava) throw new RuntimeException('Ne mogu zaključati postavljanje');
        if (!flock($brava, LOCK_EX | LOCK_NB)) { fclose($brava); return false; } // drugi zahtjev upravo postavlja
        $zip = $this->podaci . '/instalacija.zip';
        $mapa = $this->podaci . '/instalacija';
        try {
            if ($this->postavljen($run)) return false;
            @set_time_limit(300);
            $gh->preuzmi((string) ($artefakt['archive_download_url'] ?? ''), $zip, NAJVECI_PAKET);
            obrisi_mapu($mapa);
            $this->raspakiraj($zip, $mapa);
            if (!is_file("$mapa/index.html")) throw new Greska(502, 'Paket stranice nema index.html.');
            $this->kopiraj($mapa);
            pisi_json($this->datoteka, ['run' => (int) $run['id'], 'broj' => (int) $run['run_number'], 'sha' => (string) ($run['head_sha'] ?? ''), 'vrijeme' => iso_vrijeme()]);
            return true;
        } finally {
            @unlink($zip);
            obrisi_mapu($mapa);
            flock($brava, LOCK_UN);
            fclose($brava);
        }
    }

    /** samo uobičajena relativna imena: slova, brojke, . _ - @ + i "/" između dijelova (bez "." i ".." dijelova) */
    public static function ispravnoIme(string $ime): bool
    {
        if (!preg_match('#^[A-Za-z0-9._@+-]+(/[A-Za-z0-9._@+-]+)*$#', $ime)) return false;
        foreach (explode('/', $ime) as $dio) if ($dio === '.' || $dio === '..') return false;
        return true;
    }

    private function raspakiraj(string $zip, string $mapa): void
    {
        if (!class_exists('ZipArchive')) throw new Greska(500, 'PHP nema proširenje zip (cPanel → Select PHP Version → Extensions → zip).');
        $z = new ZipArchive();
        if ($z->open($zip) !== true) throw new Greska(502, 'Paket stranice nije ispravan ZIP.');
        try {
            if ($z->numFiles > NAJVISE_DATOTEKA) throw new Greska(502, 'Paket stranice ima previše datoteka.');
            $ukupno = 0;
            for ($i = 0; $i < $z->numFiles; $i++) {
                $st = $z->statIndex($i);
                $ime = (string) ($st['name'] ?? '');
                if (str_ends_with($ime, '/')) continue; // mapa
                if (!self::ispravnoIme($ime)) throw new Greska(502, 'Paket stranice ima neispravno ime datoteke: ' . mb_substr($ime, 0, 100));
                $ukupno += (int) $st['size'];
                if ($ukupno > NAJVECE_RASPAKIRANO) throw new Greska(502, 'Paket stranice je prevelik.');
                $sadrzaj = $z->getFromIndex($i);
                if ($sadrzaj === false || strlen($sadrzaj) !== (int) $st['size']) throw new Greska(502, "Paket stranice je oštećen ($ime).");
                $cilj = "$mapa/$ime";
                if (!is_dir(dirname($cilj)) && !@mkdir(dirname($cilj), 0700, true) && !is_dir(dirname($cilj))) throw new RuntimeException("Ne mogu stvoriti mapu za $ime");
                if (file_put_contents($cilj, $sadrzaj) !== strlen($sadrzaj)) throw new RuntimeException("Ne mogu raspakirati $ime");
            }
        } finally {
            $z->close();
        }
    }

    private function kopiraj(string $mapa): void
    {
        $sve = [];
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mapa, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) if ($f->isFile()) $sve[] = substr(str_replace('\\', '/', $f->getPathname()), strlen($mapa) + 1);
        sort($sve);
        $uredn = static fn (string $r): bool => str_starts_with($r, 'urednistvo/');
        $zadnje = static fn (string $r): bool => !str_starts_with($r, 'urednistvo/') && (bool) preg_match('#(^|/)\.htaccess$|\.(html|xml|txt)$#', $r);
        $stranice = array_values(array_filter($sve, $zadnje));
        usort($stranice, static fn ($a, $b) => [str_ends_with($a, '.htaccess'), $a] <=> [str_ends_with($b, '.htaccess'), $b]); // .htaccess na kraju
        foreach ([array_filter($sve, static fn ($r) => !$uredn($r) && !$zadnje($r)), array_filter($sve, $uredn), $stranice] as $skupina) {
            foreach ($skupina as $r) $this->kopirajDatoteku("$mapa/$r", $this->javno . "/$r");
        }
    }

    private function kopirajDatoteku(string $izvor, string $cilj): void
    {
        if (is_file($cilj) && filesize($cilj) === filesize($izvor) && hash_file('sha256', $cilj) === hash_file('sha256', $izvor)) return;
        $dir = dirname($cilj);
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) throw new RuntimeException("Ne mogu stvoriti mapu $dir");
        $tmp = $cilj . '.' . bin2hex(random_bytes(6)) . '.novo';
        if (!@copy($izvor, $tmp)) throw new RuntimeException("Ne mogu pisati $cilj");
        @chmod($tmp, 0644);
        if (!@rename($tmp, $cilj)) { @unlink($tmp); throw new RuntimeException("Ne mogu zamijeniti $cilj"); }
    }
}

/** briše mapu sa svim sadržajem (samo privremene mape uredništva u septillion-podaci) */
function obrisi_mapu(string $mapa): void
{
    if (!is_dir($mapa)) return;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mapa, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) $f->isDir() && !$f->isLink() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
    @rmdir($mapa);
}
