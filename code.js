/////////////////////////////
// USER-CONFIGURABLE VARS  //
/////////////////////////////

// Most important config item - the address of the Plane/Sailing server instance.
// You can provide a main and LAN URL, i.e. one normal addressfor use from the public
// internet and one for use when you are on the same LAN as the machine running the
// server, where the main URL won't work. There is a switch in the Configuration
// panel to toggle between them.
const SERVER_URL = "https://planesailingserver.ianrenton.com/";
const SERVER_URL_LAN = "http://192.168.1.240/";

// Map layer URLs - if re-using this code you will need to provide your own Mapbox
// access token in the Mapbox URL. You can still use my styles.
const MAPBOX_URL_DARK = "https://api.mapbox.com/styles/v1/ianrenton/ck6weg73u0mvo1ipl5lygf05t/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiaWFucmVudG9uIiwiYSI6ImNrcTl3bHJrcDAydGsyb2sxb3h2cHE4bGgifQ.UzgaBetIhhTUGBOtLSlYDg";
const MAPBOX_URL_LIGHT = "https://api.mapbox.com/styles/v1/ianrenton/ckchhz5ks23or1ipf1le41g56/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiaWFucmVudG9uIiwiYSI6ImNrcTl3bHJrcDAydGsyb2sxb3h2cHE4bGgifQ.UzgaBetIhhTUGBOtLSlYDg";
const OPENAIP_URL = "https://1.tile.maps.openaip.net/geowebcache/service/tms/1.0.0/openaip_basemap@EPSG%3A900913@png/{z}/{x}/{y}.png";
const OPENSEAMAP_URL = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";

// Map default position/zoom
const START_LAT_LON = [50.7, -1.8];
const START_ZOOM = 11;

// Zoom levels at which to show symbol names. Lower value for ships because ships
// are very clustered inside harbours where I live. You may wish to change them,
// decrease the numbers to show names when more zoomed out.
const ZOOM_LEVEL_FOR_LAND_AIR_SYMBOL_NAMES = 9; // If zoomed in at least this far, show all land & air symbol names. Decrease this to show names at lower zooms.
const ZOOM_LEVEL_FOR_SHIP_SYMBOL_NAMES = 12; // If zoomed in at least this far, show all ship symbol names. Decrease this to show names at lower zooms.

// Update timings. Map updating every second is a good balance of smoothness
// and not killing your CPU. Query the server more often only if your server
// PC performance allows, remember you may not be the only active user!
const UPDATE_MAP_INTERVAL_MILLISEC = 1000;
const QUERY_SERVER_INTERVAL_MILLISEC = 10000;

// Times after which to show tracks as 'anticipated' (dotted outline).
// Technically we are anticipating position immediately when dead
// reckoning is enabled, but we use these values as a rough indication
// of "there should have been an update by now".
const AIR_SHOW_ANTICIPATED_AFTER_MILLISEC = 60000;
const SEA_LAND_SHOW_ANTICIPATED_AFTER_MILLISEC = 300000;

// Colours you may wish to tweak to your liking
const SELECTED_TRACK_HIGHLIGHT_COLOUR = "#4581CC";
const UNSELECTED_TRACK_TRAIL_COLOUR_DARK = "#1F3A5B";
const UNSELECTED_TRACK_TRAIL_COLOUR_LIGHT = "#75B3FF";




/////////////////////////////
//      DATA STORAGE       //
/////////////////////////////

const VERSION = "2.0.3";
var trackTypesVisible = ["AIRCRAFT", "SHIP", "AIS_SHORE_STATION", "AIS_ATON", "APRS_TRACK", "BASE_STATION", "AIRPORT", "SEAPORT"];
var tracks = new Map(); // id -> Track object
var markers = new Map(); // id -> Marker
var clockOffset = 0; // Local PC time (UTC) minus data time. Used to prevent dead reckoning errors if the local PC clock is off or in a different time zone
var onMobile = false;


/////////////////////////////
//  UI CONFIGURABLE VARS   //
/////////////////////////////

// These are all parameters that can be changed by the user by clicking buttons on the GUI

var darkTheme = true;
var selectedTrackID = "";
var enableDeadReckoning = true;
var snailTrailLength = 500;
var snailTrailMode = 1; // 0 = none, 1 = only selected, 2 = all
var lanMode = false;


