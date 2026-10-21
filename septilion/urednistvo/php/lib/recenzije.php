<?php
// Google recenzije (Places API, New): jednom dnevno (cPanel Cron Job -> /api/osvjezi) ili na zahtjev administratora
// povuče ocjenu, broj ocjena i recenzije za oba lokala i zapiše public_html/recenzije.json — samo recenzije s 5 zvjezdica
// i pravim tekstom (najviše 5, toliko ih Google ionako daje). Stranica ih samo prikaže (src/scripts/core/recenzije.ts):
// posjetitelji ne učitavaju ništa s Googlea. API ključ je samo ovdje (septillion-podaci), nikad u pregledniku.
declare(strict_types=1);

const RECENZIJE_LOKALI = [
    'pasta' => 'Pasta Rhymes, Ulica Pavla Hatza 5, Zagreb',
    'jelly' => 'Jellyfish in Space, Martićeva ulica 71, Zagreb',
];
const RECENZIJE_SVAKIH_MS = 24 * 3600 * 1000;
const RECENZIJA_NAJMANJE_ZNAKOVA = 40;

final class Recenzije
{
    private string $postavkeDat;
    private string $stanjeDat;

    public function __construct(private string $podaci, private string $javno, private string $api)
    {
        $this->postavkeDat = $podaci . '/recenzije-postavke.json';
        $this->stanjeDat = $podaci . '/recenzije-stanje.json';
    }

    private function postavke(): array { return citaj_json($this->postavkeDat, []); }

    /** za administratora (ključ se nikad ne vraća) */
    public function stanje(): array
    {
        $p = $this->postavke();
        $s = citaj_json($this->stanjeDat, []);
        $javno = citaj_json($this->javno . '/recenzije.json', []);
        $lokali = [];
        foreach (array_keys(RECENZIJE_LOKALI) as $l) {
            $m = $p['mjesta'][$l] ?? null;
            $lokali[$l] = $m ? ['naziv' => $m['naziv'] ?? '', 'adresa' => $m['adresa'] ?? '', 'ocjena' => $javno[$l]['ocjena'] ?? null,
                'broj' => $javno[$l]['broj'] ?? null, 'prikazano' => count($javno[$l]['recenzije'] ?? [])] : null;
        }
        return ['kljucPostavljen' => !empty($p['kljuc']), 'lokali' => $lokali, 'azurirano' => $s['azurirano'] ?? null, 'greska' => $s['greska'] ?? null];
    }

