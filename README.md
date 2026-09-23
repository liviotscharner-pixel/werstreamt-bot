# werstreamt-bot

Discord-Bot, der ankündigt, wenn Twitch-Streamer **live gehen**.

## So funktioniert’s

1. Die Liste der Twitch-Logins steht in `streamers.json` (Array von Strings).
2. Alle **60 Sekunden** prüft der Bot per **Twitch GQL** (öffentliche Web-Client-ID), wer live ist — **ohne** Twitch Developer-App, Client-ID oder Secret.
3. Wechselt ein Streamer von **offline → live**, postet der Bot ein Embed in den konfigurierten Discord-Kanal (Titel, Spiel, Zuschauer, Thumbnail, Link).
4. Der letzte Live-Status liegt in `data/live-state.json`, damit nach einem Neustart **nicht** erneut alle Live-Streamer angekündigt werden.
5. Beim Offline-Gehen wird der State gelöscht — **keine** Offline-Nachricht.

Die Streamer-Liste ist bereits befüllt; Logins bei Bedarf in `streamers.json` anpassen.

## Env-Variablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DISCORD_TOKEN` | ja | Bot-Token |
| `DISCORD_CHANNEL_ID` | ja | Zielkanal (Standard: `1552036391167336458`) |
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

## Lokal starten

```bash
cd /workspace/werstreamt-bot
cp .env.example .env   # DISCORD_TOKEN eintragen
npm install
npm start              # Produktion
npm run dev            # mit --watch
```

## Deploy (Railway)

- `Dockerfile` (node:20-alpine) und `railway.toml` sind vorhanden.
- In Railway nur setzen: `DISCORD_TOKEN`, `DISCORD_CHANNEL_ID`, optional `POLL_INTERVAL_MS`, `NODE_ENV=production`.
- Optional Volume für `/app/data`, damit `live-state.json` über Redeploys erhalten bleibt.
- `streamers.json` vor dem Deploy befüllen oder später per Redeploy aktualisieren.

## Projektstruktur

```
werstreamt-bot/
├── src/
│   ├── index.js      # Discord-Login, Poll-Loop
│   ├── config.js     # Env & streamers.json
│   ├── twitch.js     # Twitch GQL live-check (kein OAuth)
│   ├── state.js      # data/live-state.json
│   └── announce.js   # Discord-Embed (DE)
├── streamers.json
├── data/             # runtime, gitignored
├── Dockerfile
├── railway.toml
└── package.json
```