/////////////////////////////
//   API CALL FUNCTIONS    //
/////////////////////////////

// "First" API call - called once on page load, this retrieves all data from
// the server including base station/airports/seaports and full position
// history
function fetchDataFirst() {
  showLoadingIndicator(true);
  $.ajax({
    url: getServerURL() + "first",
    dataType: 'json',
    timeout: 10000,
    success: async function(result) {
      showServerOffline(false);
      handleDataFirst(result);
      // Pop out track table by default on desktop browsers after first
      // successful load.
      if (!onMobile) {
        manageRightBoxes("#trackTablePanel", "#configPanel", "#infoPanel");
      }
    },
    error: function() {
      showServerOffline(true);
    },
    complete: function() {
      showLoadingIndicator(false);
    }
  });
}

// "Update" API call - called at regular intervals, this retrieves new data from
// the server.
function fetchDataUpdate() {
  showLoadingIndicator(true);
  $.ajax({
    url: getServerURL() + "update",
    dataType: 'json',
    timeout: 5000,
    success: async function(result) {
      showServerOffline(false)
      handleDataUpdate(result);
    },
    error: function() {
      showServerOffline(true);
    },
    complete: function() {
      showLoadingIndicator(false);
    }
  });
}

// Get the URL for the server based on whether we're in LAN mode or not
function getServerURL() {
  if (lanMode) {
    return SERVER_URL_LAN;
  } else {
    return SERVER_URL;
  }
}



/////////////////////////////
// DATA HANDLING FUNCTIONS //
/////////////////////////////

// Handle successful receive of first-time data. All we need to do is
// dump the data into out "tracks" map and call the standard GUI update
// functions.
async function handleDataFirst(result) {
  tracks.clear();
  tracks = objectToMap(result.tracks);
  $("#serverVersion").text(result.version);
  updateGUIAfterQuery(result.time);
}

// Handle successful receive of update data. This is a bit more complex
// because we have three cases to handle:
// 1) Updated tracks - update the data in our map and append position
//    history
// 2) New tracks - just add the data to our map
// 3) Missing tracks - delete from our tracks list, unless they are
//    config-created base station/airport/seaport.
async function handleDataUpdate(result) {
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

  updateGUIAfterQuery(result.time);
}

// Standard set of code to call after receiving data and updating 
// the tracks map with it. This method:
// * Updates the clock offset, so we know the difference between
//   our local clock and the server's
// * Trims position history, removing any history older than the
//   number of snail trail points we need to display
// * Updates the track table GUI
// * Updates the counters (e.g. "tracking 69 aircraft")
// * Stores the current time as the time of the last query.
// Note that this *doesn't* update the map itself - there's no
// need to as it has its own update timer that's independent of
// querying the server.
async function updateGUIAfterQuery(serverTime) {
  clockOffset = moment().diff(moment(serverTime).utc(), 'seconds');
  trimPositionHistory();
  updateTrackTable();
  updateCounters();
  $("#lastQueryTime").text(moment().format('lll'));
}

