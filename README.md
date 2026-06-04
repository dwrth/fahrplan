# LVB Departures Dashboard

Small live departure-board dashboard built on the LVB / NASA HAFAS `mgate.exe`
endpoint (`reiseauskunft.insa.de`). Shows the next departures for a stop with
realtime delays, line colors, extra-trip flags, and a countdown.

![board](https://img.shields.io/badge/realtime-LVB-cc0000)

## Run

Needs Node 18+ (uses built-in `fetch`). No dependencies.

```bash
npm start
# -> http://localhost:3000
```

A proxy is required because the browser can't call `mgate.exe` cross-origin.
The server (`server.js`) makes the request, the parser (`hafas.js`) flattens the
HAFAS response, and the frontend (`public/`) renders it.

## Deploy to Netlify

Netlify can't run the long-lived `server.js`, so the proxy runs as a serverless
function instead. `netlify/functions/departures.mjs` reuses `hafas.js` and is
mapped to the same `/api/departures` path the frontend already calls, so no
frontend change is needed.

```bash
npm i -g netlify-cli   # once
netlify dev            # local: static site + function together
netlify deploy --prod  # publish
```

Or via the Netlify UI: connect the repo and deploy. `netlify.toml` already sets
`publish = "public"`, the functions dir, and Node 20.

## Home Assistant card

`homeassistant/lvb-departures-card.js` is a custom Lovelace card that renders the
board inside Home Assistant. It fetches the same `/api/departures` endpoint, so
point it at your deployed dashboard (the API sends `Access-Control-Allow-Origin: *`
so HA can fetch it cross-origin).

1. Copy the file into your HA config: `<config>/www/lvb-departures-card.js`.
2. Add it as a Lovelace resource (Settings → Dashboards → ⋮ → Resources):
   - URL `/local/lvb-departures-card.js`, type **JavaScript module**.
3. Add the card:

```yaml
type: custom:lvb-departures-card
url: https://your-site.netlify.app/api/departures
title: Abfahrten
count: 8
refresh: 30
# stop: Erich-Köhn   # optional: filter to one stop (substring match)
```

| Option    | Default        | Meaning                                          |
| --------- | -------------- | ------------------------------------------------ |
| `url`     | `/api/departures` | API endpoint (use the full deployed URL)      |
| `title`   | `Abfahrten`    | Card header                                      |
| `count`   | `8`            | Rows to show                                     |
| `stop`    | —              | Case-insensitive substring filter on stop name   |
| `refresh` | `30`           | Seconds between refreshes                         |

The card uses HA theme variables, so it adapts to light/dark automatically.

## Pieces

| File              | Role                                                        |
| ----------------- | ----------------------------------------------------------- |
| `hafas.js`        | Builds the mgate request + parses StationBoard into clean JSON |
| `server.js`       | Zero-dep HTTP server: `/api/departures` + static files (local) |
| `netlify/functions/departures.mjs` | Same proxy as a Netlify serverless function |
| `public/`         | Dashboard UI (auto-refresh every 30s)                        |
| `homeassistant/lvb-departures-card.js` | Custom Lovelace card for Home Assistant |

## Changing the stop

Default stop is `Leipzig, Georg-Schwarz-/Merseburger Str.` (from the sample
request). Override per request with the HAFAS location id:

```
/api/departures?lid=<HAFAS lid>&max=40
```

The `lid` looks like `A=1@O=...@L=12555@...@`. Edit `DEFAULT_STOP` in
`hafas.js` to change the default.

## API shape

`GET /api/departures` returns:

```json
{
  "stop": "Leipzig, Georg-Schwarz-/Merseburger Str.",
  "generatedAt": 1780562231323,
  "departures": [
    {
      "line": "Str 7", "lineShort": "7",
      "direction": "Leipzig, Sommerfeld",
      "color": { "bg": "rgb(204,0,0)", "fg": "rgb(255,255,255)" },
      "scheduled": "10:37", "realtime": "10:38",
      "delayMin": 1, "delayText": "1 Minuten später",
      "hasRealtime": true, "additional": false,
      "position": { "x": 12.328, "y": 51.337 }
    }
  ]
}
```
# fahrplan
