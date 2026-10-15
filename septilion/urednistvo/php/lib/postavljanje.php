<?php
// Prvo postavljanje (još nema nijednog korisnika) — uvijek na /urednistvo, bez posebne poveznice.
// Na hostingu treba kod iz datoteke PRVO-POSTAVLJANJE.txt u mapi s podacima (izvan public_html): vidi je samo
// vlasnik hostinga (cPanel -> File Manager). Kod je stalan dok se ne iskoristi; datoteka se briše nakon postavljanja.
declare(strict_types=1);

final class Postavljanje
{
    public readonly string $datoteka;

    public function __construct(string $dir, private string $adresa) { $this->datoteka = $dir . '/PRVO-POSTAVLJANJE.txt'; }

    /** kod iz datoteke; stvara ga ako ga još nema */
    public function kod(): string
    {
        $s = is_file($this->datoteka) ? (string) @file_get_contents($this->datoteka) : '';
        if (preg_match('/^ {2}([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})$/m', $s, $m)) return $m[1];
        $z = nasumicni_kod(15);
        $kod = substr($z, 0, 5) . '-' . substr($z, 5, 5) . '-' . substr($z, 10);
        pisi_atomarno($this->datoteka, "Septillion uredništvo — prvo postavljanje\n\nOtvori {$this->adresa}/urednistvo i upiši ovaj kod:\n\n  $kod\n\n"
            . "Kod vrijedi dok se ne postavi prvi račun; nakon toga se ova datoteka sama briše.\n");
        return $kod;
    }

    public function provjeri(mixed $unos): bool { return hash_equals(normaliziraj_kod($this->kod()), normaliziraj_kod($unos)) && normaliziraj_kod($unos) !== ''; }
    public function ukloni(): void { @unlink($this->datoteka); }
}
