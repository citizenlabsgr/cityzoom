function syncZoom(level) {
  map1.setZoom(level);
  map2.setZoom(level);
}

function syncMaps() {
  const center1 = map1.getCenter();
  const center2 = map2.getCenter();
  const zoom = map1.getZoom();

  const params = new URLSearchParams({
    zoom: zoom,
    lat1: center1.lat.toFixed(5),
    lon1: center1.lng.toFixed(5),
    lat2: center2.lat.toFixed(5),
    lon2: center2.lng.toFixed(5),
  });

  const hash = window.location.hash || "";
  history.pushState(null, "", "?" + params.toString() + hash);
  dismissCopiedState();
}

function copyUrl() {
  const url = window.location.href;
  navigator.clipboard
    .writeText(url)
    .then(function () {
      const button = document.getElementById("copyButton");
      button.textContent = "Copied!";
      button.classList.add("copied");
      if (copyTimeout) {
        clearTimeout(copyTimeout);
      }
      copyTimeout = setTimeout(function () {
        dismissCopiedState();
      }, 10000);
    })
    .catch(function (err) {
      console.error("Failed to copy URL:", err);
      alert("Failed to copy URL. Please copy manually: " + url);
    });
}

function dismissCopiedState() {
  const button = document.getElementById("copyButton");
  if (button.classList.contains("copied")) {
    button.textContent = originalButtonText;
    button.classList.remove("copied");
    if (copyTimeout) {
      clearTimeout(copyTimeout);
      copyTimeout = null;
    }
  }
}

// Get initial center coordinates and zoom levels

const urlParams = new URLSearchParams(window.location.search);

const initialCenter1 =
  urlParams.has("lat1") && urlParams.has("lon1")
    ? [parseFloat(urlParams.get("lat1")), parseFloat(urlParams.get("lon1"))]
    : [42.9634, -85.6681]; // Grand Rapids, MI

const initialCenter2 =
  urlParams.has("lat2") && urlParams.has("lon2")
    ? [parseFloat(urlParams.get("lat2")), parseFloat(urlParams.get("lon2"))]
    : [42.3314, -83.0458]; // Detroit, MI

const initialZoom = urlParams.has("zoom") ? parseInt(urlParams.get("zoom")) : 13;

// Initialize the maps

var map1 = L.map("map1").setView(initialCenter1, initialZoom);
var map2 = L.map("map2").setView(initialCenter2, initialZoom);

L.control.scale().addTo(map1);
L.control.scale().addTo(map2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map1);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map2);

// Initialize the copy button

let copyTimeout = null;
const originalButtonText = "Copy URL";

// Enable search

const { GeoSearchControl, OpenStreetMapProvider } = window.GeoSearch;
const provider = new OpenStreetMapProvider();

const searchControl1 = new GeoSearchControl({
  provider: provider,
  style: "bar",
  searchLabel: "Search for a location",
});

const searchControl2 = new GeoSearchControl({
  provider: provider,
  style: "bar",
  searchLabel: "Search for a location",
});

map1.addControl(searchControl1);
map2.addControl(searchControl2);

// Close-to-point threshold in pixels to complete the circuit
const CLOSE_POINT_PX = 15;

// Line segment and trash icons for draw control
const LINE_SEGMENT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="leaflet-draw-line-icon"><circle cx="6" cy="18" r="1.5" fill="currentColor"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
const TRASH_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="leaflet-draw-trash-icon"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

const DrawLineControl = L.Control.extend({
  options: { position: "topright" },
  initialize: function (mapId, options) {
    L.Util.setOptions(this, options);
    this._mapId = mapId;
  },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-draw-line leaflet-bar");
    L.DomEvent.disableClickPropagation(container);
    const drawBtn = L.DomUtil.create("button", "leaflet-draw-line-btn", container);
    drawBtn.type = "button";
    drawBtn.id = this._mapId === 1 ? "drawBox1" : "drawBox2";
    drawBtn.title = "Annotate map";
    drawBtn.innerHTML = LINE_SEGMENT_ICON;
    const clearBtn = L.DomUtil.create(
      "button",
      "leaflet-draw-clear leaflet-draw-line-btn",
      container
    );
    clearBtn.type = "button";
    clearBtn.id = this._mapId === 1 ? "clearBox1" : "clearBox2";
    clearBtn.title = "Clear annotations";
    clearBtn.innerHTML = TRASH_ICON;
    clearBtn.style.display = "none";
    return container;
  },
});
map1.addControl(new DrawLineControl(1));
map2.addControl(new DrawLineControl(2));

