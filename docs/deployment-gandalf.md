# Deployment auf Gandalf

Diese Anleitung beschreibt das Deployment der Anwendung **KI-gestuetzte Prozessmodellierung** auf dem Server **Gandalf**. Der Code wird nicht mehr manuell kopiert, sondern ueber GitHub geladen und aktualisiert.

## Zielsystem

- Intel Core i9-9900K, 8 Kerne / 16 Threads
- 48 GB RAM
- 2x NVIDIA GTX 1080 Ti mit je 11 GB VRAM
- 1 Gbit/s Ethernet, Adresse laut Hardwareauszug: `192.168.14.64`
- Vorhandene Ollama-Datenpartition: `/srv/ollama`

## Projektstruktur

Die aktuelle Anwendung liegt im Repository direkt auf oberster Ebene:

```text
ProzessDiagramme/
├── data/                  # lokale Entwicklungsdaten, nicht fuer produktive Containerdaten
├── docs/                  # Dokumentation
├── public/                # Frontend: HTML, CSS, Browser-JavaScript
├── src/                   # Backend und Fachlogik
├── test/                  # Node.js-Tests
├── .env.example           # Beispielkonfiguration
├── Dockerfile             # Container-Image fuer die Anwendung
├── docker-compose.yml     # Deployment-Service fuer Gandalf
├── package.json           # Start- und Testbefehle
└── README.md
```

Wichtig: Das GitHub-Repository muss diese Struktur direkt enthalten. Wenn der Projektordner in GitHub in einem Unterordner liegt, muss auf Gandalf vor `docker compose` zuerst in diesen Unterordner gewechselt werden.

## GitHub als Quelle

GitHub ist die Quelle fuer Installation und Aktualisierungen. Gandalf soll den Stand aus GitHub beziehen, nicht aus lokal kopierten ZIP-Dateien oder manuell verschobenen Projektordnern.

Repository-URL eintragen:

```bash
REPO_URL="https://github.com/<konto>/<repo>.git"
```

Wenn das aktuell verwendete Repository weiterhin genutzt werden soll, lautet die URL nach der vorhandenen Git-Konfiguration:

```bash
REPO_URL="https://github.com/NVredenberg/Inventory.git"
```

Vor dem produktiven Deployment pruefen, dass dieses Repository wirklich den Ordnerinhalt von `C:\Users\nikae\ProzessDiagramme` enthaelt.

## Voraussetzungen auf Gandalf

Installiert und lauffaehig:

- Git
- Docker Engine
- Docker Compose Plugin (`docker compose`)
- Ollama direkt auf dem Host Gandalf
- Die benoetigten Ollama-Modelle

## Ollama vorbereiten

Ollama laeuft direkt auf dem Host Gandalf. Auf Gandalf sollte dieser Test erfolgreich sein:

```bash
curl http://127.0.0.1:11434/api/tags
```

Der Prozessmodellierungsdienst laeuft im Docker-Container und greift ueber den Docker-Hostnamen auf Ollama zu:

```text
http://host.docker.internal:11434
```

Die `docker-compose.yml` enthaelt dafuer:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Dadurch muss kein gemeinsames Docker-Netzwerk fuer Ollama angelegt werden.

Modelle bereitstellen:

```bash
ollama pull gemma4:12b
ollama pull qwen2.5:14b
```

## Erstinstallation ueber GitHub

Empfohlener Installationsort auf Gandalf:

```bash
sudo mkdir -p /opt/prozessdiagramme
sudo chown -R "$USER:$USER" /opt/prozessdiagramme
```

Repository klonen:

```bash
git clone "$REPO_URL" /opt/prozessdiagramme
cd /opt/prozessdiagramme
```

Konfiguration anlegen:

```bash
cp .env.example .env
```

Die Datei `.env` bleibt lokal auf Gandalf und wird nicht nach GitHub gepusht.

## Konfiguration

Standardwerte aus `docker-compose.yml`:

```text
PROCESS_MODELING_PORT=8080
OLLAMA_URL=http://host.docker.internal:11434
CHAT_MODEL=gemma4:12b
EXTRACT_MODEL=qwen2.5:14b
MAX_QUESTIONS=10
ENABLE_OLLAMA_CHAT=false
ENABLE_OLLAMA_EXTRACTION=false
```

Fuer den ersten Unterrichtsbetrieb empfiehlt sich:

```text
ENABLE_OLLAMA_CHAT=false
ENABLE_OLLAMA_EXTRACTION=false
```

Damit bleibt die lokale Heuristik aktiv und der Dienst ist auch erreichbar, wenn Ollama gerade ausgelastet ist oder Modelle gewechselt werden.

Wenn echte Modellaufrufe genutzt werden sollen:

