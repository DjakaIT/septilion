<?php
// Uredništvo Septillion na hostingu (Apache + PHP 8.1+, bez baze): sve adrese /urednistvo/* dolaze ovdje (.htaccess).
// Podaci su IZVAN javne mape: /home/<korisnik>/septillion-podaci (jelovnik, fotografije, korisnici, sesije, dnevnik).
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');

$nedostaje = array_values(array_filter(['mbstring', 'gd', 'json'], fn ($e) => !extension_loaded($e)));
if (!extension_loaded('curl') && !ini_get('allow_url_fopen')) $nedostaje[] = 'curl';
if (PHP_VERSION_ID < 80100 || $nedostaje || !function_exists('imagewebp')) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Uredništvo treba PHP 8.1 ili noviji s proširenjima mbstring, gd (s WebP), json i curl.\n"
        . 'Sada: PHP ' . PHP_VERSION . ($nedostaje ? ', nedostaje: ' . implode(', ', $nedostaje) : '') . (function_exists('imagewebp') ? '' : ', gd bez WebP-a')
        . "\ncPanel -> Select PHP Version (ili MultiPHP Manager) -> PHP 8.3 i uključi proširenja.";
    exit;
}

foreach (['osnova', 'sigurnost', 'korisnici', 'sesije', 'ogranicenja', 'postavljanje', 'sadrzaj', 'spremiste', 'slike', 'objava', 'odrzavanje', 'api'] as $f) require __DIR__ . "/lib/$f.php";

$env = static fn (string $ime): ?string => ($v = getenv($ime)) === false || $v === '' ? null : $v;
(new Urednistvo([
    'podaci' => $env('UREDNISTVO_PODACI') ?? dirname(__DIR__, 2) . '/septillion-podaci',
    'konfiguracija' => $env('UREDNISTVO_KONFIGURACIJA') ?? __DIR__,
    'sucelje' => $env('UREDNISTVO_SUCELJE') ?? __DIR__ . '/static',
    // javna mapa stranice (public_html): ondje je oznaka održavanja .odrzavanje koju čita .htaccess
    'javno' => $env('UREDNISTVO_JAVNO') ?? dirname(__DIR__),
    // lokalno = samo testovi na ovom računalu (http, localhost); na hostingu se nikad ne postavlja
    'lokalno' => $env('UREDNISTVO_LOKALNO') === '1',
    'githubApi' => $env('UREDNISTVO_GITHUB_API') ?? 'https://api.github.com',
]))->obradi();
