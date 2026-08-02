# E3c – Sicherheitsheader und Browser-Schutz

## Ziel

Die Vercel-Auslieferung schützt die App gegen unerlaubte Skripte, Einbettung in
fremde Seiten, MIME-Type-Verwechslungen und unnötige Browserberechtigungen.
Supabase Auth, REST, Edge Functions, Realtime, Storage, signierte Videos und
direkte TUS-Uploads bleiben ausdrücklich erlaubt.

## Aktivierte Header

- `Content-Security-Policy`
- `Strict-Transport-Security: max-age=31536000`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- `X-Permitted-Cross-Domain-Policies: none`
- `X-XSS-Protection: 0`

## CSP-Grundsätze

- Skripte dürfen ausschließlich vom jeweiligen App-Ursprung geladen werden.
- Inline- und Eval-Skripte sind nicht freigegeben.
- Inline-Stile bleiben vorläufig erlaubt, weil Fortschrittsbalken und
  Statistikbalken dynamische Breiten als React-Style-Attribute verwenden.
- Verbindungen sind auf den App-Ursprung und Supabase beschränkt.
- Supabase Realtime ist über `wss://*.supabase.co` erlaubt.
- Direkte TUS-Uploads sind über `https://*.storage.supabase.co` erlaubt.
- Bilder und Videos aus privaten Supabase-Buckets sowie lokale Blob-Vorschauen
  bleiben erlaubt.
- Frames, Plugins und fremde Einbettung der App sind gesperrt.

## Berechtigungsrichtlinie

Kamera, Mikrofon, Standort, Bildschirmaufnahme, Payment und USB sind gesperrt.
Die vorhandenen App-Funktionen Video-Vollbild, Bild-in-Bild und
Bildschirm-Wachhalten bleiben für die App selbst erlaubt. Der normale
Dateiauswahldialog für Bilder und Videos wird dadurch nicht eingeschränkt.

## Automatische Prüfung

`npm run check:security-headers` prüft die lokale `vercel.json`.

Nach der Veröffentlichung kann dieselbe Prüfung gegen die echte App-URL laufen:

```powershell
npm.cmd run check:security-headers -- https://DEINE-APP-DOMAIN
```

## Manueller Funktionstest nach Veröffentlichung

1. Anmeldung und Abmeldung testen.
2. Eine Seite mit Bearbeitungsschutz auf zwei Geräten öffnen.
3. Ein Video aus einem privaten Supabase-Bucket abspielen.
4. Einen TUS-Upload starten, pausieren und fortsetzen.
5. Im Countdown prüfen, dass „Bildschirm bleibt aktiv“ weiterhin funktioniert.
6. Browser-Konsole auf CSP-Verletzungen prüfen.

## Keine Datenbankänderung

E3c benötigt keine SQL-Migration und verändert keine RLS-Regeln, Tabellen,
Storage-Buckets, CSS-Dateien oder fachliche Speicherlogik.
