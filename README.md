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

## Pieces

| File              | Role                                                        |
| ----------------- | ----------------------------------------------------------- |
| `hafas.js`        | Builds the mgate request + parses StationBoard into clean JSON |
| `server.js`       | Zero-dep HTTP server: `/api/departures` + static files      |
| `public/`         | Dashboard UI (auto-refresh every 30s)                        |

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