// Add event handlers

let isZooming = false;

map1.on("zoomend", function () {
  if (!isZooming) {
    isZooming = true;
    syncZoom(map1.getZoom());
    syncMaps();
    setTimeout(() => {
      isZooming = false;
    }, 100);
  }
});

map2.on("zoomend", function () {
  if (!isZooming) {
    isZooming = true;
    syncZoom(map2.getZoom());
    syncMaps();
    setTimeout(() => {
      isZooming = false;
    }, 100);
  }
});

map1.on("moveend", syncMaps);
map2.on("moveend", syncMaps);

function locationToLatLng(loc) {
  if (!loc) return null;
  const lat = typeof loc.lat === "number" ? loc.lat : loc.y;
  const lng = typeof loc.lng === "number" ? loc.lng : loc.x;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return L.latLng(lat, lng);
}

map1.on("geosearch/showlocation", function (e) {
  const center = locationToLatLng(e.location);
  if (center) map1.setView(center, 13);
});

map2.on("geosearch/showlocation", function (e) {
  const center = locationToLatLng(e.location);
  if (center) map2.setView(center, 13);
});

// Line drawing (one polyline per map, encoded in URL fragment)
const LINE_STYLE = { color: "#0088ff", weight: 4 };
const LINE_BORDER_STYLE = { color: "white", weight: 8 };
let line1 = null;
let line2 = null;
let line1Border = null;
let line2Border = null;

// Drawing precision: 4 decimals (~11 m), keeps URLs small
const COORD_PRECISION = 4;
function roundCoord(x) {
  return Math.round(Number(x) * 1e4) / 1e4;
}

// Base64url for fragment (URL-safe)
function base64urlFromBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) base64 += "==".slice(0, 4 - pad);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// Binary format: [magic=1, n1, n2, ...lat,lng for line1..., ...lat,lng for line2...] as Float32
const BINARY_MAGIC = 1;
function encodeDrawingBinary(line1Points, line2Points) {
  const round = (pts) =>
    pts.map((ll) => [roundCoord(ll.lat ?? ll[0]), roundCoord(ll.lng ?? ll[1])]);
  const p1 = line1Points && line1Points.length >= 2 ? round(line1Points) : [];
  const p2 = line2Points && line2Points.length >= 2 ? round(line2Points) : [];
  const n1 = p1.length;
  const n2 = p2.length;
  if (n1 === 0 && n2 === 0) return null;
  const len = 1 + 2 + n1 * 2 + n2 * 2; // magic + n1,n2 + coords
  const fa = new Float32Array(len);
  fa[0] = BINARY_MAGIC;
  fa[1] = n1;
  fa[2] = n2;
  let i = 3;
  for (const [lat, lng] of p1) {
    fa[i++] = lat;
    fa[i++] = lng;
  }
  for (const [lat, lng] of p2) {
    fa[i++] = lat;
    fa[i++] = lng;
  }
  return base64urlFromBytes(new Uint8Array(fa.buffer));
}

function decodeDrawingBinary(bytes) {
  if (bytes.length < 16 || bytes.length % 4 !== 0) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getFloat32(0, true) !== BINARY_MAGIC) return null;
  const fa = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >>> 2);
  const n1 = Math.min(Math.max(0, fa[1] | 0), 10000);
  const n2 = Math.min(Math.max(0, fa[2] | 0), 10000);
  const line1 = [];
  let i = 3;
  for (let k = 0; k < n1 && i + 1 < fa.length; k++) {
    line1.push([fa[i], fa[i + 1]]);
    i += 2;
  }
  const line2 = [];
  for (let k = 0; k < n2 && i + 1 < fa.length; k++) {
    line2.push([fa[i], fa[i + 1]]);
    i += 2;
  }
  return {
    line1: line1.length >= 2 ? line1 : null,
    line2: line2.length >= 2 ? line2 : null,
  };
}

