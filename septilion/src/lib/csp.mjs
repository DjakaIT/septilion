// Jedan izvor istine za CSP: koristi ga <meta> u Base.astro i build hook koji upisuje zaglavlja
// u dist/.htaccess i dist/_headers. Jedina inline skripta je boot (hash, ne 'unsafe-inline').
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// cwd = korijen projekta (i u astro.config i pri buildu stranica; import.meta.url se pri bundlanju mijenja)
export const BOOT_JS = fs.readFileSync(path.join(process.cwd(), 'src/scripts/boot.inline.js'), 'utf8').trim();
export const BOOT_HASH = `'sha256-${crypto.createHash('sha256').update(BOOT_JS).digest('base64')}'`;

export function csp({ frameAncestors = false } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' ${BOOT_HASH}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(frameAncestors ? ["frame-ancestors 'none'"] : []),
    'upgrade-insecure-requests',
  ].join('; ');
}
