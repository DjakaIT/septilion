<?php
// Samo za testove (php -S): ono što na hostingu radi Apache. /urednistvo/* -> urednistvo/php/index.php (kao .htaccess),
// sve ostalo -> izgrađena stranica iz UREDNISTVO_STRANICA (čiste adrese i održavanje kao .htaccess stranice) ili 404.
// Prava .htaccess pravila (public/.htaccess, urednistvo/php/.htaccess) provjerena su ručno u Apacheu 2.4 s PHP-om.
declare(strict_types=1);

$put = (string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($put === '/urednistvo' || str_starts_with($put, '/urednistvo/')) {
    require dirname(__DIR__, 2) . '/urednistvo/php/index.php';
    return true;
}
$korijen = getenv('UREDNISTVO_STRANICA') ?: '';
if (preg_match('#/\.#', $put)) { http_response_code(404); return true; } // .odrzavanje, .htaccess
// održavanje kao public/.htaccess: oznaka .odrzavanje, bez kolačića pregleda, nije datoteka -> odrzavanje.html (503)
$odrzavanje = $korijen && is_file("$korijen/.odrzavanje");
if ($odrzavanje && ($_COOKIE['septillion_pregled'] ?? '') !== '1' && !preg_match('/\.(css|js|mjs|woff2|svg|ico|png|jpe?g|webp|avif|gif|pdf|xml|txt|webmanifest)$/i', $put)) {
    http_response_code(503);
    header('Retry-After: 3600');
    header('Content-Type: text/html; charset=utf-8');
    readfile("$korijen/odrzavanje.html");
    return true;
}
if (!$odrzavanje && preg_match('#^/odrzavanje(\.html)?$#', $put)) { http_response_code(404); echo 'Nema stranice'; return true; }
$rel = $put === '/' ? '/index.html' : $put;
foreach ([$rel, "$rel.html"] as $p) {
    $f = realpath($korijen . $p);
    if ($korijen && $f && str_starts_with($f, realpath($korijen)) && is_file($f)) {
        $vrste = ['html' => 'text/html; charset=utf-8', 'js' => 'text/javascript', 'css' => 'text/css', 'webp' => 'image/webp', 'avif' => 'image/avif', 'svg' => 'image/svg+xml', 'xml' => 'application/xml', 'txt' => 'text/plain'];
        header('Content-Type: ' . ($vrste[pathinfo($f, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
        readfile($f);
        return true;
    }
}
http_response_code(404);
echo 'Nema stranice';
return true;
