/////////////////////////////
// USER-CONFIGURABLE VARS  //
/////////////////////////////

// Most important config item - the address of the Plane/Sailing server instance.
// You can provide a main and LAN URL, i.e. one normal addressfor use from the public
// internet and one for use when you are on the same LAN as the machine running the
// server, where the main URL won't work. There is a switch in the Configuration
// panel to toggle between them.
const SERVER_URL = "https://planesailingserver.ianrenton.com/";
const SERVER_URL_LAN = "http://192.168.1.240:8090/";

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
const QUERY_SERVER_TELEMETRY_INTERVAL_MILLISEC = 30000;

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

const VERSION = "2.3.1";
var trackTypesVisible = ["AIRCRAFT", "SHIP", "AIS_SHORE_STATION", "AIS_ATON", "APRS_MOBILE", "APRS_BASE_STATION", "BASE_STATION", "AIRPORT", "SEAPORT"];
var tracks = new Map(); // id -> Track object
var markers = new Map(); // id -> Marker
var clockOffset = 0; // Local PC time (UTC) minus data time. Used to prevent dead reckoning errors if the local PC clock is off or in a different time zone
var onMobile = window.matchMedia('screen and (max-width: 800px)').matches;
var firstVisit = false;
var selectedTrackID = "";
var lastQueryTime = moment();


/////////////////////////////
//  UI CONFIGURABLE VARS   //
/////////////////////////////

// These are all parameters that can be changed by the user by clicking buttons on the GUI,
// and are persisted in local storage.
var darkSymbols = true;
var basemapOpacity = 1;
var baseMapIsDark = true; // Set when basemap changes, affects text colour of non-selected symbols to ensure it contrasts
var enableDeadReckoning = true;
var snailTrailLength = 500;
var snailTrailMode = 1; // 0 = none, 1 = only selected, 2 = all
var lanMode = false;
var showTelemetry = false;
var symbolOverrides = new Map(); // id -> symbol code


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
      // successful load, so long as it's not the user's first visit (in
      // which case the info panel will be on display)
      if (!onMobile && !firstVisit) {
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
  // First check how long it's been since we last did an update call.
  // If it's been a long time, this represents a tab that was in the
  // background or a PWA that was closed and re-opened, so instead of
  // an update we should do a first load instead so we get the full
  // history for the time we missed.
  if (moment().diff(lastQueryTime, 'milliseconds') > (10 * QUERY_SERVER_INTERVAL_MILLISEC)) {
    fetchDataFirst();
    fetchTelemetry();
    return;
  }

  // OK, time for a real update call then
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

// "Telemetry" API call - called at regular intervals but only effective if
// showTelemetry is enabled.
function fetchTelemetry() {
  if (showTelemetry) {
    $.ajax({
      url: getServerURL() + "telemetry",
      dataType: 'json',
      timeout: 5000,
      success: async function(result) {
        handleTelemetry(result);
      }
    });
  }
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
  updateGUIAfterDataQuery(result);
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
        if (newTrack["lat"] != null && newTrack["lon"] != null) {
          if (oldTrack["poshistory"].length > 0) {
            var oldPos = oldTrack["poshistory"][oldTrack["poshistory"].length - 1];
            if (oldPos["lat"] != newTrack["lat"] || oldPos["lon"] != newTrack["lon"]) {
              oldTrack["poshistory"].push({lat: newTrack["lat"], lon: newTrack["lon"]});
            }
          } else {
            oldTrack["poshistory"].push({lat: newTrack["lat"], lon: newTrack["lon"]});
          }
        }
      }

    } else {
      // This is a new track so add it to our track table, but first
      // make sure it has a position history array - if it didn't
      // come across in the "first" call, it won't have one.
      newTrack["poshistory"] = new Array();
      if (newTrack["lat"] != null && newTrack["lon"] != null) {
        newTrack["poshistory"].push({lat: newTrack["lat"], lon: newTrack["lon"]});
      }
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

  updateGUIAfterDataQuery(result);
}

