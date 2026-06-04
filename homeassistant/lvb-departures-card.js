// Custom Lovelace card for the LVB departures dashboard.
// Fetches the same /api/departures endpoint (Netlify function or local server)
// and renders a compact, theme-aware departure board inside Home Assistant.
//
// Install: copy this file to <config>/www/, add it as a Lovelace resource
// (type: module), then add a card with `type: custom:lvb-departures-card`.
//
// Config:
//   url:     full URL to the departures API (required when HA != dashboard origin)
//            e.g. https://your-site.netlify.app/api/departures
//   title:   card header text (default: "Abfahrten")
//   count:   max rows to show (default: 8)
//   stop:    optional case-insensitive substring to filter by stop name
//   refresh: seconds between refreshes (default: 30)

const DEFAULTS = { url: "/api/departures", title: "Abfahrten", count: 8, refresh: 30 };

class LvbDeparturesCard extends HTMLElement {
  setConfig(config) {
    this._config = { ...DEFAULTS, ...(config || {}) };
    this._root = this.attachShadow({ mode: "open" });
    this._root.innerHTML = this._template();
    this._listEl = this._root.querySelector(".list");
    this._statusEl = this._root.querySelector(".status");
    this._load();
  }

  connectedCallback() {
    const sec = Math.max(10, Number(this._config?.refresh) || 30);
    this._timer = setInterval(() => this._load(), sec * 1000);
    // Keep countdowns fresh between fetches.
    this._tick = setInterval(() => this._render(), 15000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    clearInterval(this._tick);
  }

  getCardSize() {
    return Math.ceil((Number(this._config?.count) || 8) / 2) + 1;
  }

  async _load() {
    try {
      const u = new URL(this._config.url, window.location.origin);
      if (this._config.max) u.searchParams.set("max", this._config.max);
      const res = await fetch(u.toString(), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      this._data = data;
      this._error = null;
    } catch (err) {
      this._error = err.message || String(err);
    }
    this._render();
  }

  _departures() {
    let list = this._data?.departures || [];
    if (this._config.stop) {
      const needle = String(this._config.stop).toLowerCase();
      list = list.filter((d) => (d.stop || "").toLowerCase().includes(needle));
    }
    return list.slice(0, Number(this._config.count) || 8);
  }

  _countdown(epoch) {
    if (epoch == null) return "—";
    const diff = Math.round((epoch - Date.now()) / 60000);
    if (diff <= 0) return "jetzt";
    if (diff >= 60) return `${Math.floor(diff / 60)} Std`;
    return `${diff} Min`;
  }

  _render() {
    if (!this._listEl) return;

    if (this._error) {
      this._statusEl.textContent = `Fehler: ${this._error}`;
    } else if (this._data) {
      const t = new Date(this._data.generatedAt).toLocaleTimeString("de-DE");
      this._statusEl.textContent = `aktualisiert ${t}`;
    }

    const showStop = (this._data?.stops?.length || 0) > 1 && !this._config.stop;
    const list = this._departures();

    if (!list.length) {
      this._listEl.innerHTML = `<div class="empty">Keine Abfahrten.</div>`;
      return;
    }

    this._listEl.innerHTML = list
      .map((d) => {
        const late = d.delayMin != null && d.delayMin > 0;
        const showReal = d.hasRealtime && d.realtime && d.realtime !== d.scheduled;
        const stopLine = showStop && d.stop ? `<div class="stop">${esc(d.stop)}</div>` : "";
        const times = showReal
          ? `<span class="sched struck">${d.scheduled ?? ""}</span>
             <span class="real ${late ? "late" : ""}">${d.realtime}</span>`
          : `<span class="sched">${d.scheduled ?? "--:--"}</span>`;
        return `
          <div class="row">
            <div class="badge" style="background:${d.color?.bg || "#555"};color:${
          d.color?.fg || "#fff"
        }">${esc(d.lineShort || "?")}</div>
            <div class="dest">
              <div class="name">${esc(d.direction || "")}</div>
              ${stopLine}
            </div>
            <div class="times">${times}</div>
            <div class="cd">${this._countdown(d.departureEpoch)}</div>
          </div>`;
      })
      .join("");
  }

  _template() {
    return `
      <style>
        ha-card { padding: 12px 14px 14px; }
        .head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
        .title { font-size: 1.1rem; font-weight: 600; color: var(--primary-text-color); }
        .status { font-size: 0.72rem; color: var(--secondary-text-color); }
        .list { display:flex; flex-direction:column; gap:6px; }
        .row { display:grid; grid-template-columns: 40px 1fr auto auto; align-items:center; gap:10px;
               padding:6px 0; border-bottom:1px solid var(--divider-color); }
        .row:last-child { border-bottom:0; }
        .badge { font-weight:700; font-size:0.9rem; text-align:center; padding:4px 2px; border-radius:6px; }
        .dest { min-width:0; }
        .name { font-size:0.95rem; color:var(--primary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .stop { font-size:0.72rem; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .times { text-align:right; font-variant-numeric: tabular-nums; }
        .sched { font-weight:600; color:var(--primary-text-color); }
        .sched.struck { text-decoration:line-through; color:var(--secondary-text-color); font-size:0.8rem; }
        .real { font-weight:700; color: var(--success-color, #2ecc71); }
        .real.late { color: var(--error-color, #ff5d5d); }
        .cd { min-width:46px; text-align:right; font-weight:700; font-variant-numeric: tabular-nums;
              color: var(--primary-color); font-size:0.85rem; }
        .empty { color:var(--secondary-text-color); padding:10px 0; }
      </style>
      <ha-card>
        <div class="head">
          <span class="title">${esc(this._config.title)}</span>
          <span class="status">—</span>
        </div>
        <div class="list"></div>
      </ha-card>`;
  }

  static getStubConfig() {
    return { url: "https://your-site.netlify.app/api/departures", title: "Abfahrten", count: 8 };
  }
}

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

customElements.define("lvb-departures-card", LvbDeparturesCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lvb-departures-card",
  name: "LVB Departures",
  description: "Live LVB departure board (Leipzig) from the dashboard API.",
});
