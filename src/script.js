function syncZoom(level) {
  map1.setZoom(level);
  map2.setZoom(level);
}

let applyingHistory = false;

function syncMaps() {
  if (applyingHistory) return;
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

// Randomize location from examples (data.json). Use lat1 to avoid picking the current example.
const locationExamplesPromise = fetch("src/data.json").then((r) => r.json());

function randomizeLocation() {
  locationExamplesPromise.then(function (examples) {
    if (!examples.length) return;
    const p = new URLSearchParams(window.location.search);
    const round5 = (n) => Math.round(Number(n) * 1e5) / 1e5;
    const currentLat1 = p.has("lat1") ? round5(p.get("lat1")) : null;
    const others =
      currentLat1 != null
        ? examples.filter(function (e) {
            return round5(e.lat1) !== currentLat1;
          })
        : examples;
    if (!others.length) return;
    const ex = others[Math.floor(Math.random() * others.length)];
    const params = new URLSearchParams({
      zoom: ex.zoom,
      lat1: ex.lat1,
      lon1: ex.lon1,
      lat2: ex.lat2,
      lon2: ex.lon2,
    });
    const url = window.location.pathname + "?" + params.toString();
    try {
      sessionStorage.setItem("cityzoom_randomize_toast", ex.name);
    } catch (_) {}
    window.location.replace(url);
  });
}

document.getElementById("randomizeButton").addEventListener("click", randomizeLocation);

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

const LOCATION_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

function addLocationButtonToSearch(map) {
  const container = map.getContainer();
  const geosearchEl =
    container.querySelector(".leaflet-control-geosearch") ||
    container.querySelector(".leaflet-geosearch-bar");
  if (!geosearchEl) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "leaflet-control-location-btn";
  btn.title = "Use my location";
  btn.innerHTML = LOCATION_ICON;
  L.DomEvent.disableClickPropagation(btn);
  L.DomEvent.on(btn, "click", function () {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported");
      return;
    }
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        map.setView([pos.coords.latitude, pos.coords.longitude], map.getZoom());
        syncMaps();
        btn.disabled = false;
      },
      function () {
        showToast("Could not get location");
        btn.disabled = false;
      }
    );
  });
  geosearchEl.appendChild(btn);
}

map1.addControl(searchControl1);
map2.addControl(searchControl2);
setTimeout(function () {
  addLocationButtonToSearch(map1);
  addLocationButtonToSearch(map2);
}, 0);

// Close-to-point threshold in pixels to complete the circuit
const CLOSE_POINT_PX = 15;

// Line segment, circle, and trash icons for draw control
const LINE_SEGMENT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="leaflet-draw-line-icon"><circle cx="6" cy="18" r="1.5" fill="currentColor"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
const CIRCLE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="leaflet-draw-circle-icon"><circle cx="12" cy="12" r="9"/></svg>';
const TRASH_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="leaflet-draw-trash-icon"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

