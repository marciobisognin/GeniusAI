/* ARGUS dashboard: MapLibre + OpenFreeMap, clustering, heatmap, time-slider,
   fato vs. inferência, trilhas AIS/ADS-B e WebSocket ao vivo. */
"use strict";

const API = "";
const SEVERITY_COLORS = {
  critical: "#ff4d4d",
  high: "#ff9f40",
  medium: "#ffd166",
  low: "#4dd0e1",
};

const state = {
  geojson: { type: "FeatureCollection", features: [] },
  hours: 72,
  tracks: { adsb: {}, ais: {} }, // hex/mmsi -> [[lon,lat], ...]
};

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty", // tiles abertos, sem chave
  center: [20, 25],
  zoom: 2,
  attributionControl: true,
});
map.addControl(new maplibregl.NavigationControl(), "top-left");
map.keyboard.enable();

map.on("load", async () => {
  map.addSource("events", {
    type: "geojson",
    data: state.geojson,
    cluster: true,
    clusterMaxZoom: 8,
    clusterRadius: 45,
  });
  map.addSource("events-flat", { type: "geojson", data: state.geojson });
  map.addSource("tracks", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "events",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#6ea8fe",
      "circle-opacity": 0.75,
      "circle-radius": ["step", ["get", "point_count"], 14, 20, 20, 100, 28],
    },
  });
  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "events",
    filter: ["has", "point_count"],
    layout: { "text-field": "{point_count_abbreviated}", "text-size": 11 },
    paint: { "text-color": "#0b1120" },
  });
  map.addLayer({
    id: "event-points",
    type: "circle",
    source: "events",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["match", ["get", "severity"], "critical", 9, "high", 7, 5],
      "circle-color": [
        "match", ["get", "severity"],
        "critical", SEVERITY_COLORS.critical,
        "high", SEVERITY_COLORS.high,
        "medium", SEVERITY_COLORS.medium,
        SEVERITY_COLORS.low,
      ],
      // fato = opaco; inferência = translúcido (distinção visual exigida pelo PRD)
      "circle-opacity": ["case", ["get", "is_inference"], 0.45, 0.95],
      "circle-stroke-width": 1,
      "circle-stroke-color": "#0b1120",
    },
  });
  map.addLayer({
    id: "heatmap",
    type: "heatmap",
    source: "events-flat",
    layout: { visibility: "none" },
    paint: {
      "heatmap-radius": 30,
      "heatmap-opacity": 0.6,
    },
  });
  map.addLayer({
    id: "tracks",
    type: "line",
    source: "tracks",
    paint: { "line-color": "#6ea8fe", "line-width": 1.2, "line-opacity": 0.7 },
  });

  map.on("click", "event-points", (e) => {
    const p = e.features[0].properties;
    const badge = p.is_inference === "true" || p.is_inference === true
      ? '<span class="popup-badge">inferência</span>' : '<span class="popup-badge">fato</span>';
    new maplibregl.Popup()
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(
        `<strong>${escapeHtml(p.title)}</strong>${badge}<br/>` +
        `<span class="sev ${p.severity}">${p.severity}</span> · ${p.category ?? "?"}<br/>` +
        `${escapeHtml(p.source_name ?? "")} ` +
        (p.source_url ? `<a href="${encodeURI(p.source_url)}" target="_blank" rel="noopener">fonte ↗</a>` : "")
      )
      .addTo(map);
  });
  map.on("click", "clusters", async (e) => {
    const cluster = e.features[0];
    const zoom = await map.getSource("events").getClusterExpansionZoom(cluster.properties.cluster_id);
    map.easeTo({ center: cluster.geometry.coordinates, zoom });
  });
  map.on("mouseenter", "event-points", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "event-points", () => (map.getCanvas().style.cursor = ""));

  await refreshEvents();
  connectWebSocket();
  refreshSidebar();
  setInterval(refreshSidebar, 30000);
});

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function refreshEvents() {
  const resp = await fetch(`${API}/api/v1/map/geojson?hours=${state.hours}`);
  state.geojson = await resp.json();
  const src = map.getSource("events");
  if (src) {
    src.setData(state.geojson);
    map.getSource("events-flat").setData(state.geojson);
  }
}

/* ---- Time slider (reproduz as últimas 1–72h) ---- */
const slider = document.getElementById("time-slider");
slider.addEventListener("input", () => {
  state.hours = Number(slider.value);
  document.getElementById("time-label").textContent = `${state.hours}h`;
});
slider.addEventListener("change", refreshEvents);

