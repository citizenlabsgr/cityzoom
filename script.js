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

  history.pushState(null, "", "?" + params.toString());
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

map1.on("geosearch/showlocation", function (e) {
  map1.setView(e.location, 13);
});

map2.on("geosearch/showlocation", function (e) {
  map2.setView(e.location, 13);
});