const DrawLineControl = L.Control.extend({
  options: { position: "topright" },
  initialize: function (mapId, options) {
    L.Util.setOptions(this, options);
    this._mapId = mapId;
  },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-draw-controls");
    L.DomEvent.disableClickPropagation(container);
    const toolBar = L.DomUtil.create("div", "leaflet-draw-line leaflet-bar", container);
    const drawBtn = L.DomUtil.create("button", "leaflet-draw-line-btn", toolBar);
    drawBtn.type = "button";
    drawBtn.id = this._mapId === 1 ? "drawBox1" : "drawBox2";
    drawBtn.title = "Draw lines";
    drawBtn.innerHTML = LINE_SEGMENT_ICON;
    const circleBtn = L.DomUtil.create("button", "leaflet-draw-line-btn", toolBar);
    circleBtn.type = "button";
    circleBtn.id = this._mapId === 1 ? "circleBox1" : "circleBox2";
    circleBtn.title = "Draw circle";
    circleBtn.innerHTML = CIRCLE_ICON;
    const clearBar = L.DomUtil.create(
      "div",
      "leaflet-draw-clear-bar leaflet-bar",
      container
    );
    const clearBtn = L.DomUtil.create(
      "button",
      "leaflet-draw-clear leaflet-draw-line-btn",
      clearBar
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

// Line and circle drawing (one polyline and one circle per map, encoded in URL fragment)
const LINE_STYLE = { color: "#0088ff", weight: 4 };
const LINE_BORDER_STYLE = { color: "white", weight: 8 };
const POLYGON_FILL_STYLE = { fillColor: "#0088ff", fillOpacity: 0.2 };
const CIRCLE_STYLE = {
  color: "#0088ff",
  weight: 4,
  fillColor: "#0088ff",
  fillOpacity: 0.2,
};
const CIRCLE_BORDER_STYLE = {
  color: "white",
  weight: 8,
  fillColor: "#0088ff",
  fillOpacity: 0.2,
};
let line1 = null;
let line2 = null;
let line1Border = null;
let line2Border = null;
let line1Fill = null;
let line2Fill = null;
let circles1 = [];
let circles2 = [];

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

// Binary format: [magic=1, n1, n2, ...] or [magic=2, ..., 6 circle floats] or [magic=3, segments..., 6 circle floats] or [magic=4, segments..., n_c1, n_c2, circle floats]
const BINARY_MAGIC = 1;
const BINARY_MAGIC_WITH_CIRCLES = 2;
const BINARY_MAGIC_MULTI_SEGMENTS = 3;
const BINARY_MAGIC_MULTI_CIRCLES = 4;
function normalizeCircleData(c) {
  if (!c) return [];
  return Array.isArray(c)
    ? c.filter((x) => x && x.radius > 0)
    : c.radius > 0
      ? [c]
      : [];
}
function encodeDrawingBinary(line1Points, line2Points, circle1Data, circle2Data) {
  const round = (pts) =>
    pts.map((ll) => [roundCoord(ll.lat ?? ll[0]), roundCoord(ll.lng ?? ll[1])]);
  const segs1 = toSegments(line1Points || []);
  const segs2 = toSegments(line2Points || []);
  const roundSeg = (seg) => round(seg);
  const s1 = segs1.map(roundSeg).filter((s) => s.length >= 2);
  const s2 = segs2.map(roundSeg).filter((s) => s.length >= 2);
  const c1Arr = normalizeCircleData(circle1Data);
  const c2Arr = normalizeCircleData(circle2Data);
  const hasCircles = c1Arr.length > 0 || c2Arr.length > 0;
  const useMultiCircle = c1Arr.length > 1 || c2Arr.length > 1;
  if (s1.length === 0 && s2.length === 0 && !hasCircles) return null;
  const circleFloats = useMultiCircle
    ? 2 + 3 * (c1Arr.length + c2Arr.length)
    : hasCircles
      ? 6
      : 0;
  const useMulti = s1.length > 1 || s2.length > 1;
  let fa;
  let i;
  const magic = useMultiCircle
    ? BINARY_MAGIC_MULTI_CIRCLES
    : useMulti
      ? BINARY_MAGIC_MULTI_SEGMENTS
      : hasCircles
        ? BINARY_MAGIC_WITH_CIRCLES
        : BINARY_MAGIC;
  if (useMulti || useMultiCircle) {
    const len =
      1 +
      2 +
      s1.length +
      s2.length +
      s1.reduce((n, seg) => n + seg.length * 2, 0) +
      s2.reduce((n, seg) => n + seg.length * 2, 0) +
      circleFloats;
    fa = new Float32Array(len);
    i = 0;
    fa[i++] = magic;
    fa[i++] = s1.length;
    fa[i++] = s2.length;
    for (const seg of s1) {
      fa[i++] = seg.length;
      for (const [lat, lng] of seg) {
        fa[i++] = lat;
        fa[i++] = lng;
      }
    }
    for (const seg of s2) {
      fa[i++] = seg.length;
      for (const [lat, lng] of seg) {
        fa[i++] = lat;
        fa[i++] = lng;
      }
    }
  } else {
    const p1 = s1.length ? s1[0] : [];
    const p2 = s2.length ? s2[0] : [];
    const n1 = p1.length;
    const n2 = p2.length;
    fa = new Float32Array(1 + 2 + n1 * 2 + n2 * 2 + circleFloats);
    i = 0;
    fa[i++] = magic;
    fa[i++] = n1;
    fa[i++] = n2;
    for (const [lat, lng] of p1) {
      fa[i++] = lat;
      fa[i++] = lng;
    }
    for (const [lat, lng] of p2) {
      fa[i++] = lat;
      fa[i++] = lng;
    }
  }
  if (hasCircles) {
    if (useMultiCircle) {
      fa[i++] = c1Arr.length;
      fa[i++] = c2Arr.length;
      for (const c of c1Arr) {
        fa[i++] = roundCoord(c.center[0]);
        fa[i++] = roundCoord(c.center[1]);
        fa[i++] = c.radius;
      }
      for (const c of c2Arr) {
        fa[i++] = roundCoord(c.center[0]);
        fa[i++] = roundCoord(c.center[1]);
        fa[i++] = c.radius;
      }
    } else {
      fa[i++] = c1Arr[0] ? roundCoord(c1Arr[0].center[0]) : 0;
      fa[i++] = c1Arr[0] ? roundCoord(c1Arr[0].center[1]) : 0;
      fa[i++] = c1Arr[0] ? c1Arr[0].radius : 0;
      fa[i++] = c2Arr[0] ? roundCoord(c2Arr[0].center[0]) : 0;
      fa[i++] = c2Arr[0] ? roundCoord(c2Arr[0].center[1]) : 0;
      fa[i++] = c2Arr[0] ? c2Arr[0].radius : 0;
    }
  }
  return base64urlFromBytes(new Uint8Array(fa.buffer));
}

function decodeDrawingBinary(bytes) {
  if (bytes.length < 16 || bytes.length % 4 !== 0) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = dv.getFloat32(0, true);
  const fa = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >>> 2);
  let line1 = null;
  let line2 = null;
  let circle1 = null;
  let circle2 = null;
  let i = 3;
  if (magic === BINARY_MAGIC_MULTI_SEGMENTS || magic === BINARY_MAGIC_MULTI_CIRCLES) {
    const nSeg1 = Math.min(Math.max(0, fa[1] | 0), 100);
    const nSeg2 = Math.min(Math.max(0, fa[2] | 0), 100);
    const segs1 = [];
    for (let s = 0; s < nSeg1 && i < fa.length; s++) {
      const len = Math.min(Math.max(0, fa[i++] | 0), 5000);
      const seg = [];
      for (let k = 0; k < len && i + 1 < fa.length; k++) {
        seg.push([fa[i], fa[i + 1]]);
        i += 2;
      }
      if (seg.length >= 2) segs1.push(seg);
    }
    const segs2 = [];
    for (let s = 0; s < nSeg2 && i < fa.length; s++) {
      const len = Math.min(Math.max(0, fa[i++] | 0), 5000);
      const seg = [];
      for (let k = 0; k < len && i + 1 < fa.length; k++) {
        seg.push([fa[i], fa[i + 1]]);
        i += 2;
      }
      if (seg.length >= 2) segs2.push(seg);
    }
    line1 = segs1.length ? (segs1.length === 1 ? segs1[0] : segs1) : null;
    line2 = segs2.length ? (segs2.length === 1 ? segs2[0] : segs2) : null;
  } else if (magic === BINARY_MAGIC || magic === BINARY_MAGIC_WITH_CIRCLES) {
    const n1 = Math.min(Math.max(0, fa[1] | 0), 10000);
    const n2 = Math.min(Math.max(0, fa[2] | 0), 10000);
    const l1 = [];
    for (let k = 0; k < n1 && i + 1 < fa.length; k++) {
      l1.push([fa[i], fa[i + 1]]);
      i += 2;
    }
    const l2 = [];
    for (let k = 0; k < n2 && i + 1 < fa.length; k++) {
      l2.push([fa[i], fa[i + 1]]);
      i += 2;
    }
    line1 = l1.length >= 2 ? l1 : null;
    line2 = l2.length >= 2 ? l2 : null;
  } else {
    return null;
  }
  if (magic === BINARY_MAGIC_MULTI_CIRCLES && i + 2 <= fa.length) {
    const nC1 = Math.min(Math.max(0, fa[i++] | 0), 50);
    const nC2 = Math.min(Math.max(0, fa[i++] | 0), 50);
    const circ1 = [];
    for (let k = 0; k < nC1 && i + 2 < fa.length; k++) {
      circ1.push({ center: [fa[i], fa[i + 1]], radius: fa[i + 2] });
      i += 3;
    }
    const circ2 = [];
    for (let k = 0; k < nC2 && i + 2 < fa.length; k++) {
      circ2.push({ center: [fa[i], fa[i + 1]], radius: fa[i + 2] });
      i += 3;
    }
    circle1 = circ1.length ? circ1 : null;
    circle2 = circ2.length ? circ2 : null;
  } else if (
    (magic === BINARY_MAGIC_WITH_CIRCLES || magic === BINARY_MAGIC_MULTI_SEGMENTS) &&
    i + 5 < fa.length
  ) {
    if (fa[i + 2] > 0) circle1 = { center: [fa[i], fa[i + 1]], radius: fa[i + 2] };
    if (fa[i + 5] > 0) circle2 = { center: [fa[i + 3], fa[i + 4]], radius: fa[i + 5] };
  }
  return { line1, line2, circle1, circle2 };
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
  if (!raw) return { line1: null, line2: null, circle1: null, circle2: null };
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
        circle1: data.circle1 && data.circle1.radius > 0 ? data.circle1 : null,
        circle2: data.circle2 && data.circle2.radius > 0 ? data.circle2 : null,
      };
    } catch (_) {}
  }
  const legacy = parseFragmentLegacy(new URLSearchParams(raw));
  if (legacy) return { ...legacy, circle1: null, circle2: null };
  return { line1: null, line2: null, circle1: null, circle2: null };
}