    /** spremi ključ, pronađi oba lokala na Googleu i odmah povuci recenzije */
    public function spremiKljuc(mixed $kljuc): array
    {
        $kljuc = is_string($kljuc) ? trim($kljuc) : '';
        if ($kljuc === '') $kljuc = (string) ($this->postavke()['kljuc'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_-]{30,60}$/', $kljuc)) throw new Greska(422, 'Upiši Google API ključ (počinje s AIza…).');
        $mjesta = [];
        foreach (RECENZIJE_LOKALI as $l => $upit) {
            $r = $this->zahtjev('POST', '/places:searchText', $kljuc, 'places.id,places.displayName,places.formattedAddress', ['textQuery' => $upit, 'languageCode' => 'hr']);
            $m = $r['places'][0] ?? null;
            if (!$m || empty($m['id'])) throw new Greska(502, "Google ne nalazi lokal: $upit");
            $mjesta[$l] = ['id' => (string) $m['id'], 'naziv' => (string) ($m['displayName']['text'] ?? ''), 'adresa' => (string) ($m['formattedAddress'] ?? '')];
        }
        pisi_json($this->postavkeDat, ['kljuc' => $kljuc, 'mjesta' => $mjesta]);
        $this->osvjezi(true);
        return $this->stanje();
    }

    /** povuci recenzije ako je prošlo 24 h (ili odmah); greška se samo zapiše, stranica zadržava zadnje recenzije */
    public function osvjezi(bool $odmah = false): void
    {
        $p = $this->postavke();
        if (empty($p['kljuc']) || empty($p['mjesta'])) return;
        $s = citaj_json($this->stanjeDat, []);
        if (!$odmah && sad_ms() - ($s['zadnjiPokusaj'] ?? 0) < RECENZIJE_SVAKIH_MS) return;
        pisi_json($this->stanjeDat, [...$s, 'zadnjiPokusaj' => sad_ms()]);
        try {
            $izlaz = ['azurirano' => iso_vrijeme()];
            foreach ($p['mjesta'] as $l => $m) {
                $polja = 'rating,userRatingCount,reviews,googleMapsUri';
                $hr = $this->zahtjev('GET', '/places/' . rawurlencode($m['id']) . '?languageCode=hr&regionCode=HR', $p['kljuc'], $polja);
                $en = $this->zahtjev('GET', '/places/' . rawurlencode($m['id']) . '?languageCode=en&regionCode=HR', $p['kljuc'], 'reviews');
                $enPo = [];
                foreach ($en['reviews'] ?? [] as $r) $enPo[$r['name'] ?? ''] = $r;
                $recenzije = [];
                foreach ($hr['reviews'] ?? [] as $r) {
                    $tekst = trim((string) ($r['text']['text'] ?? ''));
                    if ((int) ($r['rating'] ?? 0) !== 5 || mb_strlen($tekst) < RECENZIJA_NAJMANJE_ZNAKOVA) continue; // samo najbolje
                    $e = $enPo[$r['name'] ?? ''] ?? [];
                    $recenzije[] = [
                        'autor' => (string) ($r['authorAttribution']['displayName'] ?? 'Google'),
                        'autorUrl' => str_starts_with((string) ($r['authorAttribution']['uri'] ?? ''), 'https://') ? $r['authorAttribution']['uri'] : null,
                        'tekst' => ['hr' => $tekst, 'en' => trim((string) ($e['text']['text'] ?? '')) ?: $tekst],
                        'kad' => ['hr' => (string) ($r['relativePublishTimeDescription'] ?? ''), 'en' => (string) ($e['relativePublishTimeDescription'] ?? '')],
                    ];
                }
                $izlaz[$l] = ['ocjena' => isset($hr['rating']) ? round((float) $hr['rating'], 1) : null, 'broj' => (int) ($hr['userRatingCount'] ?? 0),
                    'url' => str_starts_with((string) ($hr['googleMapsUri'] ?? ''), 'https://') ? $hr['googleMapsUri'] : null, 'recenzije' => array_slice($recenzije, 0, 5)];
            }
            pisi_atomarno($this->javno . '/recenzije.json', u_json($izlaz), 0644);
            pisi_json($this->stanjeDat, ['zadnjiPokusaj' => sad_ms(), 'azurirano' => $izlaz['azurirano'], 'greska' => null]);
        } catch (Throwable $e) {
            error_log('[uredništvo] recenzije: ' . $e->getMessage());
            pisi_json($this->stanjeDat, [...citaj_json($this->stanjeDat, []), 'greska' => $e instanceof Greska ? $e->getMessage() : 'greška na poslužitelju']);
            if ($odmah) throw $e;
        }
    }

    private function zahtjev(string $metoda, string $put, string $kljuc, string $polja, ?array $tijelo = null): array
    {
        $zag = ['X-Goog-Api-Key: ' . $kljuc, 'X-Goog-FieldMask: ' . $polja, 'Content-Type: application/json', 'User-Agent: septillion-urednistvo'];
        if (!function_exists('curl_init')) throw new Greska(500, 'PHP nema proširenje curl (cPanel → Select PHP Version → Extensions).');
        $c = curl_init(rtrim($this->api, '/') . $put);
        curl_setopt_array($c, [CURLOPT_CUSTOMREQUEST => $metoda, CURLOPT_HTTPHEADER => $zag, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 30]);
        if ($tijelo !== null) curl_setopt($c, CURLOPT_POSTFIELDS, u_json($tijelo));
        $tekst = curl_exec($c);
        $status = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
        if ($tekst === false) throw new Greska(502, 'Google nije dostupan: ' . curl_error($c));
        $j = json_decode((string) $tekst, true);
        if ($status < 200 || $status >= 300) {
            $poruka = is_array($j) ? (string) ($j['error']['message'] ?? '') : '';
            throw new Greska(502, match (true) {
                $status === 400 && str_contains($poruka, 'API key') => 'Google API ključ ne vrijedi.',
                $status === 403 => 'Ključ nema uključen Places API (New) ili billing: ' . mb_substr($poruka, 0, 160),
                default => "Google je odgovorio $status" . ($poruka !== '' ? ': ' . mb_substr($poruka, 0, 160) : ''),
            });
        }
        return is_array($j) ? $j : [];
    }
}
