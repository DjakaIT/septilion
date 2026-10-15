<?php
// Objava s hostinga (bez Node.js-a): nakon spremanja jelovnik i nove fotografije idu u jedan commit na GitHub
// (grana "sadrzaj" — ujedno sigurnosna kopija s poviješću), zatim se pokreće objava (repository_dispatch).
// GitHub Actions (.github/workflows/objava.yml, kod s grane main) izgradi stranicu i prenese je na hosting.
// Token je fine-grained, samo za taj repozitorij (Contents: read/write, Actions: read); sprema se samo ovdje.
declare(strict_types=1);

final class GitHub
{
    public ?string $istjece = null;

    public function __construct(private string $api, private string $repo, private string $token) {}

    /** @return array{0:int, 1:mixed} status i JSON odgovor */
    public function zahtjev(string $metoda, string $put, ?array $tijelo = null): array
    {
        $url = rtrim($this->api, '/') . "/repos/{$this->repo}$put";
        $zag = ['Authorization: Bearer ' . $this->token, 'Accept: application/vnd.github+json', 'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: septillion-urednistvo'];
        if ($tijelo !== null) $zag[] = 'Content-Type: application/json';
        $odgZag = [];
        if (function_exists('curl_init')) {
            $c = curl_init($url);
            curl_setopt_array($c, [
                CURLOPT_CUSTOMREQUEST => $metoda, CURLOPT_HTTPHEADER => $zag, CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 30,
                CURLOPT_HEADERFUNCTION => function ($c, $l) use (&$odgZag) {
                    $p = strpos($l, ':');
                    if ($p) $odgZag[strtolower(trim(substr($l, 0, $p)))] = trim(substr($l, $p + 1));
                    return strlen($l);
                },
            ]);
            if ($tijelo !== null) curl_setopt($c, CURLOPT_POSTFIELDS, u_json($tijelo));
            $tekst = curl_exec($c);
            $status = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
            if ($tekst === false) throw new Greska(502, 'GitHub nije dostupan: ' . curl_error($c));
        } else {
            $ctx = stream_context_create(['http' => ['method' => $metoda, 'header' => implode("\r\n", $zag), 'content' => $tijelo !== null ? u_json($tijelo) : null,
                'timeout' => 30, 'ignore_errors' => true]]);
            $tekst = @file_get_contents($url, false, $ctx);
            if ($tekst === false) throw new Greska(502, 'GitHub nije dostupan');
            $status = 0;
            foreach ($http_response_header ?? [] as $l) {
                if (preg_match('#^HTTP/\S+ (\d{3})#', $l, $m)) $status = (int) $m[1];
                elseif ($p = strpos($l, ':')) $odgZag[strtolower(trim(substr($l, 0, $p)))] = trim(substr($l, $p + 1));
            }
        }
        if (!empty($odgZag['github-authentication-token-expiration'])) {
            $t = strtotime($odgZag['github-authentication-token-expiration']);
            if ($t) $this->istjece = gmdate('Y-m-d\TH:i:s\Z', $t);
        }
        return [$status, $tekst === '' ? null : json_decode((string) $tekst, true)];
    }

    /** zahtjev koji mora uspjeti (2xx), inače razumljiva greška */
    public function mora(string $metoda, string $put, ?array $tijelo = null): mixed
    {
        [$s, $j] = $this->zahtjev($metoda, $put, $tijelo);
        if ($s >= 200 && $s < 300) return $j;
        throw new Greska(502, match ($s) {
            401 => 'GitHub token ne vrijedi ili je istekao.',
            403 => 'GitHub token nema potrebna dopuštenja (Contents: read and write, Actions: read).',
            404 => 'Repozitorij ne postoji ili mu token nema pristup.',
            default => "GitHub je odgovorio $s" . (is_array($j) && isset($j['message']) ? ": {$j['message']}" : ''),
        });
    }
}

final class Objava
{
    private string $postavkeDat;
    private string $stanjeDat;

    public function __construct(private string $podaci, private Slike $slike, private string $api)
    {
        $this->postavkeDat = $podaci . '/objava-postavke.json';
        $this->stanjeDat = $podaci . '/objava.json';
    }