function updateFragment(line1Points, line2Points, circle1Data, circle2Data) {
  dismissCopiedState();
  const encoded = encodeDrawingBinary(
    line1Points,
    line2Points,
    circle1Data ?? null,
    circle2Data ?? null
  );
  const hash = encoded ? "#" + encoded : "";
  history.pushState(null, "", window.location.pathname + window.location.search + hash);
}

function toSegments(data) {
  if (!data || !data.length) return [];
  const first = data[0];
  if (!Array.isArray(first)) return [data];
  const isSingleSegment =
    first.length === 2 && typeof first[0] === "number" && typeof first[1] === "number";
  if (isSingleSegment || (first.length >= 2 && typeof first[0] === "number"))
    return [data];
  return data;
}

function segmentsToLatLngs(segments) {
  return segments.map((seg) =>
    seg.map((p) => (Array.isArray(p) ? L.latLng(p[0], p[1]) : p))
  );
}

function getLinePoints(lineLayer) {
  if (!lineLayer) return null;
  const latlngs = lineLayer.getLatLngs();
  const isMulti = Array.isArray(latlngs[0]) && Array.isArray(latlngs[0][0]);
  if (isMulti) {
    return latlngs.map((seg) =>
      seg.map((ll) => (Array.isArray(ll) ? ll : [ll.lat, ll.lng]))
    );
  }
  const points = latlngs.map((ll) => (Array.isArray(ll) ? ll : [ll.lat, ll.lng]));
  return points.length >= 2 ? [points] : null;
}

