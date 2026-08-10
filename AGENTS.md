# ULC Linz App – verbindliche Codex-Arbeitsregeln

## Zweck

Dieses Repository enthält die produktive ULC-Linz-App.

Technischer Kern:
- React
- TypeScript
- Vite
- React Router
- Supabase / PostgreSQL / Auth
- Playwright
- Vercel

Änderungen müssen produktionssicher, nachvollziehbar und möglichst klein gehalten werden.

## 1. Grundsatz: Bestehende Funktionen schützen

Bestehende fachliche Funktionen und Abläufe dürfen nicht stillschweigend verändert, entfernt oder vereinfacht werden.

Wenn eine gewünschte Änderung:
- bestehendes Verhalten verändert,
- einer vorhandenen Logik widerspricht,
- bestehende Funktionen ersetzt,
- Daten oder Berechtigungen anders interpretiert,
- oder Auswirkungen außerhalb des ausdrücklich gewünschten Bereichs hat,

muss Codex dies vor der Umsetzung ausdrücklich melden und die Entscheidung des Benutzers abwarten.

Keine fachliche Entscheidung selbst treffen, wenn mehrere plausible Varianten bestehen.

## 2. Vor jeder Änderung

Vor jeder Implementierung zuerst prüfen:

1. aktuellen Git-Branch,
2. aktuellen vollständigen Commit-SHA,
3. `git status`,
4. relevante bestehende Implementierung,
5. vorhandene Tests,
6. betroffene Datenbank-/API-/Berechtigungslogik,
7. mögliche Auswirkungen auf andere Funktionen.

Wenn der Working Tree vor Beginn unerwartete Änderungen enthält:
STOPP.

Bestehende fremde oder nicht eindeutig zur aktuellen Aufgabe gehörende Änderungen nicht überschreiben, zurücksetzen oder bereinigen.

## 3. Git-Sicherheitsregeln

Ohne ausdrücklichen Auftrag des Benutzers niemals:

- committen,
- pushen,
- pullen,
- mergen,
- rebasen,
- Branches löschen,
- Tags erstellen oder löschen,
- Force-Push durchführen,
- `git reset --hard` verwenden,
- produktive Releases oder Deployments auslösen.

Codex darf lokale Änderungen durchführen, wenn dies Bestandteil des ausdrücklich erteilten Entwicklungsauftrags ist.

GitHub `main` gilt als geschützter Produktionsstand.

## 4. Änderungsumfang

Nur Dateien ändern, die für die konkrete Aufgabe erforderlich sind.

Keine beiläufigen:
- Refactorings,
- Formatierungsänderungen,
- Umbenennungen,
- Architekturumbauten,
- Dependency-Upgrades,
- Cleanup-Aktionen

durchführen, sofern sie nicht für die Aufgabe notwendig oder ausdrücklich beauftragt sind.

Wenn ein größerer Umbau sinnvoll wäre, zuerst vorschlagen und begründen.

## 5. Vollständige Lösungen

Keine bewusst vereinfachten Lösungen implementieren, wenn dadurch notwendige Funktionen verloren gehen.

Keine provisorischen Workarounds verwenden, wenn die eigentliche Ursache sauber behoben werden kann.

Fehlerursachen beheben und nicht lediglich Symptome unterdrücken.

Keine TODO-, Dummy-, Mock- oder Platzhalterimplementierungen als fertige Lösung hinterlassen, außer sie wurden ausdrücklich verlangt.

## 6. Kindertraining, U12 und U14

Kindertraining, U12 und U14 dürfen gemeinsame technische Grundlagen für neutrale und stabile Logik verwenden.

Die drei Bereiche müssen fachlich jedoch unabhängig weiterentwickelbar bleiben.

Deshalb:
- getrennte Modul-/Route-Grenzen erhalten,
- geeignete Adapter bzw. Erweiterungspunkte je Trainingsgruppe vorsehen,
- keine starre gemeinsame Monolith-Seite erzeugen,
- fachgruppenspezifisches Verhalten nicht ungefragt vereinheitlichen.

Gemeinsamer Code ist nur sinnvoll, wenn die betreffende Logik tatsächlich fachlich neutral ist.

## 7. Supabase und Datenbank

Datenbankänderungen besonders vorsichtig behandeln.

Keine produktiven Daten löschen oder verändern, sofern dies nicht ausdrücklich beauftragt wurde.

Keine destruktiven SQL-Operationen ohne ausdrückliche Freigabe.

Bereits verwendete Migrationen nicht nachträglich verändern, wenn dadurch unterschiedliche Datenbankzustände entstehen könnten. In diesem Fall eine neue nachvollziehbare Migration erstellen.

Bei Schemaänderungen prüfen:
- Migration,
- TypeScript-Typen,
- RLS,
- Policies,
- Rollen/Berechtigungen,
- bestehende Daten,
- Seeds,
- Datenbanktests,
- Frontend-Nutzung.

Keine RLS-, Authentifizierungs- oder Sicherheitsregeln abschwächen, um einen Fehler oder Test zu umgehen.

## 8. Benutzerrechte und Sicherheit

Berechtigungsprüfungen müssen server-/datenbankseitig wirksam bleiben, wenn dies fachlich erforderlich ist.

UI-Ausblendung allein gilt nicht als Sicherheitsmechanismus.