document.getElementById("toggle-heatmap").addEventListener("change", (e) => {
  map.setLayoutProperty("heatmap", "visibility", e.target.checked ? "visible" : "none");
});
document.getElementById("toggle-tracks").addEventListener("change", (e) => {
  map.setLayoutProperty("tracks", "visibility", e.target.checked ? "visible" : "none");
});

/* ---- WebSocket ao vivo ---- */
function connectWebSocket() {
  const status = document.getElementById("ws-status");
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/api/v1/ws`);
  ws.onopen = () => { status.textContent = "ao vivo"; status.className = "badge ok"; };
  ws.onclose = () => {
    status.textContent = "reconectando…"; status.className = "badge err";
    setTimeout(connectWebSocket, 3000);
  };
  ws.onmessage = (msg) => {
    const { type, data } = JSON.parse(msg.data);
    if (type === "event") addLiveEvent(data);
    else if (type === "alert") addAlert(data);
    else if (type.startsWith("positions:")) updateTracks(type.split(":")[1], data);
  };
}

function addLiveEvent(ev) {
  prependFeedItem("events-list", feedLine(ev));
  if (ev.lat != null && ev.lon != null) {
    state.geojson.features.unshift({
      type: "Feature",
      geometry: { type: "Point", coordinates: [ev.lon, ev.lat] },
      properties: { ...ev, id: ev.event_id },
    });
    map.getSource("events")?.setData(state.geojson);
    map.getSource("events-flat")?.setData(state.geojson);
  }
}

function addAlert(alert) {
  prependFeedItem("alerts-list",
    `<span class="sev ${alert.severity}">●</span> [${escapeHtml(alert.rule_name)}] ${escapeHtml(alert.title ?? "")}`);
}

function feedLine(ev) {
  const badge = ev.is_inference ? "≈inferência" : "fato";
  const corro = ev.corroborating_sources != null
    ? ` · ${ev.corroborating_sources} fonte(s)` : "";
  const link = ev.source_url
    ? ` <a href="${encodeURI(ev.source_url)}" target="_blank" rel="noopener">↗</a>` : "";
  return `<span class="sev ${ev.severity}">${escapeHtml(ev.severity ?? "?")}</span> ` +
    `${escapeHtml(ev.title ?? "")} <em>(${badge}${corro})</em>${link}`;
}

function prependFeedItem(listId, html) {
  const li = document.createElement("li");
  li.innerHTML = html;
  const list = document.getElementById(listId);
  list.prepend(li);
  while (list.children.length > 40) list.removeChild(list.lastChild);
}

/* ---- Trilhas de posição AIS/ADS-B ---- */
function updateTracks(layer, positions) {
  const store = state.tracks[layer];
  for (const [id, pos] of Object.entries(positions)) {
    (store[id] ??= []).push([pos.lon, pos.lat]);
    if (store[id].length > 50) store[id].shift();
  }
  const features = [];
  for (const trackStore of Object.values(state.tracks)) {
    for (const coords of Object.values(trackStore)) {
      if (coords.length > 1) {
        features.push({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} });
      }
    }
  }
  map.getSource("tracks")?.setData({ type: "FeatureCollection", features });
}

/* ---- Painel lateral: alertas, feed, perfil LLM, custo ---- */
async function refreshSidebar() {
  try {
    const [alerts, metrics, profile] = await Promise.all([
      fetch(`${API}/api/v1/alerts?limit=15`).then((r) => r.json()),
      fetch(`${API}/api/v1/alerts/metrics`).then((r) => r.json()),
      fetch(`${API}/api/v1/llm/profile`).then((r) => r.json()),
    ]);
    const alertsList = document.getElementById("alerts-list");
    alertsList.innerHTML = "";
    for (const a of alerts) {
      prependFeedItem("alerts-list",
        `<span class="sev ${a.severity}">●</span> [${escapeHtml(a.rule_name)}] evento #${a.event_id}`);
    }
    document.getElementById("cost-today").textContent =
      `$${(metrics.llm_today?.cost_usd ?? 0).toFixed(4)}`;
    document.getElementById("calls-today").textContent = metrics.llm_today?.calls ?? 0;
    document.getElementById("llm-profile").value = profile.profile;
  } catch (err) {
    console.warn("sidebar:", err);
  }
}

document.getElementById("llm-profile").addEventListener("change", async (e) => {
  await fetch(`${API}/api/v1/llm/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: e.target.value }),
  });
});

/* ---- PWA offline-first (cache básico do shell) ---- */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
