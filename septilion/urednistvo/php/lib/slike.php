<?php
// Fotografije iz uredništva (GD): svaka se dekodira i iznova kodira u WebP — uklanja EXIF/GPS i sve skriveno u
// datoteci, ograničava veličinu i dimenzije (zaštita od "dekompresijskih bombi"), sprema pod nasumičnim imenom.
// Preglednik velike fotografije već smanji na 2400 px; stranica ih pri izgradnji optimizira kao i ostale.
declare(strict_types=1);

const NAJVECA_DATOTEKA = 15 * 1024 * 1024;
const NAJVISE_PIKSELA = 25_000_000; // GD drži cijelu sliku u memoriji (4 B/px), hosting ima ograničenu memoriju
const NAJVECA_STRANICA = 2400;

final class Slike
{
    private string $dir;
    private string $minijature;

    public function __construct(string $podaci, private Konfiguracija $konf)
    {
        $this->dir = $podaci . '/slike';
        $this->minijature = $podaci . '/minijature';
    }

    /** putanja izvorne datoteke za učitanu fotografiju (n-...) ili null; ključ se provjerava regexom — nema "../" */
    private function putanja(mixed $kljuc): ?string
    {
        if (!is_string($kljuc) || !preg_match('/^n-[a-f0-9]{24}$/', $kljuc)) return null;
        $p = "{$this->dir}/$kljuc.webp";
        return is_file($p) ? $p : null;
    }

    public function postoji(mixed $kljuc): bool
    {
        if (!is_string($kljuc) || !preg_match(KLJUC_SLIKE, $kljuc)) return false;
        return str_starts_with($kljuc, 'n-') ? $this->putanja($kljuc) !== null : isset($this->konf->lokalneSlike[$kljuc]);
    }

    public function datoteka(string $kljuc): ?string { return $this->putanja($kljuc); }

    /** @return array{kljuc:string, sirina:int, visina:int} */
    public function obradi(string $buf): array
    {
        if ($buf === '') throw new Greska(400, 'Prazna datoteka');
        if (strlen($buf) > NAJVECA_DATOTEKA) throw new Greska(413, 'Fotografija je veća od 15 MB');
        $info = @getimagesizefromstring($buf);
        $vrste = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP];
        if (defined('IMAGETYPE_AVIF')) $vrste[] = IMAGETYPE_AVIF;
        if (!$info) throw new Greska(415, 'Datoteka nije fotografija (JPG, PNG, WebP ili AVIF)');
        [$w, $h, $vrsta] = $info;
        if (!in_array($vrsta, $vrste, true)) throw new Greska(415, 'Podržani formati: JPG, PNG, WebP, AVIF');
        if ($w < 300 || $h < 300) throw new Greska(422, 'Fotografija je premala (najmanje 300 × 300 px)');
        if ($w * $h > NAJVISE_PIKSELA) throw new Greska(422, 'Fotografija ima previše piksela. Pošalji je iz uredništva u pregledniku (ono je samo smanji).');
        @ini_set('memory_limit', '256M');
        $img = @imagecreatefromstring($buf);
        if (!$img) throw new Greska(415, 'Fotografiju nije moguće otvoriti (JPG, PNG, WebP)');
        try {
            if ($vrsta === IMAGETYPE_JPEG) $img = self::uspravno($img, $buf);
            $w = imagesx($img); $h = imagesy($img);
            $omjer = min(1, NAJVECA_STRANICA / max($w, $h));
            $nw = max(1, (int) round($w * $omjer)); $nh = max(1, (int) round($h * $omjer));
            if ($omjer < 1) {
                $mala = imagecreatetruecolor($nw, $nh);
                imagealphablending($mala, false); imagesavealpha($mala, true);
                imagecopyresampled($mala, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
                $img = $mala;
            } elseif (!imageistruecolor($img)) {
                imagepalettetotruecolor($img);
            }
            imagesavealpha($img, true);
            ob_start();
            $ok = imagewebp($img, null, 88);
            $webp = (string) ob_get_clean();
            if (!$ok || $webp === '') throw new Greska(500, 'Fotografiju nije moguće spremiti');
        } finally {
            unset($img); // GD slika se oslobađa sama
        }
        $kljuc = 'n-' . bin2hex(random_bytes(12));
        pisi_atomarno("{$this->dir}/$kljuc.webp", $webp, 0644);
        return ['kljuc' => $kljuc, 'sirina' => $nw, 'visina' => $nh];
    }

    /** okretanje prema EXIF oznaci (mobiteli spremaju fotografiju "naopako" + oznaku); EXIF se poslije odbacuje */
    private static function uspravno(GdImage $img, string $buf): GdImage
    {
        if (!function_exists('exif_read_data')) return $img;
        $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($buf));
        $o = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;
        if (in_array($o, [2, 4, 5, 7], true)) imageflip($img, IMG_FLIP_HORIZONTAL);
        $kut = match ($o) { 3, 4 => 180, 5, 6 => 270, 7, 8 => 90, default => 0 };
        if ($kut) { $r = imagerotate($img, $kut, 0); if ($r) $img = $r; }
        return $img;
    }

    /** mala verzija za uredništvo (WebP 480 px); lokalne slike stranice dolaze gotove iz izgradnje */
    public function minijatura(string $kljuc): ?string
    {
        if (!preg_match(KLJUC_SLIKE, $kljuc)) return null;
        if (!str_starts_with($kljuc, 'n-')) {
            $p = "{$this->konf->dir}/minijature/$kljuc.webp";
            return is_file($p) ? (string) file_get_contents($p) : null;
        }
        $cache = "{$this->minijature}/$kljuc.webp";
        if (is_file($cache)) return (string) file_get_contents($cache);
        $izvor = $this->putanja($kljuc);
        if (!$izvor) return null;
        $img = @imagecreatefromwebp($izvor);
        if (!$img) return null;
        $w = imagesx($img); $h = imagesy($img);
        $omjer = min(1, 480 / max($w, $h));
        $mala = imagescale($img, max(1, (int) round($w * $omjer)), max(1, (int) round($h * $omjer)), IMG_BICUBIC) ?: $img;
        ob_start(); imagewebp($mala, null, 72); $b = (string) ob_get_clean();
        pisi_atomarno($cache, $b, 0644);
        return $b;
    }
}
