<?php
// Održavanje stranice: dok postoji public_html/.odrzavanje, .htaccess stranice posjetiteljima vraća odrzavanje.html (503 —
// tražilice dođu poslije); uredništvo radi normalno i spremanja se i dalje objavljuju (objava tu datoteku ne dira).
// Uključuje ga administrator (izbornik -> Održavanje stranice) ili ručno: prazna datoteka .odrzavanje u public_html.
// Isti ugovor kao urednistvo/lib/odrzavanje.mjs.
declare(strict_types=1);

const KOLACIC_PREGLEDA = 'septillion_pregled';

final class Odrzavanje
{
    private string $datoteka;

    public function __construct(string $javno)
    {
        $this->datoteka = rtrim($javno, '/\\') . '/.odrzavanje';
    }

    public function ukljuceno(): bool
    {
        clearstatcache(true, $this->datoteka);
        return is_file($this->datoteka);
    }

    /** @return array{ukljuceno:bool, od:?string, ime:?string} */
    public function stanje(): array
    {
        if (!$this->ukljuceno()) return ['ukljuceno' => false, 'od' => null, 'ime' => null];
        // ručno napravljena (prazna) datoteka također vrijedi
        try { $s = citaj_json($this->datoteka, []); } catch (Throwable) { $s = []; }
        if (!is_array($s)) $s = [];
        return ['ukljuceno' => true, 'od' => is_string($s['od'] ?? null) ? $s['od'] : null, 'ime' => is_string($s['ime'] ?? null) ? $s['ime'] : null];
    }

    public function postavi(bool $ukljuceno, string $ime): array
    {
        if (!$ukljuceno) {
            if ($this->ukljuceno() && !@unlink($this->datoteka)) throw new RuntimeException('Ne mogu isključiti održavanje (' . $this->datoteka . ')');
        } elseif (!$this->ukljuceno()) {
            pisi_json($this->datoteka, ['od' => iso_vrijeme(), 'ime' => $ime]);
        }
        return $this->stanje();
    }

    /** preglednik administratora koji je uključio održavanje i dalje vidi stranicu (isti uvjet je u .htaccess) */
    public static function imaPregled(): bool
    {
        return ($_COOKIE[KOLACIC_PREGLEDA] ?? '') === '1';
    }

    public static function kolacic(bool $ukljucen, bool $sigurno): void
    {
        header('Set-Cookie: ' . KOLACIC_PREGLEDA . '=' . ($ukljucen ? '1' : '') . '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' . ($ukljucen ? 30 * 86400 : 0) . ($sigurno ? '; Secure' : ''), false);
    }
}