function isClosedSegment(seg) {
  if (!seg || seg.length < 3) return false;
  const first = seg[0];
  const last = seg[seg.length - 1];
  const lat0 = Array.isArray(first) ? first[0] : first.lat;
  const lng0 = Array.isArray(first) ? first[1] : first.lng;
  const lat1 = Array.isArray(last) ? last[0] : last.lat;
  const lng1 = Array.isArray(last) ? last[1] : last.lng;
  return lat0 === lat1 && lng0 === lng1;
}

function setLine(map, lineVar, data) {
  const segments = toSegments(data);
  const totalPoints = segments.reduce((n, seg) => n + seg.length, 0);
  if (segments.length === 0 || totalPoints < 2) {
    if (lineVar === "line1") {
      if (line1Fill) map.removeLayer(line1Fill);
      if (line1Border) map.removeLayer(line1Border);
      if (line1) map.removeLayer(line1);
      line1Fill = null;
      line1Border = null;
      line1 = null;
    } else {
      if (line2Fill) map.removeLayer(line2Fill);
      if (line2Border) map.removeLayer(line2Border);
      if (line2) map.removeLayer(line2);
      line2Fill = null;
      line2Border = null;
      line2 = null;
    }
    return;
  }
  if (lineVar === "line1" && line1Fill) {
    map.removeLayer(line1Fill);
    line1Fill = null;
  }
  if (lineVar === "line2" && line2Fill) {
    map.removeLayer(line2Fill);
    line2Fill = null;
  }
  const closedSegments = segments.filter(isClosedSegment);
  if (closedSegments.length) {
    const fillGroup = L.layerGroup();
    for (const seg of closedSegments) {
      const latlngs = seg.map((p) => (Array.isArray(p) ? L.latLng(p[0], p[1]) : p));
      fillGroup.addLayer(
        L.polygon(latlngs, { ...LINE_BORDER_STYLE, ...POLYGON_FILL_STYLE })
      );
      fillGroup.addLayer(L.polygon(latlngs, { ...LINE_STYLE, ...POLYGON_FILL_STYLE }));
    }
    fillGroup.addTo(map);
    if (lineVar === "line1") line1Fill = fillGroup;
    else line2Fill = fillGroup;
  }
  const latlngs =
    segments.length === 1
      ? segmentsToLatLngs(segments)[0]
      : segmentsToLatLngs(segments);
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

function getCirclesData(circlesLayers) {
  if (!circlesLayers || !circlesLayers.length) return [];
  return circlesLayers.map(({ layer }) => {
    const center = layer.getLatLng();
    const radius = layer.getRadius();
    return { center: [center.lat, center.lng], radius };
  });
}

function setCircles(map, circleVar, circlesData) {
  const arr = circleVar === "circle1" ? circles1 : circles2;
  for (const { borderLayer, layer } of arr) {
    map.removeLayer(borderLayer);
    map.removeLayer(layer);
  }
  arr.length = 0;
  if (!circlesData || !circlesData.length) return;
  const list = circleVar === "circle1" ? circles1 : circles2;
  for (const { center, radius } of circlesData) {
    if (!center || radius <= 0) continue;
    const centerLatLng = Array.isArray(center)
      ? L.latLng(center[0], center[1])
      : center;
    const borderLayer = L.circle(centerLatLng, {
      radius,
      ...CIRCLE_BORDER_STYLE,
    }).addTo(map);
    const layer = L.circle(centerLatLng, { radius, ...CIRCLE_STYLE }).addTo(map);
    list.push({ borderLayer, layer });
  }
}

let toastTimeout = null;

function showToast(message, type) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("error");
  if (type === "error") el.classList.add("error");
  el.classList.add("visible");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function () {
    el.classList.remove("visible", "error");
    toastTimeout = null;
  }, 3000);
}

