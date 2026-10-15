<?php
// Sesije na disku (podaci/sesije/<sha256(id)>.json): kolačić nosi samo nasumični id (256 bita), datoteka je pod
// njegovim SHA-256, pa ni kopija mape ne daje upotrebljiv kolačić. Ne ovise o PHP-ovim sesijama hostinga (njihovo
// čišćenje bi odjavljivalo usred rada). Istek: 30 min bez aktivnosti korisnika (pozadinske provjere se ne broje),
// najdulje 12 h; korak prijave 5 min. Promjena lozinke / reset / brisanje korisnika: sesijaVerzija (api.php).
declare(strict_types=1);

const NEAKTIVNOST_MS = 30 * 60 * 1000;
const NAJDULJE_MS = 12 * 3600 * 1000;
const KORAK_2FA_MS = 5 * 60 * 1000;
const ZAPISI_DODIR_MS = 60 * 1000;

function razlog_isteka(array $s, int $t): ?string
{
    if ($t - $s['kreirano'] > NAJDULJE_MS) return 'trajanje';
    if (($s['korak'] ?? '') === 'puno') return $t - $s['aktivno'] > NEAKTIVNOST_MS ? 'neaktivnost' : null;
    return $t - $s['aktivno'] > KORAK_2FA_MS ? 'korak' : null;
}

final class Sesije
{
    public readonly string $ime;
    /** razlog isteka zadnje pročitane sesije (kolačić je bio, sesija ne vrijedi) */
    public ?string $razlogIsteka = null;

    public function __construct(private string $dir, private bool $sigurno)
    {
        $this->ime = $sigurno ? '__Host-sx-urednistvo' : 'sx-urednistvo';
        if (!is_dir($dir)) @mkdir($dir, 0700, true);
        if (random_int(1, 50) === 1) $this->ocisti();
    }

    private function datoteka(string $id): string { return $this->dir . '/' . sha256($id) . '.json'; }

    private function ocisti(): void
    {
        $t = sad_ms();
        foreach (glob($this->dir . '/*.json') ?: [] as $f) {
            try { $s = citaj_json($f); } catch (Throwable) { $s = null; }
            if (!is_array($s) || razlog_isteka($s, $t)) @unlink($f);
        }
    }

    private function kolacic(string $vrijednost, int $maxAge): void
    {
        header("Set-Cookie: {$this->ime}=$vrijednost; Path=/; HttpOnly; SameSite=Strict; Max-Age=$maxAge" . ($this->sigurno ? '; Secure' : ''), false);
    }

    /** ['id' => ..., 's' => [...]] ili null; pozadina = automatska provjera (ne produljuje sesiju) */
    public function procitaj(bool $pozadina = false): ?array
    {
        $this->razlogIsteka = null;
        $id = $_COOKIE[$this->ime] ?? null;
        if (!is_string($id) || !preg_match('/^[A-Za-z0-9_-]{43}$/', $id)) return null;
        try { $s = citaj_json($this->datoteka($id)); } catch (Throwable) { $s = null; }
        if (!is_array($s)) { $this->razlogIsteka = 'nema'; return null; }
        $t = sad_ms();
        if ($r = razlog_isteka($s, $t)) { @unlink($this->datoteka($id)); $this->razlogIsteka = $r; return null; }
        $ses = ['id' => $id, 's' => $s];
        if (!$pozadina) {
            $ses['s']['aktivno'] = $t;
            if ($t - ($s['zapisano'] ?? 0) > ZAPISI_DODIR_MS) $this->spremi($ses);
        }
        return $ses;
    }

    public function spremi(array &$ses): void
    {
        $ses['s']['zapisano'] = sad_ms();
        pisi_json($this->datoteka($ses['id']), $ses['s']);
    }

    /** nova sesija (uvijek novi id — zaštita od fiksacije sesije); vraća podatke sesije */
    public function stvori(array $podaci, ?string $staraId = null): array
    {
        if ($staraId) @unlink($this->datoteka($staraId));
        $t = sad_ms();
        $ses = ['id' => nasumicno(32), 's' => array_merge($podaci, ['csrf' => nasumicno(32), 'kreirano' => $t, 'aktivno' => $t])];
        $this->spremi($ses);
        $this->kolacic($ses['id'], intdiv(NAJDULJE_MS, 1000));
        return $ses['s'];
    }

    public function obrisi(?string $id, bool $kolacic = true): void
    {
        if ($id) @unlink($this->datoteka($id));
        if ($kolacic) $this->kolacic('', 0);
    }

    /** odjava korisnika svugdje, osim po želji jedne sesije */
    public function odjaviKorisnika(string $ime, ?string $osim = null): void
    {
        $zadrzi = $osim ? $this->datoteka($osim) : null;
        foreach (glob($this->dir . '/*.json') ?: [] as $f) {
            if ($zadrzi && realpath($f) === realpath($zadrzi)) continue;
            try { if ((citaj_json($f)['ime'] ?? null) === $ime) @unlink($f); } catch (Throwable) { /* preskoči */ }
        }
    }
}