    private function postavke(): array { return citaj_json($this->postavkeDat, []); }
    private function github(): ?GitHub
    {
        $p = $this->postavke();
        return !empty($p['token']) && !empty($p['repo']) ? new GitHub($this->api, $p['repo'], $p['token']) : null;
    }

    public function javnePostavke(): array
    {
        $p = $this->postavke();
        return ['vrsta' => 'github', 'repo' => $p['repo'] ?? '', 'grana' => $p['grana'] ?? 'sadrzaj', 'tokenPostavljen' => !empty($p['token']), 'tokenIstjece' => $p['tokenIstjece'] ?? null];
    }

    /** spremi postavke i odmah provjeri vezu (token se ne vraća sučelju) */
    public function spremiPostavke(mixed $repo, mixed $grana, mixed $token): void
    {
        $p = $this->postavke();
        $repo = is_string($repo) ? trim($repo) : '';
        $grana = is_string($grana) && trim($grana) !== '' ? trim($grana) : 'sadrzaj';
        $token = is_string($token) ? trim($token) : '';
        if (!preg_match('#^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$#', $repo)) throw new Greska(422, 'Repozitorij upiši kao vlasnik/repozitorij, npr. DjakaIT/septilion.');
        if (!preg_match('#^[A-Za-z0-9._-]{1,60}$#', $grana) || str_contains($grana, '..') || $grana === 'main') throw new Greska(422, 'Grana za sadržaj: slova, brojke, . _ - (ne main).');
        if ($token === '') $token = $p['token'] ?? '';
        if (!preg_match('/^(github_pat_|ghp_)[A-Za-z0-9_]{20,255}$/', $token)) throw new Greska(422, 'Upiši GitHub token (počinje s github_pat_).');
        $gh = new GitHub($this->api, $repo, $token);
        $gh->mora('GET', '');
        pisi_json($this->postavkeDat, ['repo' => $repo, 'grana' => $grana, 'token' => $token, 'tokenIstjece' => $gh->istjece]);
    }

    private function zapisi(array $s): array { pisi_json($this->stanjeDat, $s); return $s; }

    /** stanje za sučelje; dok objava traje, najviše svakih 8 s pita GitHub Actions */
    public function stanje(): array
    {
        $s = citaj_json($this->stanjeDat, ['stanje' => 'spremno', 'objavljeno' => null]);
        $gh = $this->github();
        if (!$gh) return ['stanje' => 'nije-postavljeno', 'objavljeno' => $s['objavljeno'] ?? null];
        if (($s['stanje'] ?? '') !== 'u-tijeku' || sad_ms() - ($s['provjereno'] ?? 0) < 8000) return self::javno($s);
        $s['provjereno'] = sad_ms();
        try {
            [$st, $j] = $gh->zahtjev('GET', '/actions/runs?event=repository_dispatch&per_page=20');
            if ($st === 403) throw new Greska(502, 'GitHub token nema dopuštenje Actions: read — stanje objave nije vidljivo.');
            if ($st !== 200) throw new Greska(502, "GitHub je odgovorio $st");
            $run = null;
            foreach ($j['workflow_runs'] ?? [] as $r) if (str_contains((string) ($r['display_title'] ?? ''), $s['sha'])) { $run = $r; break; }
            if (!$run) {
                if (sad_ms() - $s['pocetak'] > 10 * 60_000) $s = [...$s, 'stanje' => 'greska', 'poruka' => 'GitHub Actions nije pokrenuo objavu (je li objava.yml na grani main i OBJAVA_UKLJUCENA = da?).'];
            } elseif (($run['status'] ?? '') === 'completed') {
                $s = match ($run['conclusion'] ?? '') {
                    'success' => [...$s, 'stanje' => 'spremno', 'objavljeno' => $run['updated_at'] ?? iso_vrijeme(), 'poruka' => null],
                    'skipped' => [...$s, 'stanje' => 'greska', 'poruka' => 'Objava je isključena na GitHubu (varijabla OBJAVA_UKLJUCENA).'],
                    default => [...$s, 'stanje' => 'greska', 'poruka' => 'Izgradnja ili prijenos na hosting nisu uspjeli: ' . ($run['html_url'] ?? '')],
                };
            }
        } catch (Greska $e) {
            $s['poruka'] = $e->getMessage(); // prolazna greška veze: provjerava se ponovno
        }
        return self::javno($this->zapisi($s));
    }

