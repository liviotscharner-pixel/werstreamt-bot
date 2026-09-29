# werstreamt-bot

Discord-Bot, der ankündigt, wenn Twitch-Streamer **live gehen** (und offline gehen).

## So funktioniert’s

1. Die Liste der Twitch-Logins steht in `streamers.json` (Array von Strings).
2. Alle **60 Sekunden** prüft der Bot per **Twitch GQL** (öffentliche Web-Client-ID), wer live ist — **ohne** Twitch Developer-App, Client-ID oder Secret.
3. Wechselt ein Streamer von **offline → live**, postet der Bot ein Embed in den Default-Kanal `DISCORD_CHANNEL_ID` (Titel, Spiel, Zuschauer, Thumbnail, Link). Zusätzliche Kanäle pro Login stehen in `extra-live-channels.json` (nur Go-Live, nicht Offline).
4. Der letzte Live-Status liegt in `data/live-state.json`, damit nach einem Neustart **nicht** erneut alle Live-Streamer angekündigt werden.
5. Beim Offline-Gehen postet der Bot eine kurze Nachricht **nur** in den Default-Kanal und löscht den State-Eintrag.

Die Streamer-Liste ist bereits befüllt; Logins bei Bedarf in `streamers.json` anpassen.

## Env-Variablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DISCORD_TOKEN` | ja | Bot-Token |
| `DISCORD_CHANNEL_ID` | ja | Default-Zielkanal (Standard: `1552036391167336458`) |
| `POLL_INTERVAL_MS` | nein | Poll-Intervall (Standard `60000`) |

Vorlage: `.env.example`. Lokale Secrets gehören in `.env` (nicht committen).

**Twitch:** Es wird **keine** Twitch Developer-App und kein `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` benötigt. Der Live-Check nutzt die öffentliche Twitch-Web-GQL-API.

## streamers.json

```json
[
  "loginname1",
  "loginname2"
]
```

Nur der Twitch-**Login** (URL-Name), nicht der Anzeigename. Groß-/Kleinschreibung egal.

## extra-live-channels.json

Optionale Zuordnung Twitch-Login → zusätzliche Discord-Kanal-IDs. Beim Go-Live wird zusätzlich zum Default-Kanal auch dort gepostet; Offline-Nachrichten bleiben Default-only.

```json
{
  "luckytherabit": ["1551555345267171408"]
}
```

## Lokal starten

```bash
cd /workspace/werstreamt-bot
cp .env.example .env   # DISCORD_TOKEN eintragen
npm install
npm start              # Produktion
npm run dev            # mit --watch
```

## Deploy (Fly.io) — empfohlen

Long-running Worker (kein HTTP nötig). Config: `fly.toml` (Region `fra`, shared-cpu-1x / 256 MB).

```bash
# einmalig
fly auth login
fly apps create werstreamt-bot   # falls Name frei
fly secrets set DISCORD_TOKEN=... \
  DISCORD_CHANNEL_ID=1552036391167336458 \
  POLL_INTERVAL_MS=60000
fly deploy                       # aus Repo-Root

# Logs / Status
fly status
fly logs
fly machines list
```

Optional Volume für persistentes `live-state.json`:

```bash
fly volumes create werstreamt_data --region fra --size 1
# dann in fly.toml den [mounts]-Block einkommentieren und erneut deployen
```

Dashboard: https://fly.io/apps/werstreamt-bot

## Deploy (Railway) — Legacy

- `Dockerfile` (node:20-alpine) und `railway.toml` sind vorhanden.
- In Railway nur setzen: `DISCORD_TOKEN`, `DISCORD_CHANNEL_ID`, optional `POLL_INTERVAL_MS`, `NODE_ENV=production`.
- Optional Volume für `/app/data`, damit `live-state.json` über Redeploys erhalten bleibt.
- `streamers.json` / `extra-live-channels.json` vor dem Deploy befüllen oder später per Redeploy aktualisieren.
- Railway-Projekt nicht löschen, solange Fly nicht live und bestätigt ist.

## Projektstruktur

```
werstreamt-bot/
├── src/
│   ├── index.js      # Discord-Login, Poll-Loop
│   ├── config.js     # Env, streamers.json, extra-live-channels.json
│   ├── twitch.js     # Twitch GQL live-check (kein OAuth)
│   ├── state.js      # data/live-state.json
│   └── announce.js   # Discord-Embed (DE)
├── streamers.json
├── extra-live-channels.json
├── data/             # runtime, gitignored
├── Dockerfile
├── fly.toml
├── railway.toml
└── package.json
```
