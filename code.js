/////////////////////////////
//      GLOBAL VARS        //
/////////////////////////////

// You can provide a main and alternate URL, e.g. one for use from the public internet
// and one for use when you are on the same LAN as the machine running the servers.
// Select the alternate URL by appending ?alt=true to the URL for Plane Sailing.
// Normal users won't do this and will therefore use the main public URL, but you
// can bookmark the "alt" version to always use your LAN address for testing.
const SERVER_URL = ((window.location.protocol == "https:") ? "https:" : "http:") + "//mciserver.zapto.org/";
const SERVER_URL_ALT = "http://127.0.0.1:81/";

// Map layer URL - if re-using this code you will need to provide your own Mapbox
// access token in the Mapbox URL. You can still use my styles.
//const MAPBOX_URL_DARK = ((window.location.protocol == "https:") ? "https:" : "http:") + "//api.mapbox.com/styles/v1/ianrenton/ck6weg73u0mvo1ipl5lygf05t/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiaWFucmVudG9uIiwiYSI6ImNrcTl3bHJrcDAydGsyb2sxb3h2cHE4bGgifQ.UzgaBetIhhTUGBOtLSlYDg";
//const MAPBOX_URL_LIGHT = ((window.location.protocol == "https:") ? "https:" : "http:") + "//api.mapbox.com/styles/v1/ianrenton/ckchhz5ks23or1ipf1le41g56/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiaWFucmVudG9uIiwiYSI6ImNrcTl3bHJrcDAydGsyb2sxb3h2cHE4bGgifQ.UzgaBetIhhTUGBOtLSlYDg";
// TODO put Mapbox URLs back for release
const MAPBOX_URL_DARK = ((window.location.protocol == "https:") ? "https:" : "http:") + "//tile.stamen.com/terrain-background/{z}/{x}/{y}.jpg";
const MAPBOX_URL_LIGHT = ((window.location.protocol == "https:") ? "https:" : "http:") + "//tile.stamen.com/terrain-background/{z}/{x}/{y}.jpg";

// Map default position/zoom
const START_LAT_LON = [50.68, -1.9];
const START_ZOOM = 12;

// More globals - you should not have to edit beyond this point unless you want
// to change how the software works!
const KNOTS_TO_MPS = 0.514444;

var tracks = new Map(); // uid -> Track
var markers = new Map(); // uid -> Marker
var darkTheme = true;
var zoomLevelForLandAirSymbolNames = 9; // If zoomed in at least this far, show all land & air symbol names. Decrease this to show names at lower zooms.
var zoomLevelForShipSymbolNames = 12; // If zoomed in at least this far, show all ship symbol names. Decrease this to show names at lower zooms.
var clockOffset = 0; // Local PC time (UTC) minus data time. Used to prevent dead reckoning errors if the local PC clock is off or in a different time zone
var selectedTrackID = "";
var enableDeadReckoning = true;
var updateMapIntervalMS = 1000;
var queryServerIntervalMS = 10000;


/////////////////////////////
//   API CALL FUNCTIONS    //
/////////////////////////////

// "First" API call - called once on page load, this retrieves all data from
// the server including base station/airports/seaports and full position
// history
function fetchDataFirst() {
  $.ajax({
    url: serverURL + "first",
    dataType: 'json',
    timeout: 10000,
    success: async function(result) {
      $("#serverOffline").css("display", "none");
      handleDataFirst(result);
    },
    error: function() {
      $("#serverOffline").css("display", "inline-block");
    },
    complete: function() {
      $("#loading").css("display", "none");
    }
  });
}

// "Update" API call - called at regular intervals, this retrieves new data from
// the server.
function fetchDataUpdate() {
  $.ajax({
    url: serverURL + "update",
    dataType: 'json',
    timeout: 5000,
    success: async function(result) {
      $("#serverOffline").css("display", "none");
      handleDataUpdate(result);
    },
    error: function() {
      $("#serverOffline").css("display", "inline-block");
    },
    complete: function() {
      $("#loading").css("display", "none");
    }
  });
}



/////////////////////////////
// DATA HANDLING FUNCTIONS //
/////////////////////////////

// Handle successful receive of first-time data. All we need to do is
// dump the data into out "tracks" map, since it will be empty at
// this point, and update the clock offset.
async function handleDataFirst(result) {
  clockOffset = moment().diff(moment(result.time).utc(), 'seconds');
  tracks = objectToMap(result.tracks);
}