function applyFragmentToMaps() {
  const raw = window.location.hash.slice(1).trim();
  const { line1: pts1, line2: pts2, circle1: circ1, circle2: circ2 } = parseFragment();
  const hasCirc1 = Array.isArray(circ1) ? circ1.length > 0 : !!circ1;
  const hasCirc2 = Array.isArray(circ2) ? circ2.length > 0 : !!circ2;
  if (raw && !pts1 && !pts2 && !hasCirc1 && !hasCirc2) {
    showToast("Invalid map annotations.", "error");
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return;
  }
  if (pts1) setLine(map1, "line1", pts1);
  else if (line1 || line1Border) {
    if (line1Fill) map1.removeLayer(line1Fill);
    if (line1Border) map1.removeLayer(line1Border);
    if (line1) map1.removeLayer(line1);
    line1Fill = null;
    line1Border = null;
    line1 = null;
  }
  if (pts2) setLine(map2, "line2", pts2);
  else if (line2 || line2Border) {
    if (line2Fill) map2.removeLayer(line2Fill);
    if (line2Border) map2.removeLayer(line2Border);
    if (line2) map2.removeLayer(line2);
    line2Fill = null;
    line2Border = null;
    line2 = null;
  }
  const circ1Arr = Array.isArray(circ1) ? circ1 : circ1 ? [circ1] : [];
  const circ2Arr = Array.isArray(circ2) ? circ2 : circ2 ? [circ2] : [];
  setCircles(map1, "circle1", circ1Arr);
  setCircles(map2, "circle2", circ2Arr);
  updateClearButtons();
}

