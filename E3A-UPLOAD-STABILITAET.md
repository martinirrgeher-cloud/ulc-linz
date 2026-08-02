# E3a – Upload-Stabilität

## Ziel

Video-Uploads im Übungskatalog und in der Trainingsdokumentation bleiben auch bei
langsamen Mobilfunkverbindungen, ablaufenden Access Tokens und kurzzeitigen
Unterbrechungen zuverlässig.

## Änderungen

- Bei HTTP 401 wird die Supabase-Session einmal aktiv erneuert und derselbe
  TUS-Schritt mit dem neuen Access Token wiederholt.
- Temporäre Netzwerkfehler löschen den gespeicherten TUS-Resume-Punkt nicht.
- Uploads können pausiert und mit derselben Datei fortgesetzt werden.
- Beim Verlassen des Editors wird der laufende Netzwerkrequest beendet; der
  Resume-Punkt bleibt für einen späteren Versuch erhalten.
- Scheitert die Datenbankregistrierung eines vollständig hochgeladenen Videos,
  wird das Storage-Objekt automatisch entfernt.
- Übungsvideos und Dokumentationsvideos verwenden dieselbe zentrale
  Auth-/Pause-Logik.

## Keine Datenbankänderung

E3a benötigt keine SQL-Migration und verändert keine Storage-Buckets oder RLS-Regeln.

## Manuelle Tests

1. Ein Video im Übungskatalog starten, pausieren und fortsetzen.
2. Während eines Uploads kurz auf Flugmodus wechseln und danach erneut fortsetzen.
3. Ein Dokumentationsvideo pausieren und über denselben Button fortsetzen.
4. Editor während eines Uploads schließen, erneut öffnen und dieselbe Datei wählen.
5. Nach erfolgreichem Upload prüfen, dass genau ein Videoeintrag vorhanden ist.