function pointsFromFragment(payload) {
  if (!payload || !Array.isArray(payload)) return null;
  const latlngs = payload
    .map((p) => {
      const lat = p?.lat != null ? p.lat : p?.[0];
      const lng = p?.lng != null ? p.lng : p?.[1];
      return lat != null && lng != null ? [Number(lat), Number(lng)] : null;
    })
    .filter(Boolean);
  return latlngs.length >= 2 ? latlngs : null;
}

function fragmentFromPoints(latlngs) {
  return latlngs.map((ll) => {
    const lat = ll.lat != null ? ll.lat : ll[0];
    const lng = ll.lng != null ? ll.lng : ll[1];
    return [roundCoord(lat), roundCoord(lng)];
  });
}

function parseFragmentLegacy(params) {
  const v1 = params.get("1");
  const v2 = params.get("2");
  if (!v1 && !v2) return null;
  const parseCSV = (value) => {
    if (!value) return null;
    const parts = value.split(",").map(Number);
    if (parts.length < 4 || parts.length % 2 !== 0 || parts.some(isNaN)) return null;
    const latlngs = [];
    for (let i = 0; i < parts.length; i += 2) latlngs.push([parts[i], parts[i + 1]]);
    return latlngs.length >= 2 ? latlngs : null;
  };
  return { line1: parseCSV(v1), line2: parseCSV(v2) };
}

function parseFragment() {
  const raw = window.location.hash.slice(1).trim();
  if (!raw) return { line1: null, line2: null };
  const bytes = base64urlToBytes(raw);
  if (bytes && bytes.length >= 4) {
    const binary = decodeDrawingBinary(bytes);
    if (binary) return binary;
  }
  if (bytes) {
    try {
      const json = new TextDecoder().decode(bytes);
      const data = JSON.parse(json);
      return {
        line1: pointsFromFragment(data[1] ?? data.line1),
        line2: pointsFromFragment(data[2] ?? data.line2),
      };
    } catch (_) {}
  }
  const legacy = parseFragmentLegacy(new URLSearchParams(raw));
  if (legacy) return legacy;
  return { line1: null, line2: null };
}

function updateFragment(line1Points, line2Points) {
  const encoded = encodeDrawingBinary(line1Points, line2Points);
  const hash = encoded ? "#" + encoded : "";
  window.location.replace(window.location.pathname + window.location.search + hash);
}

function getLinePoints(lineLayer) {
  if (!lineLayer) return null;
  const latlngs = lineLayer.getLatLngs();
  return Array.isArray(latlngs[0]) ? latlngs : latlngs.map((ll) => [ll.lat, ll.lng]);
}

function setLine(map, lineVar, latlngs) {
  if (!latlngs || latlngs.length < 2) {
    if (lineVar === "line1") {
      if (line1Border) map.removeLayer(line1Border);
      if (line1) map.removeLayer(line1);
      line1Border = null;
      line1 = null;
    } else {
      if (line2Border) map.removeLayer(line2Border);
      if (line2) map.removeLayer(line2);
      line2Border = null;
      line2 = null;
    }
    return;
  }
  const borderLayer = L.polyline(latlngs, { ...LINE_BORDER_STYLE }).addTo(map);
  const layer = L.polyline(latlngs, { ...LINE_STYLE }).addTo(map);
  if (lineVar === "line1") {
    if (line1Border) map.removeLayer(line1Border);
    if (line1) map.removeLayer(line1);
    line1Border = borderLayer;
    line1 = layer;
  } else {
    if (line2Border) map.removeLayer(line2Border);
    if (line2) map.removeLayer(line2);
    line2Border = borderLayer;
    line2 = layer;
  }
}