let lastCompletedShapeMapId = null;

let drawState = {
  mapId: null,
  tool: "line",
  points: [],
  previewBorderLayer: null,
  previewLayer: null,
  segmentPreviewBorderLayer: null,
  segmentPreviewLayer: null,
  connectionPreviewBorderLayer: null,
  connectionPreviewLayer: null,
  closeIndicatorLayer: null,
  startedAfterCompletedShape: false,
  circleCenter: null,
  circlePreviewLayer: null,
  circlePreviewBorderLayer: null,
};

function startDraw(mapId, tool) {
  const t = tool || "line";
  const startedAfterCompletedShape = t === "line" && lastCompletedShapeMapId === mapId;
  if (startedAfterCompletedShape) lastCompletedShapeMapId = null;
  drawState = {
    mapId,
    tool: t,
    points: [],
    previewBorderLayer: null,
    previewLayer: null,
    segmentPreviewBorderLayer: null,
    segmentPreviewLayer: null,
    connectionPreviewBorderLayer: null,
    connectionPreviewLayer: null,
    closeIndicatorLayer: null,
    startedAfterCompletedShape,
    circleCenter: null,
    circlePreviewLayer: null,
    circlePreviewBorderLayer: null,
  };
  document
    .getElementById("drawBox1")
    .classList.toggle("active", mapId === 1 && t === "line");
  document
    .getElementById("drawBox2")
    .classList.toggle("active", mapId === 2 && t === "line");
  document
    .getElementById("circleBox1")
    .classList.toggle("active", mapId === 1 && t === "circle");
  document
    .getElementById("circleBox2")
    .classList.toggle("active", mapId === 2 && t === "circle");
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

function removeCirclePreview(map) {
  if (drawState.circlePreviewBorderLayer) {
    map.removeLayer(drawState.circlePreviewBorderLayer);
    drawState.circlePreviewBorderLayer = null;
  }
  if (drawState.circlePreviewLayer) {
    map.removeLayer(drawState.circlePreviewLayer);
    drawState.circlePreviewLayer = null;
  }
}

function cancelDraw() {
  const map = drawState.mapId === 1 ? map1 : map2;
  if (drawState.previewBorderLayer) map.removeLayer(drawState.previewBorderLayer);
  if (drawState.previewLayer) map.removeLayer(drawState.previewLayer);
  removeSegmentPreview(map);
  removeConnectionPreview(map);
  removeCloseIndicator(map);
  if (drawState.mapId) removeCirclePreview(map);
  drawState = {
    mapId: null,
    tool: "line",
    points: [],
    previewBorderLayer: null,
    previewLayer: null,
    segmentPreviewBorderLayer: null,
    segmentPreviewLayer: null,
    connectionPreviewBorderLayer: null,
    connectionPreviewLayer: null,
    closeIndicatorLayer: null,
    startedAfterCompletedShape: false,
    circleCenter: null,
    circlePreviewLayer: null,
    circlePreviewBorderLayer: null,
  };
  document.getElementById("drawBox1").classList.remove("active");
  document.getElementById("drawBox2").classList.remove("active");
  document.getElementById("circleBox1").classList.remove("active");
  document.getElementById("circleBox2").classList.remove("active");
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
  const existingSegments = mapId === 1 ? getLinePoints(line1) : getLinePoints(line2);
  const isClosedShape =
    points.length >= 3 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1];
  const replaceWithNewOnly = drawState.startedAfterCompletedShape && isClosedShape;
  const appendAsNewSegment =
    drawState.startedAfterCompletedShape && !isClosedShape && existingSegments?.length;
  let result;
  if (replaceWithNewOnly || !existingSegments?.length) {
    result = points;
  } else if (appendAsNewSegment) {
    result = [...existingSegments, points];
  } else {
    const flat = existingSegments.flat();
    result = [...flat, ...points];
  }
  const segments = toSegments(result);
  const totalPoints = segments.reduce((n, seg) => n + seg.length, 0);
  if (totalPoints < 2) {
    cancelDraw();
    return;
  }
  if (drawState.previewBorderLayer) map.removeLayer(drawState.previewBorderLayer);
  if (drawState.previewLayer) map.removeLayer(drawState.previewLayer);
  removeSegmentPreview(map);
  removeConnectionPreview(map);
  removeCloseIndicator(map);
  if (mapId === 1) {
    setLine(map1, "line1", result);
    updateFragment(
      getLinePoints(line1),
      getLinePoints(line2),
      getCirclesData(circles1),
      getCirclesData(circles2)
    );
  } else {
    setLine(map2, "line2", result);
    updateFragment(
      getLinePoints(line1),
      getLinePoints(line2),
      getCirclesData(circles1),
      getCirclesData(circles2)
    );
  }
  lastCompletedShapeMapId = mapId;
  exitDrawMode();
}

