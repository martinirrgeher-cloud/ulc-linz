# Online-Testkorrekturen v0.4.1

## Enthaltene Änderungen

- größeres Logo auf Anmeldung und in der Kopfzeile
- Passwort kann ein- und ausgeblendet werden
- zentraler App-Name `ULC Linz Oberbank`
- Modulübersicht mit flexiblen, einklappbaren Bereichen
- kompaktere Athletenkarten mit Statuspunkt und Stift-Symbol
- robustere Wiederherstellung der Sitzung nach Bildschirmsperre oder Browser-Pause
- verständlichere Fehlermeldung bei nicht erreichbarer Einladungsfunktion

## Einladungsfunktion für die Online-Adresse freigeben

Ersetze `DEINE-VERCEL-ADRESSE` durch die vollständige produktive Adresse ohne abschließenden Schrägstrich.

```powershell
npx.cmd --yes supabase@2.109.1 secrets set `
  APP_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,https://DEINE-VERCEL-ADRESSE" `
  APP_INVITE_REDIRECT_URL="https://DEINE-VERCEL-ADRESSE/passwort-neu"
```

Kontrolle:

```powershell
npx.cmd --yes supabase@2.109.1 secrets list
```

Nach dem Setzen der Secrets ist kein erneutes Deployment der Edge Function erforderlich.

Zusätzlich in Supabase unter `Authentication > URL Configuration`:

- Site URL: `https://DEINE-VERCEL-ADRESSE`
- Redirect URL: `https://DEINE-VERCEL-ADRESSE/**`
- lokale Redirect URL behalten: `http://localhost:5173/**`

## App-Name

Lokal in `.env.local`:

```env
VITE_APP_NAME=ULC Linz Oberbank
```

In Vercel unter `Settings > Environment Variables` denselben Wert für Production und Preview setzen und danach neu deployen.