```text
ENABLE_OLLAMA_CHAT=true
ENABLE_OLLAMA_EXTRACTION=true
```

Wenn ein anderer externer Port genutzt werden soll:

```bash
export PROCESS_MODELING_PORT="8081"
```

## Start

Aus dem Projektordner starten:

```bash
cd /opt/prozessdiagramme
docker compose up -d --build
```

Danach ist die Anwendung im Schulnetz erreichbar unter:

```text
http://192.168.14.64:8080
```

Bei abweichendem `PROCESS_MODELING_PORT` entsprechend den gewaehlten Port verwenden.

## Aktualisierung ueber GitHub

Aenderungen werden zuerst auf dem Entwicklungsrechner nach GitHub gepusht. Gandalf laedt sie anschliessend mit `git pull`.

Auf Gandalf aktualisieren:

```bash
cd /opt/prozessdiagramme
git fetch --prune
git status --short
git pull --ff-only
docker compose up -d --build
```

Danach kurz pruefen:

```bash
docker compose ps
docker compose logs --tail=100 prozessmodellierung
```

Wichtig: `docker compose up -d --build` ersetzt den Anwendungscontainer, aber das Docker-Volume `prozessmodellierung-data` bleibt erhalten.

Nicht verwenden, wenn produktive Daten erhalten bleiben sollen:

```bash
docker compose down -v
```

`down -v` wuerde das persistente Datenvolume loeschen.

## Typischer Update-Ablauf

Auf dem Entwicklungsrechner:

```powershell
cd C:\Users\nikae\ProzessDiagramme
git status
git add .
git commit -m "Deployment-Doku und Anwendung aktualisieren"
git push
```

Auf Gandalf:

```bash
cd /opt/prozessdiagramme
git pull --ff-only
docker compose up -d --build
```

## Betriebskontrollen

Healthcheck im Browser oder per Terminal:

```text
http://192.168.14.64:8080/health
```

Containerstatus:

```bash
docker compose ps
```

Live-Logs:

```bash
docker compose logs -f prozessmodellierung
```

Neustart ohne Code-Update:

```bash
docker compose restart prozessmodellierung
```

## Datenspeicherung

Produktive Daten liegen im Docker-Volume:

```text
prozessmodellierung-data
```

Das lokale Verzeichnis `data/` im Repository ist fuer Entwicklung und Beispiele gedacht. Im Container wird stattdessen `/app/data` verwendet, das durch das Docker-Volume dauerhaft gespeichert wird.

## Backup vor groesseren Updates

Backup-Verzeichnis anlegen:

```bash
mkdir -p /opt/backups/prozessdiagramme
```

Volume sichern:

```bash
docker run --rm \
  -v prozessmodellierung-data:/data:ro \
  -v /opt/backups/prozessdiagramme:/backup \
  busybox \
  tar czf /backup/prozessmodellierung-data-$(date +%F-%H%M).tar.gz -C /data .
```

Backups anzeigen:

```bash
ls -lh /opt/backups/prozessdiagramme
```

## Rollback

Wenn ein Update Probleme verursacht, zuerst die letzten Commits anzeigen:

```bash
cd /opt/prozessdiagramme
git log --oneline -5
```

Auf einen bekannten funktionierenden Commit zurueckgehen:

```bash
git checkout <commit-hash>
docker compose up -d --build
```

Wenn spaeter wieder auf den normalen Hauptstand gewechselt werden soll:

```bash
git switch main
git pull --ff-only
docker compose up -d --build
```

Falls der Hauptbranch anders heisst, `main` durch den richtigen Branchnamen ersetzen.

## Hinweise fuer die GitHub-Pflege

Der Projektordner auf dem Entwicklungsrechner sollte ein eigenes Git-Repository sein. Sonst besteht die Gefahr, dass versehentlich ein uebergeordneter Ordner oder ein falsches Repository verwendet wird.

Pruefen:

```powershell
cd C:\Users\nikae\ProzessDiagramme
git rev-parse --show-toplevel
```

Das Ergebnis sollte sein:

```text
C:/Users/nikae/ProzessDiagramme
```

Wenn stattdessen `C:/Users/nikae` erscheint, liegt das Projekt noch nicht als eigenes Repository vor. Dann sollte der Projektordner separat initialisiert oder sauber aus GitHub geklont werden, bevor Gandalf darueber aktualisiert wird.

## Schnellreferenz

Erstinstallation:

```bash
git clone "$REPO_URL" /opt/prozessdiagramme
cd /opt/prozessdiagramme
cp .env.example .env
docker compose up -d --build
```

Update:

```bash
cd /opt/prozessdiagramme
git pull --ff-only
docker compose up -d --build
```

Logs:

```bash
cd /opt/prozessdiagramme
docker compose logs -f prozessmodellierung
```