function applyFragmentToMaps() {
  const { line1: pts1, line2: pts2 } = parseFragment();
  if (pts1) setLine(map1, "line1", pts1);
  else if (line1 || line1Border) {
    if (line1Border) map1.removeLayer(line1Border);
    if (line1) map1.removeLayer(line1);
    line1Border = null;
    line1 = null;
  }
  if (pts2) setLine(map2, "line2", pts2);
  else if (line2 || line2Border) {
    if (line2Border) map2.removeLayer(line2Border);
    if (line2) map2.removeLayer(line2);
    line2Border = null;
    line2 = null;
  }
  updateClearButtons();
}

let drawState = {
  mapId: null,
  points: [],
  previewBorderLayer: null,
  previewLayer: null,
  segmentPreviewBorderLayer: null,
  segmentPreviewLayer: null,
  connectionPreviewBorderLayer: null,
  connectionPreviewLayer: null,
  closeIndicatorLayer: null,
};

function startDraw(mapId) {
  drawState = {
    mapId,
    points: [],
    previewBorderLayer: null,
    previewLayer: null,
    segmentPreviewBorderLayer: null,
    segmentPreviewLayer: null,
    connectionPreviewBorderLayer: null,
    connectionPreviewLayer: null,
    closeIndicatorLayer: null,
  };
  document.getElementById("drawBox1").classList.toggle("active", mapId === 1);
  document.getElementById("drawBox2").classList.toggle("active", mapId === 2);
  document.getElementById("wrapper1").classList.toggle("draw-mode", mapId === 1);
  document.getElementById("wrapper2").classList.toggle("draw-mode", mapId === 2);
}

function removeSegmentPreview(map) {
  if (drawState.segmentPreviewBorderLayer) {
    map.removeLayer(drawState.segmentPreviewBorderLayer);
    drawState.segmentPreviewBorderLayer = null;
  }
  if (drawState.segmentPreviewLayer) {
    map.removeLayer(drawState.segmentPreviewLayer);
    drawState.segmentPreviewLayer = null;
  }
}

function removeConnectionPreview(map) {
  if (drawState.connectionPreviewBorderLayer) {
    map.removeLayer(drawState.connectionPreviewBorderLayer);
    drawState.connectionPreviewBorderLayer = null;
  }
  if (drawState.connectionPreviewLayer) {
    map.removeLayer(drawState.connectionPreviewLayer);
    drawState.connectionPreviewLayer = null;
  }
}

function removeCloseIndicator(map) {
  if (drawState.closeIndicatorLayer) {
    map.removeLayer(drawState.closeIndicatorLayer);
    drawState.closeIndicatorLayer = null;
  }
  document.getElementById("wrapper1").classList.remove("within-close-range");
  document.getElementById("wrapper2").classList.remove("within-close-range");
}

function cancelDraw() {
  const map = drawState.mapId === 1 ? map1 : map2;
  if (drawState.previewBorderLayer) map.removeLayer(drawState.previewBorderLayer);
  if (drawState.previewLayer) map.removeLayer(drawState.previewLayer);
  removeSegmentPreview(map);
  removeConnectionPreview(map);
  removeCloseIndicator(map);
  drawState = {
    mapId: null,
    points: [],
    previewBorderLayer: null,
    previewLayer: null,
    segmentPreviewBorderLayer: null,
    segmentPreviewLayer: null,
    connectionPreviewBorderLayer: null,
    connectionPreviewLayer: null,
    closeIndicatorLayer: null,
  };
  document.getElementById("drawBox1").classList.remove("active");
  document.getElementById("drawBox2").classList.remove("active");
  document.getElementById("wrapper1").classList.remove("draw-mode");
  document.getElementById("wrapper2").classList.remove("draw-mode");
}

function updatePreview(map, points) {
  if (drawState.previewBorderLayer) map.removeLayer(drawState.previewBorderLayer);
  if (drawState.previewLayer) map.removeLayer(drawState.previewLayer);
  if (points.length < 2) return;
  drawState.previewBorderLayer = L.polyline(points, {
    ...LINE_BORDER_STYLE,
  }).addTo(map);
  drawState.previewLayer = L.polyline(points, {
    ...LINE_STYLE,
  }).addTo(map);
}

