# ULC Linz App – Entwicklung am Handy

Stand: 2026-08-08

## Ziel

Die normale Windows-Entwicklung bleibt unverändert verfügbar. Zusätzlich gibt es einen sicheren mobilen Preview-Ablauf, bei dem das Handy keinen lokalen Build und kein lokales Git benötigt.

Der bevorzugte mobile Weg ist bewusst einfacher als eine vollständige Entwicklungsumgebung im Browser:

**ChatGPT -> MOBILE-PATCH-ZIP -> GitHub-Branch -> GitHub Actions -> Vercel Preview -> Test am Handy -> Pull Request.**

Produktion wird dabei niemals direkt aus einem mobilen Patch geändert.

## A. Empfohlener Mobile-Preview-Ablauf

### 1. Änderung im Chat ausarbeiten

Die gewünschte Änderung normal mit ChatGPT besprechen. Für den mobilen Ablauf wird statt eines Windows-Overlay-Pakets eine Datei mit diesem Namensmuster erzeugt:

```text
MOBILE-PATCH-<kurzer-name>.zip
```

Die ZIP enthält nur `manifest.json` und die vollständigen geänderten Dateien unter `payload/`. Alte und neue SHA-256-Hashes sind im Manifest festgelegt.

### 2. Mobilen Branch direkt von `main` erstellen

Im GitHub-Browser am Handy:

1. Repository `ulc-linz` öffnen.
2. Branch-Auswahl öffnen.
3. neuen Branch `mobile-patch/<kurzer-name>` direkt von aktuellem `main` erstellen.

Jede neue mobile Änderung startet von einem frischen Branch. Alte mobile Patch-Branches werden nicht wiederverwendet.

### 3. Patch-ZIP hochladen

Auf dem neuen `mobile-patch/...`-Branch:

1. **Add file / Upload files** wählen.
2. genau eine `MOBILE-PATCH-*.zip` in das Repository-Hauptverzeichnis hochladen.
3. Upload committen.

Der Workflow **Mobile Preview vorbereiten** startet automatisch.

### 4. GitHub prüft und übernimmt den Patch

Der Workflow:

- akzeptiert nur `mobile-patch/...`-Branches,
- prüft, dass der Branch auf aktuellem `main` basiert,
- erlaubt keine Änderung an geschützter Infrastruktur wie `.github/`, `.git/`, `node_modules/` oder `dist/`,
- prüft für jede Datei den erwarteten Ausgangs-Hash und den neuen Payload-Hash,
- führt das schnelle `ci:preview`-Gate aus,
- commitet ausschließlich den exakt geprüften Patch mit dem GitHub-Actions-Bot in denselben Branch.

Schlägt eine Prüfung fehl, wird kein App-Code committed.

### 5. Vercel Preview am Handy testen

Nach dem Bot-Commit den Branch/Commit in GitHub öffnen. Der Vercel-Check bzw. das Deployment liefert die Preview-URL für diesen Branch.

Diese Preview ist der eigentliche mobile Teststand. Navigation, Darstellung und Funktionen können direkt am Smartphone geprüft werden, ohne dass der Windows-PC laufen muss.

### 6. Feedback oder Pull Request

- **Noch nicht passend:** Feedback im Chat geben. Für die nächste Iteration wird ein neuer, auf dem aktuellen Branchstand abgestimmter Patch erstellt.
- **Passt:** Pull Request von `mobile-patch/<name>` nach `main` erstellen.

Erst im Pull Request laufen die normalen Qualitäts- und E2E-Gates. Produktion ändert sich erst nach bewusstem **Squash and merge**.

## B. Welche Tests wann laufen

### Mobile Patch vor der Preview

`ci:preview` prüft schnell und ohne lokale Supabase-/Docker-Umgebung:

- TypeScript
- Smoke-/Strukturtests
- Migrationen und generierte Datenbanktypen
- Sicherheits-, Hilfe-, PWA-, Katalog-, CSS- und Simulationsprüfungen
- Produktions-Build
- Performance-Budget

Die teuren Browser-/Supabase-Vollregressionen werden nicht doppelt vor der ersten Preview ausgeführt.

### Pull Request

- Read-only E2E: schneller 390-px-Chromium-Lauf.
- Schreibende E2E: nur wenn schreibrelevante TypeScript-, Supabase- oder E2E-Dateien geändert wurden; dann das markierte PR-Kernset.
- Der zentrale Quality-Workflow bleibt das verpflichtende Release-Gate mit echtem Runtime-Browser-Test.

### `main` oder manueller Start

Nach dem Merge beziehungsweise bei `workflow_dispatch` bleiben die vollständigen Regressionen erhalten:

- Read-only: 360, 390, 430 px und Desktop.
- Schreibend: vollständige isolierte Supabase-Suite.

Damit werden Pull Requests schneller, ohne die Vollregression zu entfernen.

## C. Optional: Codespaces für manuelle Änderungen

Für Fälle, in denen unterwegs wirklich Dateien von Hand bearbeitet werden sollen, enthält das Repository `.devcontainer/devcontainer.json`.

Ein GitHub Codespace installiert mit `npm ci` die Node-Abhängigkeiten und kann Vite auf Port 5173 bereitstellen. Das ist die erweiterte Variante; für normale von ChatGPT vorbereitete Änderungen ist der Mobile-Patch-/Vercel-Weg einfacher und sicherer.

## D. PC-Ablauf bleibt unverändert

Am PC gelten weiterhin:

```text
ULC-AENDERUNG-STARTEN.cmd
ULC-PRUEFEN.cmd
ULC-FREIGEBEN.cmd
ULC-PRODUKTION-MARKIEREN.cmd
```

Normale Windows-Overlay-Pakete verwenden weiterhin `manifest.json`, Basis-Commit und SHA-256-Prüfungen mit vollständigem Rollback bei Fehlern.

## E. Sicherheitsgrenzen

Ein mobiler Patch darf **nicht** ändern:

- `.github/`
- `.git/`
- `node_modules/`
- `dist/`
- Patch-/Backup-Infrastruktur

Änderungen an Workflows, Auth-Basis, Release-Infrastruktur oder anderen bewusst geschützten Bereichen werden weiterhin als normales Releasepaket über den PC-Ablauf durchgeführt.