// Handle successful receive of update data. This is a bit more complex
// because we have three cases to handle:
// 1) Updated tracks - update the data in our map and append position
//    history
// 2) New tracks - just add the data to our map
// 3) Missing tracks - delete from our tracks list, unless they are
//    config-created base station/airport/seaport.
async function handleDataUpdate(result) {
  clockOffset = moment().diff(moment(result.time).utc(), 'seconds');
  trackUpdate = objectToMap(result.tracks);

  trackUpdate.forEach((newTrack, id) => {
    if (tracks.has(id)) {
      var oldTrack = tracks.get(id);
      // This is an updated track that we already knew about.
      // Copy in the new values
      Object.keys(newTrack).forEach((attrKey) => {
        oldTrack[attrKey] = newTrack[attrKey];
      });
      // Then add a new value to the position history if the track has moved,
      // or if we don't know its old position.
      if (!newTrack["fixed"]) {
        if (oldTrack["poshistory"].length > 0) {
          var oldPos = oldTrack["poshistory"][oldTrack["poshistory"].length - 1];
          if (oldPos["lat"] != newTrack["lat"] || oldPos["lon"] != newTrack["lon"]) {
            oldTrack["poshistory"].push({lat: newTrack["lat"], lon: newTrack["lon"]});
          }
        } else {
          oldTrack["poshistory"].push({lat: newTrack["lat"], lon: newTrack["lon"]});
        }
      }

    } else {
      // This is a new track so add it to our track table, but first
      // make sure it has a position history array - if it didn't
      // come across in the "first" call, it won't have one.
      newTrack["poshistory"] = new Array();
      newTrack["poshistory"].push({lat: newTrack["lat"], lon: newTrack["lon"]});
      tracks.set(id, newTrack);
    }
  });

  tracks.forEach((oldTrack, id) => {
    // This is a track that exists in our JS track table but the API is
    // no longer telling us about, if it's not one of the "created by
    // config" tracks that are only sent in the first API call, then
    // it's a dropped track so delete it.
    if (!oldTrack["createdByConfig"] && !trackUpdate.has(id)) {
      tracks.delete(id);
    }
  });
}



/////////////////////////////
//   UI UPDATE FUNCTIONS   //
/////////////////////////////

// Update map, clearing old markers and drawing new ones
async function updateMap() {
  // Iterate through tracks. For each, update an existing marker
  // or create a new marker if required.
  tracks.forEach(function(t, id) {
    var pos = [t["lat"], t["lon"]];
    var icon = getIcon(t);

      console.log(t["lat"])
    if (markers.has(id)) {
      var m = markers.get(id);
      if (shouldShowIcon(t) && pos != null && !isNaN(pos[0]) && !isNaN(pos[1]) && icon != null) {
        // Update the icon if it's changed.
        if (icon != m.getIcon()) {
          m.setIcon(icon);
        }

        // Calculate the current dead reckoned position and move the icon there
        m.setLatLng(pos); // TODO DR
      } else {
        // Existing marker, data invalid, so remove
        markersLayer.removeLayer(m);
        markers.delete(id);
      }
    } else if (shouldShowIcon(t) && pos != null && !isNaN(pos[0]) && !isNaN(pos[1]) && icon != null) {
      // No existing marker, data is valid, so create
      var m = getNewMarker(t);
      markersLayer.addLayer(m);
      markers.set(id, m);
    }
  });

  // Iterate through markers. If one corresponds to a dropped entity, delete it
  markers.forEach(function(marker, id, map) {
    if (!tracks.has(id)) {
      markersLayer.removeLayer(marker);
      markers.delete(id);
    }
  });

  // Add snail trails to map for selected entity
  snailTrailLayer.clearLayers();
  tracks.forEach(function(t, id) {
    if (trackSelected(id)) {
      snailTrailLayer.addLayer(getTrail(t));
    }
  });
  tracks.forEach(function(t, id) {
    if (trackSelected(id) && getDRTrail(t) != null) {
      snailTrailLayer.addLayer(getDRTrail(t));
    }
  });
}

// Function called when an icon is clicked. Just set track as selected,
// unless it already is, in which case deselect.
async function iconSelect(id) {
  if (id != selectedTrackID) {
    selectedTrackID = id;
  } else {
    selectedTrackID = 0;
  }
  updateMap();
}


/////////////////////////////
// TRACK DISPLAY FUNCTIONS //
/////////////////////////////

