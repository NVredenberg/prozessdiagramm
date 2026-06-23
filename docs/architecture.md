# Architektur

## Zielbild

Die Anwendung läuft als eigener Docker-Service im Schulnetz und nutzt die bestehende Ollama-Instanz gemeinsam mit dem Lernfeld-DOCX-Generator. Der Dienst bleibt fachlich bewusst klein: Prozesse werden aus Text und Rückfragen in eine validierte Struktur überführt und erst danach als BPMN-XML erzeugt.

## Laufzeitkomponenten

- **Frontend:** statische HTML/CSS/JS-Oberfläche mit Prozessformular, geführtem Chat, Validierung, bpmn-js-Modeler und Export-Aktionen
- **Backend:** Node.js-HTTP-Server mit Session-API, Healthcheck, Validierung, BPMN-Generierung, bpmn-auto-layout, PDF-Rendering und statischer Dateiauslieferung
- **Persistenz:** Dateibasierte JSON-Sessions im Datenverzeichnis; austauschbar gegen SQLite in der nächsten Stufe
- **KI-Anbindung:** Ollama-Client mit Healthcheck und vorbereiteten Schaltern für Chat- und Strukturierungsaufrufe
- **Deployment:** Docker-Compose-Service im externen Docker-Netzwerk der Schul-KI-Dienste

## API

- `GET /health`: Dienststatus, Ollama-Verbindungsstatus, Modellnamen
- `GET /api/config`: öffentliche UI-Konfiguration
- `POST /api/sessions`: neue Prozess-Session anlegen
- `GET /api/sessions/:id`: Session lesen
- `POST /api/sessions/:id/messages`: Antwort im geführten Dialog ergänzen
- `POST /api/sessions/:id/structure`: Struktur validieren und bei Erfolg BPMN erzeugen
- `GET /api/sessions/:id/bpmn`: BPMN-XML herunterladen
- `GET /api/sessions/:id/export.html`: druckbare Prozessmodellseite
- `GET /api/sessions/:id/export.pdf`: Puppeteer-basierter PDF-Export der Prozessmodellseite

## Datenfluss

1. Nutzer wählt Profil und gibt den Prozess als Freitext ein.
2. Die Anwendung erkennt befüllte und fehlende Pflichtblöcke.
3. Fehlende Blöcke werden über maximal `MAX_QUESTIONS` Rückfragen abgefragt.
4. Die Struktur wird validiert.
5. Nur bei fehlerfreier Validierung wird BPMN-XML erzeugt, automatisch layoutet und gespeichert.
6. Das Frontend importiert das BPMN in den grafisch editierbaren Modeler und bietet XML-, HTML- sowie PDF-Export an.

## Bewusste MVP-Grenzen

- Änderungen im bpmn-js-Modeler können als BPMN-XML exportiert werden; eine serverseitige Versionsspeicherung ist noch nicht enthalten.
- Der PDF-Export benötigt eine lauffähige Puppeteer/Chromium-Installation im Zielsystem.
- SQLite ist in der Roadmap vorgesehen. Das MVP nutzt weiterhin JSON-Dateien für portable lokale Sessions.