// Trim the position history to the user-configurable snail trail length,
// to avoid filling up memory with loads of history over time.
async function trimPositionHistory() {
  tracks.forEach((t) => {
    if (t["poshistory"]) {
      while (t["poshistory"].length >= snailTrailLength) {
        t["poshistory"].shift();
      }
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
  tracks.forEach(function(t) {
    var pos = getIconPosition(t);
    var icon = getIcon(t);

    if (markers.has(t["id"])) {
      var m = markers.get(t["id"]);
      if (shouldShowIcon(t) && pos != null && !isNaN(pos[0]) && !isNaN(pos[1]) && icon != null) {
        // Update the icon if it's changed.
        if (icon != m.getIcon()) {
          m.setIcon(icon);
        }

        // Move the icon to its new position
        m.setLatLng(pos);

      } else {
        // Existing marker, data invalid, so remove
        markersLayer.removeLayer(m);
        markers.delete(t["id"]);
      }

    } else if (shouldShowIcon(t) && pos != null && !isNaN(pos[0]) && !isNaN(pos[1]) && icon != null) {
      // No existing marker, data is valid, so create
      var m = getNewMarker(t);
      markersLayer.addLayer(m);
      markers.set(t["id"], m);
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
  tracks.forEach(function(t) {
    if (shouldShowTrail(t)) {
      snailTrailLayer.addLayer(getTrail(t));
    }
  });
  tracks.forEach(function(t) {
    if (shouldShowTrail(t) && getDRTrail(t) != null) {
      snailTrailLayer.addLayer(getDRTrail(t));
    }
  });
}

// Update track table on the GUI
async function updateTrackTable() {
  // Sort data for table
  tableList = Array.from(tracks.values());
  tableList.sort((a, b) => (a["name"] > b["name"]) ? 1 : -1);

  // Create header
  var table = $('<table>');
  table.addClass('tracktable');
  var headerFields = "<th class='name'>NAME</th><th>TYPE</th><th>LAT</th><th>LON</th><th>ALT<br>FL</th><th>HDG<br>DEG</th><th>SPD<br>KTS</th>";
  var header = $('<tr>').html(headerFields);
  table.append(header);

  // Create table rows
  var rows = 0;
  tableList.forEach(function(t) {
    // Only real detected tracks, not config-based ones
    if (!t["createdByConfig"]) {
      var pos = getLastKnownPosition(t);
      // Type abbreviation
      var typeAbbr = "";
      if (t["tracktype"] == "SHIP") {
        typeAbbr = "SEA";
      } else if (t["tracktype"] == "AIRCRAFT") {
        typeAbbr = "AIR";
      } else {
        // Anything else is ground domain
        typeAbbr = "GND";
      }
      // Altitude rate symbol
      var altRateSymb = "";
      if (t["altrate"] != null && t["altrate"] > 2) {
        altRateSymb = "\u25b2";
      } else if (t["altrate"] != null && t["altrate"] < -2) {
        altRateSymb = "\u25bc";
      }

      // Generate table row
      var rowFields = "<td class='name'>" + t["name"].replaceAll(" ", "&nbsp;") + "</td>";
      rowFields += "<td>" + typeAbbr + "</td>";
      rowFields += "<td>" + ((pos != null) ? (Math.abs(pos[0]).toFixed(4).padStart(7, '0') + ((pos[0] >= 0) ? 'N' : 'S')) : "---") + "</td>";
      rowFields += "<td>" + ((pos != null) ? (Math.abs(pos[1]).toFixed(4).padStart(8, '0') + ((pos[1] >= 0) ? 'E' : 'W')) : "---") + "</td>";
      rowFields += "<td>" + ((t["altitude"] != null) ? ((t["altitude"] / 100).toFixed(0) + altRateSymb) : "---") + "</td>";
      rowFields += "<td>" + ((t["heading"] != null) ? t["heading"].toString().padStart(3, "0") : "---") + "</td>";
      rowFields += "<td>" + ((t["speed"] != null) ? t["speed"].toFixed(0) : "---") + "</td>";
      var row = $('<tr trackID=' + t["id"] + '>').html(rowFields);
      if (trackSelected(t["id"])) {
        row.addClass("selected");
      }

      // Add to table
      table.append(row);
      rows++;
    }
  });
  if (rows == 0) {
    table.append($('<tr>').html("<td colspan=12><div class='tablenodata'>NO DATA</div></td>"));
  }

  // Update DOM
  $('#tracktablearea').html(table);
}

// Update the count of how many things we're tracking in the info panel.
async function updateCounters() {
  var aircraftCount = 0;
  var shipCount = 0;
  var aprsCount = 0;
  tracks.forEach(function(t) {
    if (t["tracktype"] == "AIRCRAFT") {
      aircraftCount++;
    } else if (t["tracktype"] == "SHIP") {
      shipCount++;
    } else if (t["tracktype"] == "APRS_TRACK") {
      aprsCount++;
    }
  });
  $("#aircraftCount").text(aircraftCount);
  $("#shipCount").text(shipCount);
  $("#aprsCount").text(aprsCount);
}

// Function called when an icon is clicked. Just set track as selected,
// unless it already is, in which case deselect.
async function iconSelect(id) {
  select(id, false);
}

// Function called when a table row is clicked. Set track as selected and zoom
// to it.
async function tableSelect(id) {
  select(id, true);
}

// Select or deselect the given track, optionally pan to it on selection.
async function select(id, pan) {
  if (id != selectedTrackID) {
    selectedTrackID = id;
    if (pan) {
      panTo(id);
    }
  } else {
    selectedTrackID = 0;
  }
  updateMap();
  updateTrackTable();
}

// Pan to an entity, given its ID
async function panTo(id) {
  var t = tracks.get(id);
  if (t != null && getIconPosition(t) != null) {
    map.panTo(getIconPosition(t));
  }
}

// Show or hide the "loading" indicator. This will only be
// shown on desktop, not on mobile. When hiding, this actually
// waits one second before hiding because querying the server
// is normally very quick, and the ~100ms flash looks ugly, so
// we pad it out a bit.
async function showLoadingIndicator(show) {
  if (show && !onMobile) {
    $("#loading").fadeIn();
  } else {
    setTimeout(function(){ $("#loading").fadeOut(); }, 1000);
  }
}

// Shows or hides the "server offline" indicator. This will only be
// shown on desktop, not on mobile.
async function showServerOffline(offline) {
  if (offline && !onMobile) {
    $("#serverOffline").fadeIn();
  } else {
    $("#serverOffline").fadeOut();
  }
}


/////////////////////////////
// TRACK DISPLAY FUNCTIONS //
/////////////////////////////

// Generate a Milsymbol icon for a track
function getIcon(t) {
  // No point returning an icon if we don't know where to draw it
  if (getLastKnownPosition(t) == null) {
    return null;
  }

  // Get position for text display - we are going to display the last known
  // position and time on the symbol, even though it moves when dead
  // reckoning without these values updating, otherwise it gives a false
  // impression of receiving real position updates.
  var lat = getLastKnownPosition(t)[0];
  var lon = getLastKnownPosition(t)[1];
  
  // Decide how much detail to display
  var showName = shouldShowName(t);
  var detailedSymb = trackSelected(t["id"]);
  
  // Change symbol to "anticipated" if old enough
  var symbol = t["symbolcode"];
  if (oldEnoughToShowAnticipated(t)) {
    symbol = symbol.substr(0, 3) + "A" + symbol.substr(4);
  }

  // Generate symbol for display
  var mysymbol = new ms.Symbol(symbol, {
    staffComments: detailedSymb ? t["desc1"] : "",
    additionalInformation: detailedSymb ? t["desc2"] : "",
    direction: (t["heading"] != null) ? t["heading"] : "",
    altitudeDepth: (detailedSymb && t["altitude"] != null) ? "FL" + (t["altitude"] / 100).toFixed(0) : "",
    speed: (detailedSymb && t["speed"] != null) ? t["speed"].toFixed(0) + "KTS" : "",
    type: (showName || detailedSymb) ? t["name"] : "",
    dtg: ((!t["fixed"] && t["postime"] != null && detailedSymb) ? moment(t["postime"]).utc().format("DD HHmm[Z] MMMYY").toUpperCase() : ""),
    location: detailedSymb ? (Math.abs(lat).toFixed(4).padStart(7, '0') + ((lat >= 0) ? 'N' : 'S') + " " + Math.abs(lon).toFixed(4).padStart(8, '0') + ((lon >= 0) ? 'E' : 'W')) : ""
  });

  // Styles, some of which change when the track is selected and depending on the theme
  var showLight = (darkTheme && trackSelected(t["id"])) || (!darkTheme && !trackSelected(t["id"]));
  mysymbol = mysymbol.setOptions({
    size: 30,
    civilianColor: false,
    colorMode: showLight ? "Light" : "Dark",
    fillOpacity: trackSelected(t["id"]) ? 1 : 0.6,
    infoBackground: trackSelected(t["id"]) ? (darkTheme ? "black" : "white") : "transparent",
    infoColor: darkTheme ? "white" : "black",
    outlineWidth: trackSelected(t["id"]) ? 5 : 0,
    outlineColor: SELECTED_TRACK_HIGHLIGHT_COLOUR,
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
function getNewMarker(t) {
  var pos = getIconPosition(t);
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
    })(t["id"]));
    return m;
  } else {
    return null;
  }
}

// Generate a snail trail polyline for the track based on its
// reported position history
function getTrail(t) {
  if (shouldShowTrail(t)) {
    return L.polyline(t["poshistory"], { color: getTrailColour(t["id"]) });
  } else {
    return null;
  }
}

// Generate a snail trail line for the track joining its
// last reported position with the current dead reckoned
// position, or null if not dead reckoning.
function getDRTrail(t) {
  if (shouldShowTrail(t) && enableDeadReckoning && getDRPosition(t) != null) {
    var points = [getLastKnownPosition(t), getDRPosition(t)];
    return L.polyline(points, {
      color: getTrailColour(t["id"]),
      dashArray: "5 5"
    });
  } else {
    return null;
  }
}

// Get the appropriate trail colour.
function getTrailColour(id) {
  if (trackSelected(id)) {
    return SELECTED_TRACK_HIGHLIGHT_COLOUR;
  } else if (darkTheme) {
    return UNSELECTED_TRACK_TRAIL_COLOUR_DARK;
  } else {
    return UNSELECTED_TRACK_TRAIL_COLOUR_LIGHT;
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
    return map.getZoom() >= ZOOM_LEVEL_FOR_SHIP_SYMBOL_NAMES;
  } else {
    return map.getZoom() >= ZOOM_LEVEL_FOR_LAND_AIR_SYMBOL_NAMES;
  }
}

// Based on the selected type filters, should we be displaying this track
// on the map?
function shouldShowIcon(t) {
  return trackTypesVisible.includes(t["tracktype"]);
}

// Based on the selected type filters, and snail trail mode, should we
// be displaying this track's trail on the map?
function shouldShowTrail(t) {
  return shouldShowIcon(t) && t["poshistory"] && t["poshistory"].length > 0 && t["poshistory"][0]["lat"] != null && (snailTrailMode == 2 || (snailTrailMode == 1 && trackSelected(t["id"])));
}

// Get the latest known position of a track as a two-element list lat,lon
function getLastKnownPosition(t) {
  if (t["lat"] != null) {
    return [t["lat"], t["lon"]];
  } else {
    return null;
  }
}

// Get the dead reckoned position of a track based on its last position
// update plus course and speed at that time.
function getDRPosition(t) {
  if (getLastKnownPosition(t) != null && t["postime"] != null && t["course"] != null && t["speed"] != null) {
    // Can dead reckon
    var timePassedSec = getTimeInServerRefFrame().diff(t["postime"]) / 1000.0;
    var speedMps = t["speed"] * 0.514444;
    var newPos = dest(t["lat"], t["lon"], t["course"], timePassedSec * speedMps);
    return newPos;
  } else {
    return null;
  }
}

// Get the position to show the track's icon at. Equal to either the
// last known position or the dead reckoned position, depending on
// whether DR is enabled and the data to use it is available.
function getIconPosition(t) {
  if (t["lat"] != null && t["lon"] != null) {
    if (enableDeadReckoning && t["postime"] != null && t["course"] != null && t["speed"] != null) {
      return getDRPosition(t);
    } else {
      return getLastKnownPosition(t);
    }
  } else {
    return null;
  }
}

// Is the track old enough that we should display the track as an anticipated
// position?
function oldEnoughToShowAnticipated(t) {
  if (!enableDeadReckoning || t["fixed"]) {
    return false;
  } else if (t["tracktype"] == "AIRCRAFT") {
    return t["postime"] != null && getTimeInServerRefFrame().diff(t["postime"]) > AIR_SHOW_ANTICIPATED_AFTER_MILLISEC;
  } else {
    return t["postime"] != null && getTimeInServerRefFrame().diff(t["postime"]) > SEA_LAND_SHOW_ANTICIPATED_AFTER_MILLISEC;
  }
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
  if (typeof backgroundTileLayer !== 'undefined') {
    map.removeLayer(backgroundTileLayer);
  }
  backgroundTileLayer = L.tileLayer(MAPBOX_URL_LIGHT);
  backgroundTileLayer.addTo(map);
  updateMap();
}

function setDarkTheme() {
  darkTheme = true;
  document.documentElement.setAttribute("color-mode", "dark");
  var metaThemeColor = document.querySelector("meta[name=theme-color]");
  metaThemeColor.setAttribute("content", "#2C2C25");
  if (typeof backgroundTileLayer !== 'undefined') {
    map.removeLayer(backgroundTileLayer);
  }
  backgroundTileLayer = L.tileLayer(MAPBOX_URL_DARK);
  backgroundTileLayer.addTo(map);
  updateMap();
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
//         GUI SETUP       //
/////////////////////////////

if (window.matchMedia('screen and (max-width: 600px)').matches) {
  onMobile = true;
}
setDarkTheme();


/////////////////////////////
//     CONTROLS SETUP      //
/////////////////////////////

// Info, Config and Track Table panel show/hides
function manageRightBoxes(show, hide1, hide2) {
  var showDelay = 0;
  if ($(hide1).is(":visible")) {
    $(hide1).slideUp();
    showDelay = 600;
  }
  if ($(hide2).is(":visible")) {
    $(hide2).slideUp();
    showDelay = 600;
  }

  setTimeout(function(){ $(show).slideToggle(); }, showDelay);
}

$("#infoButton").click(function() {
  manageRightBoxes("#infoPanel", "#configPanel", "#trackTablePanel");
});
$("#configButton").click(function() {
  manageRightBoxes("#configPanel", "#infoPanel", "#trackTablePanel");
});
$("#trackTableButton").click(function() {
  manageRightBoxes("#trackTablePanel", "#configPanel", "#infoPanel");
});

// Types
function setTypeEnable(type, enable) {
  if (enable) {
    trackTypesVisible.push(type);
  } else {
    for( var i = 0; i < trackTypesVisible.length; i++){ if ( trackTypesVisible[i] === type) { trackTypesVisible.splice(i, 1); }}
  }
  updateMap();
}

$("#showAircraft").click(function() {
  setTypeEnable("AIRCRAFT", $(this).is(':checked'));
});
$("#showShips").click(function() {
  setTypeEnable("SHIP", $(this).is(':checked'));
});
$("#showAISShoreStations").click(function() {
  setTypeEnable("AIS_SHORE_STATION", $(this).is(':checked'));
});
$("#showATONs").click(function() {
  setTypeEnable("AIS_ATON", $(this).is(':checked'));
});
$("#showAPRS").click(function() {
  setTypeEnable("APRS_TRACK", $(this).is(':checked'));
});
$("#showAirports").click(function() {
  setTypeEnable("AIRPORT", $(this).is(':checked'));
});
$("#showSeaPorts").click(function() {
  setTypeEnable("SEAPORT", $(this).is(':checked'));
});
$("#showBase").click(function() {
  setTypeEnable("BASE_STATION", $(this).is(':checked'));
});

// Colour themes
$("#lightButton").click(setLightTheme);
$("#darkButton").click(setDarkTheme);

// Dead reckoning
$("#enableDR").click(function() {
  enableDeadReckoning = $(this).is(':checked');
  updateMap();
});

// Snail trails
$("#snailTrails").change(function() {
  snailTrailMode = parseInt($(this).val());
  updateMap();
});
$("#snailTrailLength").change(function() {
  snailTrailLength = parseInt($(this).val());
  trimPositionHistory();
  updateMap();
});

// Overlay layers
$("#showAirspaceLayer").click(function() {
  if ($(this).is(':checked')) {
    airspaceLayer = L.tileLayer(OPENAIP_URL);
    airspaceLayer.addTo(map);
  } else if (typeof airspaceLayer !== 'undefined') {
    map.removeLayer(airspaceLayer);
  }
});
$("#showMaritimeLayer").click(function() {
  if ($(this).is(':checked')) {
    maritimeLayer = L.tileLayer(OPENSEAMAP_URL);
    maritimeLayer.addTo(map);
  } else if (typeof maritimeLayer !== 'undefined') {
    map.removeLayer(maritimeLayer);
  }
});

// LAN mode switch
$("#lanMode").click(function() {
  lanMode = $(this).is(':checked');
  fetchDataFirst();
});

// Table row click selects the track
$(document).on("click", "tr", function(e) {
  tableSelect($(e.currentTarget).attr("trackID"));
});


/////////////////////////////
//        KICK-OFF         //
/////////////////////////////

fetchDataFirst();
setInterval(fetchDataUpdate, QUERY_SERVER_INTERVAL_MILLISEC);
setInterval(updateMap, UPDATE_MAP_INTERVAL_MILLISEC);
$("#clientVersion").text(VERSION);