function finishCircleDraw(mapId, center, radius) {
  const map = mapId === 1 ? map1 : map2;
  removeCirclePreview(map);
  const existing = mapId === 1 ? getCirclesData(circles1) : getCirclesData(circles2);
  const circleVar = mapId === 1 ? "circle1" : "circle2";
  setCircles(map, circleVar, [
    ...existing,
    { center: [center.lat, center.lng], radius },
  ]);
  updateFragment(
    getLinePoints(line1),
    getLinePoints(line2),
    getCirclesData(circles1),
    getCirclesData(circles2)
  );
  exitDrawMode();
}

function exitDrawMode() {
  drawState = {
    mapId: null,
    tool: "line",
    points: [],
    previewBorderLayer: null,
    previewLayer: null,
    segmentPreviewBorderLayer: null,
    segmentPreviewLayer: null,
    connectionPreviewBorderLayer: null,
    connectionPreviewLayer: null,
    closeIndicatorLayer: null,
    startedAfterCompletedShape: false,
    circleCenter: null,
    circlePreviewLayer: null,
    circlePreviewBorderLayer: null,
  };
  document.getElementById("drawBox1").classList.remove("active");
  document.getElementById("drawBox2").classList.remove("active");
  document.getElementById("circleBox1").classList.remove("active");
  document.getElementById("circleBox2").classList.remove("active");
  document.getElementById("wrapper1").classList.remove("draw-mode");
  document.getElementById("wrapper2").classList.remove("draw-mode");
  updateClearButtons();
}

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" || !drawState.mapId) return;
  if (drawState.tool === "circle") {
    cancelDraw();
    return;
  }
  finishDraw(drawState.mapId);
});

document.getElementById("drawBox1").addEventListener("click", function () {
  if (drawState.mapId === 1) {
    if (drawState.tool === "line") finishDraw(1);
    else startDraw(1, "line");
  } else startDraw(1, "line");
});
document.getElementById("drawBox2").addEventListener("click", function () {
  if (drawState.mapId === 2) {
    if (drawState.tool === "line") finishDraw(2);
    else startDraw(2, "line");
  } else startDraw(2, "line");
});
document.getElementById("circleBox1").addEventListener("click", function () {
  if (drawState.mapId === 1) {
    if (drawState.tool === "circle") cancelDraw();
    else startDraw(1, "circle");
  } else startDraw(1, "circle");
});
document.getElementById("circleBox2").addEventListener("click", function () {
  if (drawState.mapId === 2) {
    if (drawState.tool === "circle") cancelDraw();
    else startDraw(2, "circle");
  } else startDraw(2, "circle");
});

