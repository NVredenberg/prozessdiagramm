# Qualitätsmerkmale nach ISO/IEC 25010

## Funktionale Eignung

- Validierung verhindert Diagrammerstellung bei fehlendem Start, fehlendem Ende, unklarem Ablauf oder fehlenden Verantwortlichkeiten.
- BPMN-XML nutzt ein gemeinsames Zielformat für Swimlane und BPMN-light.
- bpmn-auto-layout ergänzt Diagramm-Interchange-Daten für komplexere Abläufe, mit Fallback auf das interne Layout.
- bpmn-js erlaubt grafische Bearbeitung im Frontend und Export des bearbeiteten BPMN-XML.
- Exportfunktionen greifen auf gespeicherte, validierte Session-Daten zu.

## Leistungseffizienz

- Der Node-Dienst lädt schwere Layout- und PDF-Abhängigkeiten nur bei Bedarf.
- Ollama wird im Healthcheck mit Timeout geprüft, damit die Weboberfläche nicht blockiert.
- KI-Funktionen sind schaltbar, um die gemeinsam genutzten GTX-1080-Ti-GPUs nicht unnötig zu belasten.

## Kompatibilität

- Docker-Compose bindet den Dienst in ein externes Ollama-Netzwerk ein.
- BPMN-2.0-XML bleibt mit Standardwerkzeugen weiterverwendbar.
- Konfiguration erfolgt über Umgebungsvariablen statt harter Hostnamen.

## Gebrauchstauglichkeit

- Die Oberfläche zeigt Pflichtblöcke, offene Punkte und Validierung direkt im Arbeitsfluss.
- Rückfragen sind gedeckelt, damit der Dialog nicht ausufert.
- Profile sind auf schulgerechte Varianten reduziert: Swimlane und BPMN-light.

## Zuverlässigkeit

- Der Dienst bleibt verfügbar, wenn Ollama nicht erreichbar ist; der Status wird transparent angezeigt.
- Session-Daten werden atomar über temporäre Dateien geschrieben.
- Fehlerhafte Eingaben liefern strukturierte API-Fehler statt Serverabbrüchen.

## Sicherheit

- Keine Cloud-Verarbeitung; Prozessdaten bleiben im lokalen Schulnetz.
- Session-IDs werden serverseitig erzeugt und Pfade werden nicht aus Nutzereingaben gebaut.
- Statische Auslieferung normalisiert Pfade und verhindert Verlassen des `public`-Verzeichnisses.
- Vendor-Assets aus `node_modules` werden nur über eine feste Allowlist ausgeliefert.

## Wartbarkeit

- Fachlogik ist in kleine Module getrennt: Statusanalyse, Validierung, BPMN, Speicherung, Ollama.
- Tests decken Pflichtblock-Erkennung, Validierung, BPMN-Erzeugung, Layout-Fallback und API-Exporte ab.
- Roadmap-Erweiterungen können an klaren Schnittstellen ergänzt werden.

## Portabilität

- Betrieb lokal mit Node.js oder containerisiert mit Docker.
- Datenverzeichnis ist per `DATA_DIR` konfigurierbar.
- Puppeteer benötigt eine passende Chromium-Laufzeitumgebung; das Docker-Image bringt die nötigen Bibliotheken mit.

## Weitere Qualitätsmerkmale

- **Datenschutz:** lokale Verarbeitung, keine externen API-Aufrufe im Standardbetrieb.
- **Betriebsfähigkeit:** Healthcheck, Docker-Restart-Policy und persistentes Volume.
- **Nachvollziehbarkeit:** Validierung trennt Fehler und Warnungen.
- **Erweiterbarkeit:** SQLite, Login, Versionierung und serverseitige Speicherung grafischer BPMN-Edits sind als nächste technische Stufen vorgesehen.
