// HAFAS mgate.exe client + StationBoard parser for LVB / NASA (reiseauskunft.insa.de).
// Builds the same request the LVB webapp sends and flattens the response into a
// clean shape the dashboard can render without knowing HAFAS internals.

const ENDPOINT = "https://reiseauskunft.insa.de/bin/mgate.exe";

// Stops shown in the combined board. Add more here to expand the view.
export const STOPS = [
  {
    name: "Leipzig, Georg-Schwarz-/Merseburger Str.",
    short: "Georg-Schwarz-/Merseburger Str.",
    lid: "A=1@O=Leipzig, Georg-Schwarz-/Merseburger Str.@X=12327312@Y=51338177@U=80@L=12555@p=1780475927@i=A×de:14713:12555,b×MASTER_12555,b×LVB_1030902,b×LVB_1031001,b×LVB_1030906,b×LVB_1031003@",
  },
  {
    name: "Leipzig, Lützner/Merseburger Str.",
    short: "Lützner/Merseburger Str.",
    lid: "A=1@O=Leipzig, Lützner/Merseburger Str.@X=12330117@Y=51335687@U=80@L=13196@p=1780475927@i=A×de:14713:13196,b×MASTER_13196,b×LVB_1027901,b×LVB_1027902,b×LVB_1027903,b×LVB_1027904@",
  },
  {
    name: "Leipzig, Erich-Köhn-Str.",
    short: "Erich-Köhn-Str.",
    lid: "A=1@O=Leipzig, Erich-Köhn-Str.@X=12329551@Y=51339642@U=80@L=31116@p=1780475927@i=A×de:14713:31116,b×LVB_1046201,b×LVB_1046202,b×MASTER_31116@",
  },
];

export const DEFAULT_STOP = STOPS[0];

function buildRequestBody({ lid, maxJny = 40 }) {
  return {
    id: Math.random().toString(36).slice(2, 18),
    ver: "1.48",
    lang: "deu",
    auth: { type: "AID", aid: "kAL6ULet" },
    client: { id: "NASA", type: "WEB", name: "webapp", l: "vs_webapp_lvb", v: 10000 },
    formatted: false,
    svcReqL: [
      {
        req: {
          jnyFltrL: [{ type: "PROD", mode: "INC", value: 1023 }],
          stbLoc: { lid },
          type: "DEP",
          sort: "PT",
          maxJny,
        },
        meth: "StationBoard",
        id: "1|6|",
      },
    ],
  };
}

export async function fetchStationBoard({ lid = DEFAULT_STOP.lid, maxJny = 40 } = {}) {
  const url = `${ENDPOINT}?rnd=${Date.now()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://reiseauskunft.insa.de",
      Referer:
        "https://reiseauskunft.insa.de/lvb/index.html?showPanCakeMenu=false&antiZoomHandling=yes",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    },
    body: JSON.stringify(buildRequestBody({ lid, maxJny })),
  });
  if (!res.ok) throw new Error(`HAFAS HTTP ${res.status}`);
  const json = await res.json();
  if (json.err && json.err !== "OK") throw new Error(`HAFAS error: ${json.err}`);
  return json;
}

// "103700" -> "10:37"
function fmtTime(t) {
  if (!t || t.length < 4) return null;
  return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

// "103700" + date "20260604" -> epoch ms (local time, ignoring HAFAS day-offset edge cases)
function toEpoch(date, t) {
  if (!date || !t) return null;
  const y = +date.slice(0, 4);
  const mo = +date.slice(4, 6) - 1;
  const d = +date.slice(6, 8);
  const hh = +t.slice(0, 2);
  const mm = +t.slice(2, 4);
  const ss = +(t.slice(4, 6) || "0");
  return new Date(y, mo, d, hh, mm, ss).getTime();
}

function rgb(c) {
  return c ? `rgb(${c.r}, ${c.g}, ${c.b})` : null;
}

// Flatten a StationBoard response into { stop, generatedAt, departures: [...] }.
export function parseStationBoard(json) {
  const svc = json?.svcResL?.find((s) => s.meth === "StationBoard");
  const res = svc?.res;
  if (!res) throw new Error("No StationBoard result in response");

  const common = res.common || {};
  const prodL = common.prodL || [];
  const icoL = common.icoL || [];
  const remL = common.remL || [];
  const opL = common.opL || [];
  const locL = common.locL || [];

  const stopName = locL[0]?.name || "Unknown stop";

  const departures = (res.jnyL || []).map((j) => {
    const prod = prodL[j.prodX] || {};
    const ico = icoL[prod.icoX] || {};
    const st = j.stbStop || {};

    const schedTime = st.dTimeS;
    const realTime = st.dTimeR; // may be undefined when no realtime yet
    const schedEpoch = toEpoch(j.date, schedTime);
    const realEpoch = toEpoch(j.date, realTime);

    let delayMin = null;
    if (schedEpoch != null && realEpoch != null) {
      delayMin = Math.round((realEpoch - schedEpoch) / 60000);
    }

    // Remarks attached to this journey -> flags.
    const remCodes = (j.msgL || [])
      .filter((m) => m.type === "REM" && m.remX != null)
      .map((m) => remL[m.remX]?.code);

    return {
      id: j.jid,
      line: prod.name?.trim() || prod.nameS || "?",
      lineShort: prod.nameS || prod.name?.trim() || "?",
      direction: j.dirTxt || "",
      category: prod.prodCtx?.catOut?.trim() || "",
      cls: prod.cls,
      color: { bg: rgb(ico.bg) || "#444", fg: rgb(ico.fg) || "#fff" },
      scheduled: fmtTime(schedTime),
      realtime: fmtTime(realTime),
      departureEpoch: realEpoch ?? schedEpoch,
      delayMin,
      delayText: st.dTimeFR?.txtA || null,
      hasRealtime: realEpoch != null,
      cancelled: j.isCncl === true,
      additional: j.status === "A" || remCodes.includes("text.realtime.journey.additional.service"),
      operator: opL[prod.oprX]?.name || null,
      position: j.pos ? { x: j.pos.x / 1e6, y: j.pos.y / 1e6 } : null, // WGS84 lon/lat
    };
  });

  // Sort by actual departure time so the board reads top-to-bottom by next-to-leave.
  departures.sort((a, b) => (a.departureEpoch ?? Infinity) - (b.departureEpoch ?? Infinity));

  return {
    stop: stopName,
    generatedAt: Date.now(),
    departures,
  };
}

// Fetch several stops in parallel and merge into one time-sorted board.
// Each departure is tagged with the stop it belongs to.
export async function fetchCombinedBoard({ stops = STOPS, maxJny = 40 } = {}) {
  const results = await Promise.allSettled(
    stops.map((s) => fetchStationBoard({ lid: s.lid, maxJny }).then((raw) => ({ s, raw })))
  );

  const departures = [];
  const errors = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected") {
      errors.push({ stop: stops[i].name, error: String(r.reason?.message || r.reason) });
      continue;
    }
    const { s, raw } = r.value;
    const parsed = parseStationBoard(raw);
    for (const d of parsed.departures) {
      d.stop = s.short || s.name;
      departures.push(d);
    }
  }

  departures.sort((a, b) => (a.departureEpoch ?? Infinity) - (b.departureEpoch ?? Infinity));

  return {
    stops: stops.map((s) => s.short || s.name),
    generatedAt: Date.now(),
    departures,
    errors,
  };
}