Keine vorhandenen Sicherheitsprüfungen entfernen oder abschwächen, nur damit eine Funktion oder ein Test funktioniert.

Secrets, Tokens, Passwörter und Zugangsdaten niemals in Quellcode, Logs, Tests oder Dokumentationsdateien schreiben.

## 9. Tests

Bestehende Tests nicht löschen, deaktivieren, skippen oder inhaltlich abschwächen, nur damit eine Änderung erfolgreich erscheint.

Wenn ein bestehender Test nach einer Änderung fehlschlägt:
1. Ursache analysieren,
2. feststellen, ob Implementierung oder Test fachlich falsch ist,
3. bei fachlicher Unklarheit Benutzer fragen,
4. erst danach korrigieren.

Nach normalen Codeänderungen mindestens die zur Änderung passenden Prüfungen ausführen.

Je nach Umfang gehören dazu insbesondere:
- TypeScript-Typecheck,
- relevante statische Prüfungen,
- relevante Unit-/Runtime-/E2E-Tests,
- Build.

Bei weitreichenden Änderungen zusätzliche vorhandene Qualitäts- und Releaseprüfungen berücksichtigen.

Tests nicht unnötig vollständig ausführen, wenn eine gezielte Prüfung dieselbe Sicherheit bietet. Vor Produktionsfreigaben jedoch den dafür vorgesehenen vollständigen Prüfpfad verwenden.

## 10. Windows und PowerShell

Primäre lokale Entwicklungsumgebung ist Windows.

PowerShell-Kompatibilität beachten.

Wenn `npm.ps1` aufgrund der PowerShell Execution Policy blockiert wird, nicht eigenständig die globale Windows-Sicherheitsrichtlinie lockern.

Bei Bedarf `npm.cmd` bzw. eine sichere vorhandene Alternative verwenden.

Keine systemweiten Konfigurationsänderungen ohne ausdrückliche Zustimmung.

## 11. Abhängigkeiten

Neue npm-Pakete nur hinzufügen, wenn sie technisch gerechtfertigt sind.

Vor Installation prüfen:
- ob vorhandene Abhängigkeiten die Aufgabe bereits lösen,
- Wartungszustand,
- Sicherheitsauswirkungen,
- Bundle-/Performance-Auswirkungen.

Keine Dependency-Upgrades außerhalb der aktuellen Aufgabe durchführen.

Keine automatischen `npm audit fix`, insbesondere keine Force-Variante, ohne ausdrücklichen Auftrag.

## 12. Mobile Nutzung

Die Anwendung wird wesentlich auf Smartphones verwendet.

Bei UI-Änderungen mobile Darstellung und insbesondere Hochformat berücksichtigen.

Desktop-Funktionalität darf dabei nicht unnötig verschlechtert werden.

Bestehende Performance-Budgets und responsive Layouts respektieren.

## 13. Release und Deployment

Ohne ausdrücklichen Auftrag niemals:
- Deployment starten,
- Vercel-Produktion verändern,
- Produktions-Tag erstellen,
- Release markieren,
- GitHub-PR mergen.

Bestehende Release-, Prüf-, Backup- und Rollback-Mechanismen nicht umgehen.

Wenn ein bestehender Sicherheitsmechanismus für eine gewünschte Änderung hinderlich erscheint, nicht entfernen, sondern Ursache erklären.

## 14. Backup- und Hilfsverzeichnisse

Bestehende Backup-, Testresultat- und generierte Verzeichnisse nicht als primäre Quellcodebasis behandeln.

Insbesondere ältere Sicherungen nicht ungefragt wiederherstellen oder verändern.

Die aktuelle versionierte Implementierung im Git-Repository ist die maßgebliche Basis.

## 15. Abschluss jeder Implementierung

Nach Abschluss einer Änderung immer kompakt berichten:

- was geändert wurde,
- warum es geändert wurde,
- welche Dateien geändert wurden,
- welche bestehende Funktion dadurch bewusst verändert wurde,
- welche Tests/Prüfungen ausgeführt wurden,
- Ergebnis der Prüfungen,
- verbleibende Risiken oder offene Punkte,
- Git-Status.

Wenn keine bestehende Funktion verändert wurde, dies ausdrücklich angeben.

Keine Commit-, Push- oder Deployment-Aktion eigenständig anschließen.

## 16. Stop-Bedingungen

Codex muss stoppen und nachfragen, wenn:

- Anforderungen widersprüchlich sind,
- eine fachliche Entscheidung erforderlich ist,
- bestehendes Verhalten durch die Änderung wahrscheinlich verloren geht,
- unerwartete lokale Änderungen gefunden werden,
- Datenverlust möglich ist,
- Sicherheitsmechanismen betroffen sind,
- eine Migration potenziell destruktiv ist,
- eine notwendige Aktion außerhalb des ausdrücklich beauftragten Umfangs liegt.

Im Zweifel lieber Analyse und Rückfrage statt einer riskanten Annahme.

## 17. Priorität

Für dieses Projekt gilt grundsätzlich:

Korrektheit
> Schutz bestehender Funktionen
> Datensicherheit
> Nachvollziehbarkeit
> Testbarkeit
> Wartbarkeit
> Geschwindigkeit der Umsetzung

Eine schnellere Lösung ist kein Vorteil, wenn sie bestehende Funktionalität, Datenintegrität oder Sicherheit gefährdet.