function finishDraw(mapId) {
  const map = mapId === 1 ? map1 : map2;
  const points = drawState.points.map((ll) => [ll.lat, ll.lng]);
  const existing = mapId === 1 ? getLinePoints(line1) : getLinePoints(line2);
  const combined = existing && existing.length >= 2 ? [...existing, ...points] : points;
  if (combined.length < 2) {
    cancelDraw();
    return;
  }
  if (drawState.previewBorderLayer) map.removeLayer(drawState.previewBorderLayer);
  if (drawState.previewLayer) map.removeLayer(drawState.previewLayer);
  removeSegmentPreview(map);
  removeConnectionPreview(map);
  removeCloseIndicator(map);
  if (mapId === 1) {
    setLine(map1, "line1", combined);
    updateFragment(combined, getLinePoints(line2));
  } else {
    setLine(map2, "line2", combined);
    updateFragment(getLinePoints(line1), combined);
  }
  drawState = {
    mapId: null,
    points: [],
    previewBorderLayer: null,
    previewLayer: null,
    segmentPreviewBorderLayer: null,
    segmentPreviewLayer: null,
    connectionPreviewBorderLayer: null,
    connectionPreviewLayer: null,
    closeIndicatorLayer: null,
  };
  document.getElementById("drawBox1").classList.remove("active");
  document.getElementById("drawBox2").classList.remove("active");
  document.getElementById("wrapper1").classList.remove("draw-mode");
  document.getElementById("wrapper2").classList.remove("draw-mode");
  updateClearButtons();
}

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" || !drawState.mapId) return;
  finishDraw(drawState.mapId);
});

document.getElementById("drawBox1").addEventListener("click", function () {
  if (drawState.mapId === 1) finishDraw(1);
  else startDraw(1);
});
document.getElementById("drawBox2").addEventListener("click", function () {
  if (drawState.mapId === 2) finishDraw(2);
  else startDraw(2);
});

function onMapMouseMove(e, mapId) {
  if (drawState.mapId !== mapId) return;
  const map = mapId === 1 ? map1 : map2;
  const existingPoints = mapId === 1 ? getLinePoints(line1) : getLinePoints(line2);
  const hasExisting = existingPoints && existingPoints.length >= 2;
  if (hasExisting) {
    const connectionFrom = existingPoints[existingPoints.length - 1];
    const connectionTo = drawState.points.length === 0 ? e.latlng : drawState.points[0];
    const connectionLatlngs = [
      Array.isArray(connectionFrom)
        ? L.latLng(connectionFrom[0], connectionFrom[1])
        : connectionFrom,
      connectionTo,
    ];
    if (drawState.connectionPreviewLayer) {
      drawState.connectionPreviewBorderLayer.setLatLngs(connectionLatlngs);
      drawState.connectionPreviewLayer.setLatLngs(connectionLatlngs);
    } else {
      drawState.connectionPreviewBorderLayer = L.polyline(connectionLatlngs, {
        ...LINE_BORDER_STYLE,
        dashArray: "5,5",
        className: "leaflet-draw-animated-dash",
      }).addTo(map);
      drawState.connectionPreviewLayer = L.polyline(connectionLatlngs, {
        ...LINE_STYLE,
        dashArray: "5,5",
        className: "leaflet-draw-animated-dash",
      }).addTo(map);
    }
  } else {
    removeConnectionPreview(map);
  }
  if (drawState.points.length >= 2) {
    const first = drawState.points[0];
    const p0 = map.latLngToContainerPoint(first);
    const p1 = map.latLngToContainerPoint(e.latlng);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const inCloseRange = dx * dx + dy * dy <= CLOSE_POINT_PX * CLOSE_POINT_PX;
    if (inCloseRange) {
      const wrapper = mapId === 1 ? "wrapper1" : "wrapper2";
      document.getElementById(wrapper).classList.add("within-close-range");
      if (!drawState.closeIndicatorLayer) {
        drawState.closeIndicatorLayer = L.circleMarker(first, {
          radius: CLOSE_POINT_PX,
          color: "#0088ff",
          fillColor: "#0088ff",
          fillOpacity: 0.25,
          weight: 2,
          className: "leaflet-draw-close-indicator",
        }).addTo(map);
      }
    } else {
      removeCloseIndicator(map);
    }
  } else {
    removeCloseIndicator(map);
  }
  if (drawState.points.length < 1) {
    removeSegmentPreview(map);
    return;
  }
  const last = drawState.points[drawState.points.length - 1];
  const latlngs = [last, e.latlng];
  if (drawState.segmentPreviewLayer) {
    drawState.segmentPreviewBorderLayer.setLatLngs(latlngs);
    drawState.segmentPreviewLayer.setLatLngs(latlngs);
  } else {
    drawState.segmentPreviewBorderLayer = L.polyline(latlngs, {
      ...LINE_BORDER_STYLE,
      dashArray: "5,5",
      className: "leaflet-draw-animated-dash",
    }).addTo(map);
    drawState.segmentPreviewLayer = L.polyline(latlngs, {
      ...LINE_STYLE,
      dashArray: "5,5",
      className: "leaflet-draw-animated-dash",
    }).addTo(map);
  }
}