// Generate a Milsymbol icon for a track
function getIcon(t) {
  // No point returning an icon if we don't know where to draw it
  if (t["lat"] == null || t["lon"] == null) {
    return null;
  }

  // Get position for display
  var lat = t["lat"];
  var lon = t["lon"];
  
  // Decide how much detail to display
  var showName = shouldShowName(t);
  var detailedSymb = trackSelected(t);

  // Generate symbol for display
  var mysymbol = new ms.Symbol(t["symbolcode"], {
    staffComments: detailedSymb ? t["desc1"] : "",
    additionalInformation: detailedSymb ? t["desc2"] : "",
    direction: t["headingText"],
    //altitudeDepth: t["altitudeText"], TODO
    speed: detailedSymb ? t["speedText"] : "",
    type: t["name"],
    dtg: ((!t["fixed"] && t["postime"] != null && detailedSymb) ? moment(t["postime"]).utc().format("DD HHmm[Z] MMMYY").toUpperCase() : ""),
    location: detailedSymb ? (Math.abs(lat).toFixed(4).padStart(7, '0') + ((lat >= 0) ? 'N' : 'S') + " " + Math.abs(lon).toFixed(4).padStart(8, '0') + ((lon >= 0) ? 'E' : 'W')) : ""
  });
  // Styles, some of which change when the track is selected and depending on the theme
  var showLight = (darkTheme && trackSelected(t)) || (!darkTheme && !trackSelected(t));
  mysymbol = mysymbol.setOptions({
    size: 30,
    civilianColor: false,
    colorMode: showLight ? "Light" : "Dark",
    fillOpacity: trackSelected(t) ? 1 : 0.6,
    infoBackground: trackSelected(t) ? (darkTheme ? "black" : "white") : "transparent",
    infoColor: darkTheme ? "white" : "black",
    outlineWidth: trackSelected(t) ? 5 : 0,
    outlineColor: '#007F0E',
  });

  // Build into a Leaflet icon and return
  return L.icon({
    iconUrl: mysymbol.toDataURL(),
    iconAnchor: [mysymbol.getAnchor().x, mysymbol.getAnchor().y],
  });
}

// Generate a map marker (a positioned equivalent of icon()). This will be
// placed at the last known position, or the dead reckoned position if DR
// should be used
function getNewMarker(t, id) {
  var pos = [t["lat"], t["lon"]];
  var icon = getIcon(t);
  if (shouldShowIcon(t) && pos != null && !isNaN(pos[0]) && !isNaN(pos[1]) && icon != null) {
    // Create marker
    var m = L.marker(pos, {
      icon: icon
    });
    // Set the click action for the marker
    m.on('click', (function(id) {
      return function() {
        iconSelect(id);
      };
    })(id));
    return m;
  } else {
    return null;
  }
}

// Generate a snail trail polyline for the track based on its
// reported position history
function getTrail(t) {
  if (shouldShowIcon(t)) {
    return L.polyline(t["poshistory"], { color: '#4581CC' });
  }
}

// Generate a snail trail line for the track joining its
// last reported position with the current dead reckoned
// position, or null if not dead reckoning.
function getDRTrail(t) {
  if (shouldShowIcon(t) && t["poshistory"].length > 0 && shouldDeadReckon(t) && drPosition(t) != null) {
    var points = [[t["lat"], t["lon"]], drPosition(t)];
    return L.polyline(points, {
      color: '#4581CC',
      dashArray: "5 5"
    });
  } else {
    return null;
  }
}

// Check if the track is currently selected
function trackSelected(id) {
  return id == selectedTrackID;
}

// Based on zoom level, should the track's name be shown? (When not selected-
// names are always shown if the track is selected)
function shouldShowName(t) {
  if (t["tracktype"] == "SHIP") {
    return map.getZoom() >= zoomLevelForShipSymbolNames;
  } else {
    return map.getZoom() >= zoomLevelForLandAirSymbolNames;
  }
}

// Based on the selected type filters, should we be displaying this entity
// on the map?
function shouldShowIcon(t) {
  return true; // TODO
}


/////////////////////////////
//    UTILITY FUNCTIONS    //
/////////////////////////////

// Calculate the destination point given start point
// latitude / longitude (numeric degrees), bearing
// (numeric degrees) and distance (in m).
function dest(lat, lon, course, distance) {
    var startLatitudeRadians = lat * Math.PI / 180;
    var startLongitudeRadians = lon * Math.PI / 180;
    var courseRadians = course * Math.PI / 180;
    var distMovedRadians = distance / 6371000.0;
        
    var cosphi1 = Math.cos(startLatitudeRadians);
    var sinphi1 = Math.sin(startLatitudeRadians);
    var cosAz = Math.cos(courseRadians);
    var sinAz = Math.sin(courseRadians);
    var sinc = Math.sin(distMovedRadians);
    var cosc = Math.cos(distMovedRadians);
        
    var endLatitudeRadians = Math.asin(sinphi1 * cosc + cosphi1 * sinc * cosAz);
    var endLongitudeRadians = Math.atan2(sinc * sinAz, cosphi1 * cosc - sinphi1 * sinc * cosAz) + startLongitudeRadians;
        
    var endLatitudeDegrees = endLatitudeRadians * 180 / Math.PI;
    var endLongitudeDegrees = endLongitudeRadians * 180 / Math.PI;
        
    return [endLatitudeDegrees, endLongitudeDegrees];
};