    private static function javno(array $s): array
    {
        return ['stanje' => $s['stanje'] ?? 'spremno', 'objavljeno' => $s['objavljeno'] ?? null, 'poruka' => $s['poruka'] ?? null, 'verzija' => $s['verzija'] ?? null];
    }

    /** pošalji jelovnik (i fotografije koje grana još nema) u jedan commit i pokreni objavu */
    public function zatrazi(array $sadrzaj, string $opis): void
    {
        $gh = $this->github();
        if (!$gh) return; // stanje() javlja 'nije-postavljeno'
        $grana = $this->postavke()['grana'] ?? 'sadrzaj';
        $pocetak = sad_ms();
        try {
            [$st, $ref] = $gh->zahtjev('GET', '/git/ref/heads/' . rawurlencode($grana));
            if ($st !== 200 && $st !== 404) $gh->mora('GET', '/git/ref/heads/' . rawurlencode($grana));
            $roditelj = $st === 200 ? $ref['object']['sha'] : null;
            $postojece = [];
            $stabloRoditelja = null;
            if ($roditelj) {
                $stabloRoditelja = $gh->mora('GET', "/git/commits/$roditelj")['tree']['sha'];
                foreach ($gh->mora('GET', "/git/trees/$stabloRoditelja?recursive=1")['tree'] ?? [] as $e) $postojece[$e['path']] = true;
            }
            $stavke = [['path' => 'podaci/jelovnik.json', 'mode' => '100644', 'type' => 'blob',
                'sha' => $gh->mora('POST', '/git/blobs', ['content' => u_json($sadrzaj, true), 'encoding' => 'utf-8'])['sha']]];
            foreach (self::kljuceviSlika($sadrzaj) as $kljuc) {
                $put = "podaci/slike/$kljuc.webp";
                $datoteka = $this->slike->datoteka($kljuc);
                if (isset($postojece[$put]) || !$datoteka) continue;
                $stavke[] = ['path' => $put, 'mode' => '100644', 'type' => 'blob',
                    'sha' => $gh->mora('POST', '/git/blobs', ['content' => base64_encode((string) file_get_contents($datoteka)), 'encoding' => 'base64'])['sha']];
            }
            $stablo = $gh->mora('POST', '/git/trees', array_filter(['base_tree' => $stabloRoditelja, 'tree' => $stavke]))['sha'];
            $commit = $gh->mora('POST', '/git/commits', ['message' => "Uredništvo: $opis (verzija {$sadrzaj['verzija']})", 'tree' => $stablo, 'parents' => $roditelj ? [$roditelj] : []])['sha'];
            if ($roditelj) $gh->mora('PATCH', '/git/refs/heads/' . rawurlencode($grana), ['sha' => $commit]);
            else $gh->mora('POST', '/git/refs', ['ref' => "refs/heads/$grana", 'sha' => $commit]);
            $gh->mora('POST', '/dispatches', ['event_type' => 'sadrzaj', 'client_payload' => ['sha' => $commit, 'grana' => $grana]]);
            $this->zapisi(['stanje' => 'u-tijeku', 'sha' => $commit, 'verzija' => $sadrzaj['verzija'], 'pocetak' => $pocetak, 'provjereno' => 0,
                'objavljeno' => citaj_json($this->stanjeDat, [])['objavljeno'] ?? null, 'poruka' => null]);
            if ($gh->istjece) pisi_json($this->postavkeDat, [...$this->postavke(), 'tokenIstjece' => $gh->istjece]);
        } catch (Greska $e) {
            $this->zapisi(['stanje' => 'greska', 'poruka' => $e->getMessage(), 'pocetak' => $pocetak, 'objavljeno' => citaj_json($this->stanjeDat, [])['objavljeno'] ?? null]);
        }
    }

    private static function kljuceviSlika(array $s): array
    {
        $k = [];
        foreach ($s['kategorije'] as $kat) {
            foreach ([$kat['slika'], $kat['planet']] as $x) if (is_string($x) && str_starts_with($x, 'n-')) $k[$x] = true;
            foreach ($kat['stavke'] as $st) if (($st['tip'] ?? '') === 'jelo' && is_string($st['slika'] ?? null) && str_starts_with($st['slika'], 'n-')) $k[$st['slika']] = true;
        }
        return array_keys($k);
    }
}