function onMapMouseOut(e, mapId) {
  if (drawState.mapId !== mapId) return;
  const map = mapId === 1 ? map1 : map2;
  removeSegmentPreview(map);
  removeConnectionPreview(map);
  removeCloseIndicator(map);
}

function onMapClick(e, mapId) {
  if (drawState.mapId !== mapId) return;
  e.originalEvent.preventDefault();
  const map = mapId === 1 ? map1 : map2;
  if (drawState.points.length >= 2) {
    const first = drawState.points[0];
    const p0 = map.latLngToContainerPoint(first);
    const p1 = map.latLngToContainerPoint(e.latlng);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    if (dx * dx + dy * dy <= CLOSE_POINT_PX * CLOSE_POINT_PX) {
      drawState.points.push(L.latLng(first.lat, first.lng));
      finishDraw(mapId);
      return;
    }
  }
  drawState.points.push(e.latlng);
  updatePreview(map, drawState.points);
}

function onMapDblClick(e, mapId) {
  if (drawState.mapId !== mapId) return;
  L.DomEvent.stopPropagation(e);
  L.DomEvent.preventDefault(e);
  finishDraw(mapId);
}

map1.on("click", (e) => onMapClick(e, 1));
map2.on("click", (e) => onMapClick(e, 2));
map1.on("mousemove", (e) => onMapMouseMove(e, 1));
map2.on("mousemove", (e) => onMapMouseMove(e, 2));
map1.on("mouseout", (e) => onMapMouseOut(e, 1));
map2.on("mouseout", (e) => onMapMouseOut(e, 2));
map1.on("dblclick", (e) => onMapDblClick(e, 1));
map2.on("dblclick", (e) => onMapDblClick(e, 2));

function updateClearButtons() {
  document.getElementById("clearBox1").style.display = line1 ? "block" : "none";
  document.getElementById("clearBox2").style.display = line2 ? "block" : "none";
}

document.getElementById("clearBox1").addEventListener("click", function () {
  cancelDraw();
  if (line1 || line1Border) {
    if (line1Border) map1.removeLayer(line1Border);
    if (line1) map1.removeLayer(line1);
    line1Border = null;
    line1 = null;
    updateFragment(null, getLinePoints(line2));
    updateClearButtons();
  }
});
document.getElementById("clearBox2").addEventListener("click", function () {
  cancelDraw();
  if (line2 || line2Border) {
    if (line2Border) map2.removeLayer(line2Border);
    if (line2) map2.removeLayer(line2);
    line2Border = null;
    line2 = null;
    updateFragment(getLinePoints(line1), null);
    updateClearButtons();
  }
});

applyFragmentToMaps();
updateClearButtons();
window.addEventListener("hashchange", function () {
  applyFragmentToMaps();
  updateClearButtons();
  dismissCopiedState();
});