// Utility function to get local PC time with data time offset applied.
function getTimeInServerRefFrame() {
  return moment().subtract(clockOffset, "seconds");
}

// Utility to convert an object created by JSON.parse() into a proper JS map.
function objectToMap(o) {
  let m = new Map();
  for(let k of Object.keys(o)) {
    m.set(k, o[k]); 
  }
  return m;
}


/////////////////////////////
//   THEMEING FUNCTIONS    //
/////////////////////////////

function setLightTheme() {
  darkTheme = false;
  document.documentElement.setAttribute("color-mode", "light");
  var metaThemeColor = document.querySelector("meta[name=theme-color]");
  metaThemeColor.setAttribute("content", "#DDDDB9");
  if (typeof tileLayer !== 'undefined') {
    map.removeLayer(tileLayer);
  }
  tileLayer = L.tileLayer(MAPBOX_URL_LIGHT);
  tileLayer.addTo(map);
  updateMap();
}

function setDarkTheme() {
  darkTheme = true;
  document.documentElement.setAttribute("color-mode", "dark");
  var metaThemeColor = document.querySelector("meta[name=theme-color]");
  metaThemeColor.setAttribute("content", "#2C2C25");
  if (typeof tileLayer !== 'undefined') {
    map.removeLayer(tileLayer);
  }
  tileLayer = L.tileLayer(MAPBOX_URL_DARK);
  tileLayer.addTo(map);
  updateMap();
}

function setThemeToMatchOS() {
  if (!window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setDarkTheme();
  } else {
    setLightTheme();
  }
}


/////////////////////////////
//        API SETUP        //
/////////////////////////////

// Pick which URL to use based on the query string parameters
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var serverURL = SERVER_URL;
if (urlParams.get("alt") == "true") {
  serverURL = SERVER_URL_ALT;
}


/////////////////////////////
//       MAP SETUP         //
/////////////////////////////

// Create map and set initial view. Zoom out one level if on mobile
var map = L.map('map', {
  zoomControl: false
})
var startZoom = START_ZOOM;
var screenWidth = (window.innerWidth > 0) ? window.innerWidth : screen.width;
if (screenWidth <= 600) {
  startZoom--;
}
map.setView(START_LAT_LON, startZoom);

// Add main marker layer
var markersLayer = new L.LayerGroup();
markersLayer.addTo(map);

// Add snail trail layer
var snailTrailLayer = new L.LayerGroup();
snailTrailLayer.addTo(map);

// Background layers will be added shortly in setThemeToMatchOS()

// Zooming affects the level of detail shown on icons, so we need to update the map
// on a zoom change.
map.on("zoomend", function (e) { updateMap(); });


/////////////////////////////
//       THEME SETUP       //
/////////////////////////////

setThemeToMatchOS();
window.matchMedia("(prefers-color-scheme: dark)").addListener(setThemeToMatchOS);


/////////////////////////////
//     CONTROLS SETUP      //
/////////////////////////////

// Types
function setTypeEnable(type, enable) {
  if (enable) {
    showTypes.push(type);
  } else {
    for( var i = 0; i < showTypes.length; i++){ if ( showTypes[i] === type) { showTypes.splice(i, 1); }}
  }
  updateMap();
}

$("#showAircraft").click(function() {
  setTypeEnable(types.AIRCRAFT, $(this).is(':checked'));
});
$("#showShips").click(function() {
  setTypeEnable(types.SHIP, $(this).is(':checked'));
});
$("#showAirports").click(function() {
  setTypeEnable(types.AIRPORT, $(this).is(':checked'));
});
$("#showSeaPorts").click(function() {
  setTypeEnable(types.SEAPORT, $(this).is(':checked'));
});
$("#showBase").click(function() {
  setTypeEnable(types.BASE, $(this).is(':checked'));
});

// Colour themes
$("#light").click(setLightTheme);
$("#dark").click(setDarkTheme);


/////////////////////////////
//     REDIRECT TO HTTP    //
/////////////////////////////

// Unfortunately HTTPS isn't working well on my home server, so redirect
// HTTPS requests to HTTP. (You can't just make HTTP requests from a page
// that's served as HTTPS unfortunately, so we must redirect the user.)
// If you are running this software yourself and HTTPS to your server
// works better, please remove this.
if (location.protocol == 'https:') {
    location.replace(`http:${location.href.substring(location.protocol.length)}`);
}


/////////////////////////////
//        KICK-OFF         //
/////////////////////////////

fetchDataFirst();
setInterval(fetchDataUpdate, queryServerIntervalMS);
setInterval(updateMap, updateMapIntervalMS);
