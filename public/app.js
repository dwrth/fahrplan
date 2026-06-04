const REFRESH_MS = 30_000;

const els = {
  stop: document.getElementById("stop"),
  stopSub: document.getElementById("stopSub"),
  clock: document.getElementById("clock"),
  refresh: document.getElementById("refresh"),
  board: document.getElementById("board"),
  filters: document.getElementById("lineFilters"),
  stopFilters: document.getElementById("stopFilters"),
  error: document.getElementById("error"),
  empty: document.getElementById("empty"),
};

let state = {
  departures: [],
  stops: [],
  activeLine: "ALL",
  activeStop: "ALL",
};

function tickClock() {
  els.clock.textContent = new Date().toLocaleTimeString("de-DE");
}

function countdown(epoch) {
  if (epoch == null) return { text: "—", now: false };
  const diff = Math.round((epoch - Date.now()) / 60000);
  if (diff <= 0) return { text: "jetzt", now: true };
  if (diff >= 60) return { text: `${Math.floor(diff / 60)} Std`, now: false };
  return { text: `${diff}`, unit: "Min", now: diff <= 2 };
}

function renderChips(container, values, active, onPick, labelAll = "Alle") {
  container.innerHTML = ["ALL", ...values]
    .map(
      (v) =>
        `<button class="chip ${v === active ? "active" : ""}" data-val="${escapeHtml(v)}">${
          v === "ALL" ? labelAll : escapeHtml(v)
        }</button>`
    )
    .join("");
  container.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => onPick(c.dataset.val))
  );
}

function renderFilters() {
  const lines = [...new Set(state.departures.map((d) => d.lineShort))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  renderChips(els.filters, lines, state.activeLine, (v) => {
    state.activeLine = v;
    renderFilters();
    renderBoard();
  });

  // Only show the stop selector when more than one stop is in the board.
  if (state.stops.length > 1) {
    renderChips(els.stopFilters, state.stops, state.activeStop, (v) => {
      state.activeStop = v;
      renderFilters();
      renderBoard();
    }, "Alle Haltestellen");
  } else {
    els.stopFilters.innerHTML = "";
  }
}

function rowInner(d) {
  const cd = countdown(d.departureEpoch);
  const late = d.delayMin != null && d.delayMin > 0;
  const showReal = d.hasRealtime && d.realtime && d.realtime !== d.scheduled;

  const tags = [];
  if (d.position) tags.push(`<span class="tag live">● Live</span>`);
  if (d.additional) tags.push(`<span class="tag add">Zusatzfahrt</span>`);
  if (d.category) tags.push(`<span class="tag">${d.category}</span>`);

  const timeBlock = showReal
    ? `<div class="sched struck">${d.scheduled ?? ""}</div>
       <div class="real ${late ? "late" : ""}">${d.realtime}</div>`
    : `<div class="sched">${d.scheduled ?? "--:--"}</div>`;

  const delayLine = d.delayText ? `<div class="delaytxt">${d.delayText}</div>` : "";

  const stopLine =
    d.stop && state.stops.length > 1
      ? `<div class="stopname">${escapeHtml(d.stop)}</div>`
      : "";

  return `
    <div class="badge" style="background:${d.color.bg};color:${d.color.fg}">${d.lineShort}</div>
    <div class="dest">
      <div class="name">${escapeHtml(d.direction)}</div>
      ${stopLine}
      <div class="tags">${tags.join("")}</div>
    </div>
    <div class="times">${timeBlock}${delayLine}</div>
    <div class="countdown ${cd.now ? "now" : ""}">${cd.text}${
    cd.unit ? `<br><small>${cd.unit}</small>` : ""
  }</div>`;
}

// Keyed reconcile: reuse existing <li> nodes so refreshes don't flicker.
// Only brand-new rows run the entrance animation; unchanged rows aren't touched.
function renderBoard() {
  let list = state.departures;
  if (state.activeLine !== "ALL") list = list.filter((d) => d.lineShort === state.activeLine);
  if (state.activeStop !== "ALL") list = list.filter((d) => d.stop === state.activeStop);

  els.empty.hidden = list.length > 0;

  const existing = new Map();
  for (const li of els.board.children) existing.set(li.dataset.id, li);

  let prev = null;
  const seen = new Set();
  for (const d of list) {
    const key = `${d.stop || ""}|${d.id}`;
    seen.add(key);
    const html = rowInner(d);
    let li = existing.get(key);
    if (!li) {
      li = document.createElement("li");
      li.className = "row";
      li.dataset.id = key;
      li.innerHTML = html;
    } else if (li.dataset.html !== html) {
      li.innerHTML = html; // content changed -> update in place (no animation replay)
    }
    li.dataset.html = html;

    // Place in correct order without disturbing nodes already in position.
    const target = prev ? prev.nextSibling : els.board.firstChild;
    if (li !== target) els.board.insertBefore(li, target);
    prev = li;
  }

  for (const [id, li] of existing) if (!seen.has(id)) li.remove();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function load() {
  try {
    const res = await fetch("/api/departures");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    state.departures = data.departures;
    state.stops = data.stops || [];
    els.stopSub.textContent = state.stops.join(" · ") || "Live LVB · Leipzig";
    els.error.hidden = !(data.errors && data.errors.length);
    if (data.errors && data.errors.length) {
      els.error.textContent =
        "Teilweise nicht geladen: " + data.errors.map((e) => e.stop).join(", ");
    }
    renderFilters();
    renderBoard();
    els.refresh.textContent = `aktualisiert ${new Date(data.generatedAt).toLocaleTimeString("de-DE")}`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = `Abfahrten konnten nicht geladen werden: ${err.message}`;
  }
}

setInterval(tickClock, 1000);
tickClock();
load();
setInterval(load, REFRESH_MS);
// Re-render countdowns between fetches so numbers stay current.
setInterval(renderBoard, 15_000);
