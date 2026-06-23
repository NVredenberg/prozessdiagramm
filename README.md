# KI-gestützte Prozessmodellierung

Lokales Web-Tool für den Roadmap-Arbeitstitel **KI-gestützte Prozessmodellierung**. Das MVP setzt das Kernprinzip um:

**Text -> Struktur -> Validierung -> Diagramm**

Ein Diagramm wird nur erzeugt, wenn Start, Ablauf, Verantwortlichkeiten und Ende logisch ausreichend befüllt sind.

## Enthalten

- Node.js-Webdienst mit BPMN-Layout, grafischem Editor und PDF-Export
- Statisches Frontend für Prozesseingabe, geführten Dialog, Pflichtblock-Status, Validierung und grafische BPMN-Bearbeitung mit `bpmn-js`
- Healthcheck mit Ollama-Verbindungsstatus
- Session-Speicherung als JSON im Datenverzeichnis
- BPMN-2.0-XML-Generierung mit Lanes, Tasks, Start-/End-Event, optionalem Gateway und automatischem Layout
- Druckansicht und Puppeteer-basierter PDF-Export
- Dockerfile und Docker-Compose-Service für das Schulnetz
- ISO-25010-orientierte Qualitätsdokumentation

## Lokal starten

Einmalig die Abhängigkeiten installieren:

```powershell
pnpm install
```

```powershell
node src/server.js
```

Dann im Browser öffnen:

```text
http://localhost:8080
```

## Tests

```powershell
node --test
```

## Docker

Der Compose-Service erwartet ein vorhandenes externes Docker-Netzwerk, in dem auch Ollama erreichbar ist:

```powershell
docker compose up --build
```

Wenn das Ollama-Netzwerk anders heißt:

```powershell
$env:OLLAMA_DOCKER_NETWORK="name-des-netzwerks"
docker compose up --build
```

## Ollama

Standardkonfiguration:

- `OLLAMA_URL=http://ollama:11434`
- `CHAT_MODEL=gemma4:12b`
- `EXTRACT_MODEL=qwen2.5:14b`

Die lokale Heuristik bleibt aktiv, damit der Dienst auch bei Modellwechseln, Wartung oder hoher GPU-Auslastung erreichbar bleibt. Echte Modellaufrufe können gezielt über Umgebungsvariablen eingeschaltet werden:

```text
ENABLE_OLLAMA_CHAT=true
ENABLE_OLLAMA_EXTRACTION=true
```

## Nächste Ausbaustufen

- Mehrbenutzerbetrieb, Login und Versionierung ergänzen
