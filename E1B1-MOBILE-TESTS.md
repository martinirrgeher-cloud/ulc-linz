# E1b.1 - Nicht schreibende Mobile-End-to-End-Tests

## Zweck

Die Tests pruefen echte React-Seiten im Browser, ohne auf die produktive Supabase-Datenbank zuzugreifen. Authentifizierung und Lesedaten werden ausschliesslich im Browser ueber `https://e2e.supabase.co` simuliert und von Playwright abgefangen.

## Gepruefte Ansichten

- 360 x 800 Pixel
- 390 x 844 Pixel
- 430 x 932 Pixel
- 1280 x 900 Pixel als Desktop-Kontrolle

## Gepruefte Bereiche

- Login und Passwort-Reset
- Weiterleitung geschuetzter Routen
- Moduluebersicht
- Athleten, Trainer und Gruppen
- Uebungskatalog
- Trainingsbloecke
- Trainingsplan-Uebersicht
- Trainingsplanung
- Benutzerverwaltung
- Intervall-Countdown
- Kopfzeile und Benutzermenue
- lange Block- und Uebungsnamen in der Trainingsplanung

## Sicherheitsgrenze

Die Suite verwendet keine produktiven URLs, keine GitHub-Secrets und keine schreibenden RPCs. Unbekannte Supabase-Anfragen werden mit Fehler abgelehnt und lassen den Test fehlschlagen.

## Lokal ausfuehren

```powershell
Set-Location "C:\ULC Linz App"
npm.cmd run test:e2e:readonly
```

Das Skript installiert Playwright 1.62.1 nur in `node_modules`, veraendert `package-lock.json` nicht, baut die App mit isolierten E2E-Werten und startet die Browserpruefungen.