// Handle successful receive of telemetry data.
async function handleTelemetry(result) {
  $("#uptime").text(getFormattedDuration(result.uptime, true));
  $("#cpuLoad").text(result.cpuLoad + "%");
  $("#memUsed").text(result.memUsed + "%");
  $("#diskUsed").text(result.diskUsed + "%");
  $("#adsbStatus").text(result.adsbReceiverStatus);
  $("#mlatStatus").text(result.mlatReceiverStatus);
  $("#aisStatus").text(result.aisReceiverStatus);
  $("#aprsStatus").text(result.aprsReceiverStatus);
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

// Standard set of code to call after receiving data and updating 
// the tracks map with it. This method:
// * Updates the clock offset, so we know the difference between
//   our local clock and the server's
// * Trims position history, removing any history older than the
//   number of snail trail points we need to display
// * Updates the map and the track table GUI
// * Updates the counters (e.g. "tracking 69 aircraft") and last
//   server query time
// * Stores the current time as the time of the last query.
async function updateGUIAfterDataQuery(result) {
  clockOffset = moment().diff(moment(result.time).utc(), 'seconds');
  trimPositionHistory();
  updateMapObjects();
  updateTrackTable();
  updateCounters();
  lastQueryTime = moment();
  $("#lastQueryTime").text(moment().format('lll'));
}



/////////////////////////////
//   UI UPDATE FUNCTIONS   //
/////////////////////////////

// Update the objects that are rendered on the map. Clear old markers and draw new ones,
// as well as updating icons, positions and trails for ones that already exist. This is
// called when the data model changes due to a server query, or a UI interaction that
// changes the icons e.g. a selection event or theme change.
// Contrast with "updateMap()" (which this method calls, but is also called every second)
// which just moves existing markers and updates dead reckoning trails, since the
// icons don't change unless this method gets called.
async function updateMapObjects() {
  snailTrailLayer.clearLayers();
  // Iterate through tracks. For each, update an existing marker
  // or create a new marker if required.
  tracks.forEach(function(t) {
    var pos = getIconPosition(t);

    if (markers.has(t["id"])) {
      var m = markers.get(t["id"]);
      if (shouldShowIcon(t) && pos != null) {
        // Update the icon. Would be nice not to regenerate this all the time but
        // to do that we'd need to maintain a shadow copy of everything and check
        // for data changes.
        m.setIcon(getIcon(t));

        // Move the icon to its new position.
        m.setLatLng(pos);

        // Set z index, which may have changed because selected markers are brought
        // to the top
        m.options.zIndexOffset = trackSelected(t["id"]) ? 100 : (t["fixed"] ? -100 : 0);

      } else {
        // Existing marker, data invalid, so remove
        markersLayer.removeLayer(m);
        markers.delete(t["id"]);
      }

    } else if (shouldShowIcon(t) && pos != null) {
      // No existing marker, data is valid, so create
      var m = getNewMarker(t);
      markersLayer.addLayer(m);
      markers.set(t["id"], m);
    }

    // Update "real data" snail trails to map for entities that require them
    if (shouldShowTrail(t)) {
      snailTrailLayer.addLayer(getTrail(t));
    }
  });

  // Iterate through markers. If one corresponds to a dropped entity, delete it
  markers.forEach(function(marker, id, map) {
    if (!tracks.has(id)) {
      markersLayer.removeLayer(marker);
      markers.delete(id);
    }
  });

  updateMap();
}

// Move markers to their current position and update dead reckoning snail trails.
// This gets fired every second, when since no changes have occurred to the
// data model, that's all we need to update. Contrast with "updateMapObjects()"
// which does create new markers, remove old ones, update icons etc. but is only
// called when the data model has changed due to a new set of data from the
// server or UI interaction.
async function updateMap() {
  drSnailTrailLayer.clearLayers();
  tracks.forEach(function(t) {
    var pos = getIconPosition(t);
    if (markers.has(t["id"]) && shouldShowIcon(t) && pos != null) {
      markers.get(t["id"]).setLatLng(pos);

      if (shouldShowTrail(t) && getDRTrail(t) != null) {
        drSnailTrailLayer.addLayer(getDRTrail(t));
      }
    }
  });
}

// Update track table on the GUI
async function updateTrackTable() {
  // Sort data for table
  tableList = Array.from(tracks.values());
  tableList.sort((a, b) => (a["name"] > b["name"]) ? 1 : -1);

  // Create header
  var tableContent = "<tr><th class='name'>NAME</th><th>TYPE</th><th>LAT</th><th>LON</th><th>ALT<br>FL</th><th>HDG<br>DEG</th><th>SPD<br>KTS</th><th>AGE</th></tr>";

  // Create table rows
  var rows = 0;
  tableList.forEach(function(t) {
    // Only real detected tracks, not config-based ones, and only if their
    // visibility is turned on
    if (!t["createdByConfig"] && shouldShowIcon(t)) {
      var pos = getLastKnownPosition(t);
      // Type abbreviation
      var typeAbbr = "";
      if (t["tracktype"] == "SHIP" || t["tracktype"] == "AIS_ATON") {
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
      var rowFields = "<tr trackID='" + t["id"] + "' class='";
      if (trackSelected(t["id"])) {
        rowFields += "selected";
      }
      if (!youngEnoughToShowLive(t)) {
        rowFields += " notlive";
      }
      rowFields += "'><td class='name'>" + t["name"].replaceAll(" ", "&nbsp;") + "</td>";
      rowFields += "<td>" + typeAbbr + "</td>";
      rowFields += "<td>" + ((pos != null) ? (Math.abs(pos[0]).toFixed(4).padStart(7, '0') + ((pos[0] >= 0) ? 'N' : 'S')) : "&mdash;") + "</td>";
      rowFields += "<td>" + ((pos != null) ? (Math.abs(pos[1]).toFixed(4).padStart(8, '0') + ((pos[1] >= 0) ? 'E' : 'W')) : "&mdash;") + "</td>";
      rowFields += "<td>" + ((t["altitude"] != null) ? ((t["altitude"] / 100).toFixed(0) + altRateSymb) : "&mdash;") + "</td>";
      rowFields += "<td>" + ((t["heading"] != null) ? t["heading"].toString().padStart(3, "0") : "&mdash;") + "</td>";
      rowFields += "<td>" + ((t["speed"] != null) ? t["speed"].toFixed(0) : "&mdash;") + "</td>";
      rowFields += "<td>" + getFormattedAge(t) + "</td></tr>";

      // Add to table
      tableContent += rowFields;
      rows++;
    }
  });
  if (rows == 0) {
    tableContent += "<tr><td colspan=8><div class='tablenodata'>NO DATA</div></td></tr>";
  }

  // Update DOM
  $('#tracktable').html(tableContent);
}

// Update the count of how many things we're tracking in the info panel.
async function updateCounters() {
  var aircraftCount = 0;
  var shipCount = 0;
  var aprsMobileCount = 0;
  var aisShoreCount = 0;
  var aprsBaseCount = 0;
  tracks.forEach(function(t) {
    if (t["tracktype"] == "AIRCRAFT") {
      aircraftCount++;
    } else if (t["tracktype"] == "SHIP") {
      shipCount++;
    } else if (t["tracktype"] == "APRS_MOBILE") {
      aprsMobileCount++;
    } else if (t["tracktype"] == "AIS_SHORE_STATION") {
      aisShoreCount++;
    } else if (t["tracktype"] == "APRS_BASE_STATION") {
      aprsBaseCount++;
    }
  });
  $("#aircraftCount").text(aircraftCount);
  $("#shipCount").text(shipCount);
  $("#aprsMobileCount").text(aprsMobileCount);
  $("#aisShoreCount").text(aisShoreCount);
  $("#aprsBaseCount").text(aprsBaseCount);
}

// Function called when an icon is clicked. Set track as selected and scroll,
// the table to it, unless it already is selected, in which case deselect.
async function iconSelect(id) {
  select(id, false);
}

// Function called when a table row is clicked. Set track as selected and pan
// the map to it.
async function tableSelect(id) {
  select(id, true);
}

// Select or deselect the given track.
// If the selection came from the table, pan the map to the selected ID;
// if the selection didn't come from the table (i.e. it came from the map),
// scroll the table to it.
async function select(id, selectionCameFromTable) {
  if (id != selectedTrackID) {
    selectedTrackID = id;
  } else {
    selectedTrackID = 0;
  }
  updateMapObjects();
  updateTrackTable();

  if (selectedTrackID != 0) {
    if (selectionCameFromTable) {
      panTo(id);
    } else {
      if ($("tr.selected") != null && $("tr.selected").get(0) != null) {
        $("tr.selected").get(0).scrollIntoView({behavior: "smooth", block: "center"});
      }
    }
  }
}

// Pan to an entity, given its ID
async function panTo(id) {
  var t = tracks.get(id);
  if (t != null && getIconPosition(t) != null) {
    map.panTo(getIconPosition(t));
  }
}

// Show or hide the "loading" indicator. When hiding, this actually
// waits one second before hiding because querying the server
// is normally very quick, and the ~100ms flash looks ugly, so
// we pad it out a bit.
async function showLoadingIndicator(show) {
  if (show) {
    $("#loading").fadeIn();
  } else {
    setTimeout(function(){ $("#loading").fadeOut(); }, 1000);
  }
}

// Shows or hides the "server offline" indicator.
async function showServerOffline(offline) {
  if (offline) {
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
  
  var symbol = getSymbolCode(t);

  // Generate symbol for display
  var mysymbol = new ms.Symbol(symbol, {
    direction: (t["heading"] != null) ? t["heading"] : "",
    altitudeDepth: (detailedSymb && t["altitude"] != null) ? "FL" + (t["altitude"] / 100).toFixed(0) : "",
    speed: (detailedSymb && t["speed"] != null) ? t["speed"].toFixed(0) + "KTS" : "",
    uniqueDesignation: (showName || detailedSymb) ? t["name"] : "",
    type: detailedSymb ? t["typeDesc"] : "",
    staffComments: detailedSymb ? t["info1"] : "",
    additionalInformation: detailedSymb ? t["info2"] : "",
    dtg: ((!t["fixed"] && t["postime"] != null && detailedSymb) ? moment(t["postime"]).utc().format("DD HHmm[Z] MMMYY").toUpperCase() : ""),
    location: detailedSymb ? (Math.abs(lat).toFixed(4).padStart(7, '0') + ((lat >= 0) ? 'N' : 'S') + " " + Math.abs(lon).toFixed(4).padStart(8, '0') + ((lon >= 0) ? 'E' : 'W')) : ""
  });

  // Styles, some of which change when the track is selected and depending on the theme
  var showSymbolLight = (darkSymbols && trackSelected(t["id"])) || (!darkSymbols && !trackSelected(t["id"]));
  var showInfoColorWhite = trackSelected(t["id"]) ? (darkSymbols ? "white" : "black") : (baseMapIsDark ? "white" : "black");
  mysymbol = mysymbol.setOptions({
    size: 30,
    civilianColor: false,
    colorMode: showSymbolLight ? "Light" : "Dark",
    fillOpacity: trackSelected(t["id"]) ? 1 : 0.6,
    infoBackground: trackSelected(t["id"]) ? (darkSymbols ? "black" : "white") : "transparent",
    infoColor: showInfoColorWhite,
    outlineWidth: trackSelected(t["id"]) ? 5 : 0,
    outlineColor: SELECTED_TRACK_HIGHLIGHT_COLOUR,
    quantity: (t["quantity"] != null) ? t["quantity"] : ""
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
    // Create marker, including default context menu (right-click)
    var m = L.marker(pos, {
      icon: icon,
      contextmenu: true,
      contextmenuItems: getContextMenuItems(t)
    });

    // Set the left-click action for the marker
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

// Generate the context menu items for a track.
function getContextMenuItems(t) {
      var contextMenuItems = [{
        text: t["name"],
        disabled: true
      }, "-", {
        text: "Select/Deselect",
        icon: "icons/select.png",
        hideOnSelect: true,
        callback: async function(result) { iconSelect(t["id"]); }
      }, {
        text: "Clear Snail Trail",
        icon: "icons/clear.png",
        hideOnSelect: true,
        callback: async function(result) { t["poshistory"] = new Array(); }
      }, "-", {
        text: "Designate Friend",
        icon: "icons/friend.png",
        hideOnSelect: true,
        callback: async function(result) { setAffiliation(t, "F"); }
      }, {
        text: "Designate Neutral",
        icon: "icons/neutral.png",
        hideOnSelect: true,
        callback: async function(result) { setAffiliation(t, "N"); }
      }, {
        text: "Designate Hostile",
        icon: "icons/hostile.png",
        hideOnSelect: true,
        callback: async function(result) { setAffiliation(t, "H"); }
      }, {
        text: "Designate Unknown",
        icon: "icons/unknown.png",
        hideOnSelect: true,
        callback: async function(result) { setAffiliation(t, "U"); }
      }];

    // Add extra actions to the context menu if required
    if (t["tracktype"] == "SHIP") {
      contextMenuItems.push("-");
      contextMenuItems.push({
        text: "Look up on MarineTraffic...",
        icon: "icons/marinetraffic.png",
        hideOnSelect: true,
        callback: async function(result) { window.open("https://www.marinetraffic.com/en/ais/details/ships/mmsi:" + t["id"]); }
      });
    } else if (t["tracktype"] == "AIRCRAFT" && !t["name"].startsWith("ICAO ")) {
      contextMenuItems.push("-");
      contextMenuItems.push({
        text: "Look up on FlightAware...",
        icon: "icons/flightaware.png",
        hideOnSelect: true,
        callback: async function(result) { window.open("https://uk.flightaware.com/live/flight/" + t["name"]); }
      });
    } else if (t["tracktype"] == "APRS_MOBILE" || t["tracktype"] == "APRS_BASE_STATION" || t["tracktype"] == "BASE_STATION") {
      contextMenuItems.push("-");
      contextMenuItems.push({
        text: "Look up on QRZ...",
        icon: "icons/qrz.png",
        hideOnSelect: true,
        callback: async function(result) { window.open("https://www.qrz.com/db/" + t["name"].split('-')[0]); }
      });
    }
    return contextMenuItems;
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
  } else if (darkSymbols) {
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
// on the map and the track table?
function shouldShowIcon(t) {
  return trackTypesVisible.includes(t["tracktype"]);
}

// Get the symbol for the track, which may be manually overridden by the
// user or set anticipated by data age.
function getSymbolCode(t) {
  var symbol = t["symbolcode"];
  // Check for symbol overrides
  if (symbolOverrides.has(t["id"])) {
    symbol = symbolOverrides.get(t["id"]);
  }
  // Change symbol to "anticipated" if old enough
  if (oldEnoughToShowAnticipated(t) && symbol.substr(3, 1) == "P") {
    symbol = symbol.substr(0, 3) + "A" + symbol.substr(4);
  }
  return symbol;
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
  if (getLastKnownPosition(t) != null && t["postime"] != null && t["course"] != null && t["speed"] != null && t["speed"] > 1.0) {
    // Can dead reckon
    var timePassedSec = getTimeInServerRefFrame().diff(t["postime"]) / 1000.0;
    var speedMps = t["speed"] * 0.514444;
    var newPos = L.GeometryUtil.destination(new L.latLng(t["lat"], t["lon"]), t["course"], timePassedSec * speedMps);
    return [newPos.lat, newPos.lng];
  } else {
    return null;
  }
}

// Get the position to show the track's icon at. Equal to either the
// last known position or the dead reckoned position, depending on
// whether DR is enabled and the data to use it is available.
function getIconPosition(t) {
  if (t["lat"] != null && t["lon"] != null) {
    if (enableDeadReckoning && t["postime"] != null && t["course"] != null && t["speed"] != null && t["speed"] > 1.0) {
      return getDRPosition(t);
    } else {
      return getLastKnownPosition(t);
    }
  } else {
    return null;
  }
}

// Is the track young enough that we should display the track age as "live"?
// This simplifies the display for the user so they don't have to think
// about "how many seconds old does it have to be before it's not live?"
// This is roughly the inverse of oldEnoughToShowAnticipated, but does not
// take into acount fixed tracks as a special case or whether dead
// reckoning is enabled.
function youngEnoughToShowLive(t) {
  var time = getBestTime(t);
  if (t["tracktype"] == "AIRCRAFT") {
    return time != null && getTimeInServerRefFrame().diff(time) <= AIR_SHOW_ANTICIPATED_AFTER_MILLISEC;
  } else {
    return time != null && getTimeInServerRefFrame().diff(time) <= SEA_LAND_SHOW_ANTICIPATED_AFTER_MILLISEC;
  }
}

// Is the track old enough that we should display the track as an anticipated
// position?
// This is roughly the inverse of youngEnoughToShowLive, but if a track is fixed
// or dead reckoning is disabled, then the track will never be shown as
// anticipated.
function oldEnoughToShowAnticipated(t) {
  var time = getBestTime(t);
  if (!enableDeadReckoning || t["fixed"]) {
    return false;
  } else if (t["tracktype"] == "AIRCRAFT") {
    return time != null && getTimeInServerRefFrame().diff(time) > AIR_SHOW_ANTICIPATED_AFTER_MILLISEC;
  } else {
    return time != null && getTimeInServerRefFrame().diff(time) > SEA_LAND_SHOW_ANTICIPATED_AFTER_MILLISEC;
  }
}

// Get the position time if it exists, otherwise get the metadata time.
// If that doesn't exist either, return null.
function getBestTime(t) {
  var time = null;
  if (t["postime"] != null) {
    time = t["postime"];
  } else if (t["datatime"] != null) {
    time = t["datatime"];
  }
  return time;
}

// Get an age for the track, formatted for display.
// This will be a normal formatted duration, unless the age is unknown,
// in which case "---" is returned, or if the track is non-fixed and
// not old enough to show as anticipated, in which case "Live" is returned
// to make clear to the user that the track is live without them having
// to worry about how many seconds old it is.
function getFormattedAge(t) {
  var time = getBestTime(t);
  if (time == null) {
    return "---";
  } else {
    if (youngEnoughToShowLive(t)) {
      return "Live";
    } else {
      return getFormattedDuration(getTimeInServerRefFrame().valueOf() - time, false);
    }
  }
}

// Get a duration formatted for display
function getFormattedDuration(millis, long) {
  if (millis < 60000) {
    return Math.floor(millis / 1000) + (long ? " seconds" : "s");
  } else if (millis < 3600000) {
    return Math.floor(millis / 60000) + (long ? " minutes" : "m");
  } else if (millis < 172800000) {
    return Math.floor(millis / 3600000) + (long ? " hours" : "h");
  } else {
    return Math.floor(millis / 86400000) + (long ? " days" : "d");
  }
}

// Designate track as a new affiliation. Must be a MIL-STD2525 affiliation character
// e.g. "H" = hostile.
async function setAffiliation(t, aff) {
  var symbol = t["symbolcode"];
  if (symbol != null && symbol.length > 4) {
    // Always store "present" version of the symbol, not anticipated
    symbol = symbol.substr(0, 1) + aff + symbol.substr(2, 1) + "P" + symbol.substr(4);
    symbolOverrides.set(t["id"], symbol);
  }
  updateMapObjects();
  localStorage.setItem('symbolOverrides', JSON.stringify(Array.from(symbolOverrides)));
}


/////////////////////////////
//    UTILITY FUNCTIONS    //
/////////////////////////////

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

function setLightUI() {
  localStorage.setItem('darkUI', false);
  document.documentElement.setAttribute("color-mode", "light");
  var metaThemeColor = document.querySelector("meta[name=theme-color]");
  metaThemeColor.setAttribute("content", "#DDDDB9");
}

function setDarkUI() {
  localStorage.setItem('darkUI', true);
  document.documentElement.setAttribute("color-mode", "dark");
  var metaThemeColor = document.querySelector("meta[name=theme-color]");
  metaThemeColor.setAttribute("content", "#2C2C25");
}

function setLightSymbols() {
  darkSymbols = false;
  localStorage.setItem('darkSymbols', false);
  updateMapObjects();
}

function setDarkSymbols() {
  darkSymbols = true;
  localStorage.setItem('darkSymbols', true);
  updateMapObjects();
}

function setBasemap(basemapname) {
  localStorage.setItem('basemap', JSON.stringify(basemapname));
  if (typeof backgroundTileLayer !== 'undefined') {
    map.removeLayer(backgroundTileLayer);
  }
  backgroundTileLayer = L.tileLayer.provider(basemapname, {
    opacity: basemapOpacity,
    edgeBufferTiles: 1
  });
  backgroundTileLayer.addTo(map);

  // Identify dark basemaps to ensure we use white text for unselected icons
  // and change the background colour appropriately
  baseMapIsDark = (basemapname == "CartoDB.DarkMatter" || basemapname == "Esri.WorldImagery");
  $("#map").css('background-color', baseMapIsDark ? "black" : "white");

  updateMapObjects();
}

function setBasemapOpacity(opacity) {
  basemapOpacity = opacity;
  localStorage.setItem('basemapOpacity', JSON.stringify(opacity));
  if (typeof backgroundTileLayer !== 'undefined') {
    backgroundTileLayer.setOpacity(opacity);
  }
}


/////////////////////////////
//       MAP SETUP         //
/////////////////////////////

// Create map
var map = L.map('map', {
  zoomControl: false,
  contextmenu: true
})
// Set initial view. Zoom out one level if on mobile
var startZoom = START_ZOOM;
var screenWidth = (window.innerWidth > 0) ? window.innerWidth : screen.width;
if (screenWidth <= 600) {
  startZoom--;
}
map.setView(START_LAT_LON, startZoom);

// Add main marker layer
var markersLayer = new L.LayerGroup();
markersLayer.addTo(map);

// Add snail trail layers
var snailTrailLayer = new L.LayerGroup();
snailTrailLayer.addTo(map);
var drSnailTrailLayer = new L.LayerGroup();
drSnailTrailLayer.addTo(map);

// Zooming affects the level of detail shown on icons, so we need to update the map
// on a zoom change.
map.on("zoomend", function (e) { updateMapObjects(); });


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
  localStorage.setItem('trackTypesVisible', JSON.stringify(trackTypesVisible));
  updateMapObjects();
}

$("#showAircraft").change(function() {
  setTypeEnable("AIRCRAFT", $(this).is(':checked'));
});
$("#showShips").change(function() {
  setTypeEnable("SHIP", $(this).is(':checked'));
});
$("#showAISShoreStations").change(function() {
  setTypeEnable("AIS_SHORE_STATION", $(this).is(':checked'));
});
$("#showATONs").change(function() {
  setTypeEnable("AIS_ATON", $(this).is(':checked'));
});
$("#showAPRSMobile").change(function() {
  setTypeEnable("APRS_MOBILE", $(this).is(':checked'));
});
$("#showAPRSBase").change(function() {
  setTypeEnable("APRS_BASE_STATION", $(this).is(':checked'));
});
$("#showAirports").change(function() {
  setTypeEnable("AIRPORT", $(this).is(':checked'));
});
$("#showSeaPorts").change(function() {
  setTypeEnable("SEAPORT", $(this).is(':checked'));
});
$("#showBase").change(function() {
  setTypeEnable("BASE_STATION", $(this).is(':checked'));
});

// Colour themes
$("#lightUIButton").click(setLightUI);
$("#darkUIButton").click(setDarkUI);
$("#lightSymbolButton").click(setLightSymbols);
$("#darkSymbolButton").click(setDarkSymbols);

// Dead reckoning
$("#enableDR").change(function() {
  enableDeadReckoning = $(this).is(':checked');
  localStorage.setItem('enableDeadReckoning', enableDeadReckoning);
  updateMapObjects();
});

// Snail trails
$("#snailTrails").change(function() {
  snailTrailMode = parseInt($(this).val());
  localStorage.setItem('snailTrailMode', snailTrailMode);
  updateMapObjects();
});
$("#snailTrailLength").change(function() {
  snailTrailLength = parseInt($(this).val());
  localStorage.setItem('snailTrailLength', snailTrailLength);
  trimPositionHistory();
  updateMapObjects();
});

// Basemap
$("#basemap").change(function() {
  setBasemap($(this).val());
});
$("#basemapOpacity").change(function() {
  setBasemapOpacity($(this).val());
});

// Overlay layers
$("#showAirspaceLayer").change(function() {
  if ($(this).is(':checked')) {
    airspaceLayer = L.tileLayer.provider('OpenAIP')
    airspaceLayer.addTo(map);
  } else if (typeof airspaceLayer !== 'undefined') {
    map.removeLayer(airspaceLayer);
  }
  localStorage.setItem('showAirspaceLayer', $(this).is(':checked'));
});
$("#showMaritimeLayer").change(function() {
  if ($(this).is(':checked')) {
    maritimeLayer = L.tileLayer.provider('OpenSeaMap');
    maritimeLayer.addTo(map);
  } else if (typeof maritimeLayer !== 'undefined') {
    map.removeLayer(maritimeLayer);
  }
  localStorage.setItem('showMaritimeLayer', $(this).is(':checked'));
});

// LAN mode switch
$("#lanMode").change(function() {
  lanMode = $(this).is(':checked');
  localStorage.setItem('lanMode', lanMode);
  fetchDataFirst();
});

// Show Telemetry switch
$("#showTelemetry").change(function() {
  showTelemetry = $(this).is(':checked');
  localStorage.setItem('showTelemetry', showTelemetry);
  if (showTelemetry) {
    $("#telemetry").show();
    fetchTelemetry();
    // Go to the info panel as presumably you wanted to see it
    manageRightBoxes("#infoPanel", "#configPanel", "#trackTablePanel");
  } else {
    $("#telemetry").hide();
  }
});

// Table row click selects the track
$(document).on("click", "tr", function(e) {
  tableSelect($(e.currentTarget).attr("trackID"));
});


/////////////////////////////
// LOCAL STORAGE FUNCTIONS //
/////////////////////////////

// Load from local storage or use default
function localStorageGetOrDefault(key, defaultVal) {
  var valStr = localStorage.getItem(key);
  if (null === valStr) {
    return defaultVal;
  } else {
    return JSON.parse(valStr);
  }
}

// Load from local storage and set GUI up appropriately
function loadLocalStorage() {
  if (localStorage.length == 0) {
    firstVisit = true;
  }

  var darkUI = localStorageGetOrDefault('darkUI', true);
  darkSymbols = localStorageGetOrDefault('darkSymbols', true);
  var basemap = localStorageGetOrDefault('basemap', "CartoDB.DarkMatter");
  basemapOpacity = localStorageGetOrDefault('basemapOpacity', 1);
  enableDeadReckoning = localStorageGetOrDefault('enableDeadReckoning', enableDeadReckoning);
  snailTrailMode = localStorageGetOrDefault('snailTrailMode', snailTrailMode);
  snailTrailLength = localStorageGetOrDefault('snailTrailLength', snailTrailLength);
  lanMode = localStorageGetOrDefault('lanMode', lanMode);
  showTelemetry = localStorageGetOrDefault('showTelemetry', showTelemetry);
  trackTypesVisible = localStorageGetOrDefault('trackTypesVisible', trackTypesVisible);
  var showAirspaceLayer = localStorageGetOrDefault('showAirspaceLayer', false);
  var showMaritimeLayer = localStorageGetOrDefault('showMaritimeLayer', false);
  symbolOverrides = new Map(localStorageGetOrDefault('symbolOverrides', symbolOverrides));

  if (darkUI) {
    setDarkUI();
  } else {
    setLightUI();
  }
  if (darkSymbols) {
    setDarkSymbols();
  } else {
    setLightSymbols();
  }
  setBasemap(basemap);
  $("#basemap").val(basemap);
  setBasemapOpacity(basemapOpacity);
  $("#basemapOpacity").val(basemapOpacity);

  if (showTelemetry) {
    $("#telemetry").show();
  } else {
    $("#telemetry").hide();
  }

  $("#enableDR").prop('checked', enableDeadReckoning);
  $("#snailTrails").val(snailTrailMode);
  $("#snailTrailLength").val(snailTrailLength);
  $("#lanMode").prop('checked', lanMode);
  $("#showTelemetry").prop('checked', showTelemetry);

  $("#showAircraft").prop('checked', trackTypesVisible.includes("AIRCRAFT"));
  $("#showShips").prop('checked', trackTypesVisible.includes("SHIP"));
  $("#showAISShoreStations").prop('checked', trackTypesVisible.includes("AIS_SHORE_STATION"));
  $("#showATONs").prop('checked', trackTypesVisible.includes("AIS_ATON"));
  $("#showAPRSMobile").prop('checked', trackTypesVisible.includes("APRS_MOBILE"));
  $("#showAPRSBase").prop('checked', trackTypesVisible.includes("APRS_BASE_STATION"));
  $("#showAirports").prop('checked', trackTypesVisible.includes("AIRPORT"));
  $("#showSeaPorts").prop('checked', trackTypesVisible.includes("SEAPORT"));
  $("#showBase").prop('checked', trackTypesVisible.includes("BASE_STATION"));

  $("#showAirspaceLayer").prop('checked', showAirspaceLayer).change();
  $("#showMaritimeLayer").prop('checked', showMaritimeLayer).change();
}


/////////////////////////////
//        KICK-OFF         //
/////////////////////////////

loadLocalStorage();
fetchDataFirst();
fetchTelemetry();
setInterval(fetchDataUpdate, QUERY_SERVER_INTERVAL_MILLISEC);
setInterval(fetchTelemetry, QUERY_SERVER_TELEMETRY_INTERVAL_MILLISEC);
setInterval(updateMap, UPDATE_MAP_INTERVAL_MILLISEC);
$("#clientVersion").text(VERSION);
setTimeout(function(){ $("#appname").fadeOut(); }, 8000);

// Show info if this is a user's first visit
if (firstVisit) {
  manageRightBoxes("#infoPanel", "#configPanel", "#trackTablePanel");
}