function onMapMouseMove(e, mapId) {
  if (drawState.mapId !== mapId) return;
  const map = mapId === 1 ? map1 : map2;
  if (drawState.tool === "circle" && drawState.circleCenter) {
    const radius = drawState.circleCenter.distanceTo(e.latlng);
    if (drawState.circlePreviewLayer) {
      drawState.circlePreviewBorderLayer.setRadius(radius);
      drawState.circlePreviewLayer.setRadius(radius);
    } else {
      drawState.circlePreviewBorderLayer = L.circle(drawState.circleCenter, {
        radius,
        ...CIRCLE_BORDER_STYLE,
        dashArray: "5,5",
        className: "leaflet-draw-animated-dash",
      }).addTo(map);
      drawState.circlePreviewLayer = L.circle(drawState.circleCenter, {
        radius,
        ...CIRCLE_STYLE,
        dashArray: "5,5",
        className: "leaflet-draw-animated-dash",
      }).addTo(map);
    }
    return;
  }
  const existingSegments = mapId === 1 ? getLinePoints(line1) : getLinePoints(line2);
  const lastSegment =
    existingSegments?.length &&
    Array.isArray(existingSegments[existingSegments.length - 1]) &&
    existingSegments[existingSegments.length - 1].length >= 2
      ? existingSegments[existingSegments.length - 1]
      : existingSegments;
  const hasExisting =
    drawState.tool === "line" &&
    lastSegment &&
    lastSegment.length >= 2 &&
    !drawState.startedAfterCompletedShape;
  if (hasExisting) {
    const connectionFrom = lastSegment[lastSegment.length - 1];
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
  removeCirclePreview(map);
}

const MIN_CIRCLE_RADIUS_M = 20;

function onMapClick(e, mapId) {
  if (drawState.mapId !== mapId) return;
  e.originalEvent.preventDefault();
  const map = mapId === 1 ? map1 : map2;
  if (drawState.tool === "circle") {
    if (!drawState.circleCenter) {
      drawState.circleCenter = e.latlng;
      return;
    }
    const radius = Math.max(
      MIN_CIRCLE_RADIUS_M,
      drawState.circleCenter.distanceTo(e.latlng)
    );
    finishCircleDraw(mapId, drawState.circleCenter, radius);
    return;
  }
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
  document.getElementById("clearBox1").style.display =
    line1 || circles1.length ? "block" : "none";
  document.getElementById("clearBox2").style.display =
    line2 || circles2.length ? "block" : "none";
}

document.getElementById("clearBox1").addEventListener("click", function () {
  cancelDraw();
  let changed = false;
  if (line1 || line1Border) {
    if (line1Fill) map1.removeLayer(line1Fill);
    if (line1Border) map1.removeLayer(line1Border);
    if (line1) map1.removeLayer(line1);
    line1Fill = null;
    line1Border = null;
    line1 = null;
    changed = true;
  }
  if (circles1.length) {
    setCircles(map1, "circle1", []);
    changed = true;
  }
  if (changed) {
    updateFragment(null, getLinePoints(line2), null, getCirclesData(circles2));
    updateClearButtons();
  }
});
document.getElementById("clearBox2").addEventListener("click", function () {
  cancelDraw();
  let changed = false;
  if (line2 || line2Border) {
    if (line2Fill) map2.removeLayer(line2Fill);
    if (line2Border) map2.removeLayer(line2Border);
    if (line2) map2.removeLayer(line2);
    line2Fill = null;
    line2Border = null;
    line2 = null;
    changed = true;
  }
  if (circles2.length) {
    setCircles(map2, "circle2", []);
    changed = true;
  }
  if (changed) {
    updateFragment(getLinePoints(line1), null, getCirclesData(circles1), null);
    updateClearButtons();
  }
});

applyFragmentToMaps();
updateClearButtons();
try {
  const toastName = sessionStorage.getItem("cityzoom_randomize_toast");
  if (toastName) {
    sessionStorage.removeItem("cityzoom_randomize_toast");
    setTimeout(function () {
      showToast(toastName);
    }, 0);
  }
} catch (_) {}
function applyUrlToMaps() {
  const p = new URLSearchParams(window.location.search);
  if (
    p.has("zoom") &&
    p.has("lat1") &&
    p.has("lon1") &&
    p.has("lat2") &&
    p.has("lon2")
  ) {
    applyingHistory = true;
    const zoom = parseInt(p.get("zoom"), 10);
    const lat1 = parseFloat(p.get("lat1"));
    const lon1 = parseFloat(p.get("lon1"));
    const lat2 = parseFloat(p.get("lat2"));
    const lon2 = parseFloat(p.get("lon2"));
    map1.setView([lat1, lon1], zoom);
    map2.setView([lat2, lon2], zoom);
    applyingHistory = false;
  }
  applyFragmentToMaps();
  updateClearButtons();
  dismissCopiedState();
}

window.addEventListener("popstate", applyUrlToMaps);
window.addEventListener("hashchange", function () {
  applyFragmentToMaps();
  updateClearButtons();
  dismissCopiedState();
});
