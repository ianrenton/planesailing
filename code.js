/////////////////////////////
//      GLOBAL VARS        //
/////////////////////////////

// You can provide a main and alternate URL, e.g. one for use from the public internet
// and one for use when you are on the same LAN as the machine running the servers.
// Select the alternate URL by appending ?alt=true to the URL for Plane Sailing.
// Normal users won't do this and will therefore use the main public URL, but you
// can bookmark the "alt" version to always use your LAN address for testing.
const DUMP1090_URL = ((window.location.protocol == "https:") ? "https:" : "http:") + "//mciserver.zapto.org/dump1090-fa/";
const DUMP1090_URL_ALT = "http://192.168.1.241/dump1090-fa/";
const AIS_DISPATCHER_KML_URL = ((window.location.protocol == "https:") ? "https:" : "http:") + "//mciserver.zapto.org/ais/aisDispatcherSnapshot.kml";
const AIS_DISPATCHER_KML_URL_ALT = "http://192.168.1.241/ais/aisDispatcherSnapshot.kml";

// Map layer URL - formerly using Mapbox, but had to switch to a free option
// due to excess use! (Nice problems to have I guess.)
const MAP_URL = ((window.location.protocol == "https:") ? "https:" : "http:") + "//tile.stamen.com/terrain-background/{z}/{x}/{y}.jpg";

// CheckWX API key, used to retrieve airport METAR/TAF
const CHECKWX_API_KEY = "cffedc0990104f23b3486c67ad";

// Map default position/zoom
const START_LAT_LON = [50.68, -1.9];
const START_ZOOM = 11;

// Base station / airports / seaports
const BASE_STATION = {name: "M7BGT (Base Station)", lat: 50.75128, lon: -1.90168, firstDescrip: "PiAware + Dump1090-fa 4.0", secondDescrip: "rtl_ais + aisdespatcher"};
const AIRPORTS = [
  {name: "Bournemouth Airport", lat: 50.78055, lon: -1.83938, icaoCode: "EGHH"},
  {name: "Southampton Airport", lat: 50.95177, lon: -1.35625, icaoCode: "EGHI"},
  {name: "Bristol Airport", lat: 51.38363, lon: -2.71574, icaoCode: "EGGD"},
  {name: "London Heathrow Airport", lat: 51.46999, lon: -0.45470, icaoCode: "EGLL"}
];
const SEAPORTS = [
  {name: "Port of Poole", lat: 50.70796, lon: -1.99495},
  {name: "Southampton Docks", lat: 50.89871, lon: -1.41198},
  {name: "Portland Port", lat: 50.56768, lon: -2.43635},
  {name: "Portsmouth Port", lat: 50.81206, lon: -1.09251}
];

// More globals - you should not have to edit beyond this point unless you want
// to change how the software works!
const MACH_TO_KNOTS = 666.739;
const KNOTS_TO_MPS = 0.514444;
const DEFAULT_AIRCRAFT_SYMBOL = "SUAPCF----";
const DEFAULT_SHIP_SYMBOL = "SUSP------";
const BASE_STATION_SYMBOL = "SFGPUUS-----";
const AIRPORT_SYMBOL = "SFGPIBA---H";
const SEAPORT_SYMBOL = "SFGPIBN---H-";
const types = {
    AIRCRAFT: 'aircraft',
    SHIP: 'ship',
    AIRPORT: 'airport',
    SEAPORT: 'seaport',
    BASE: 'base'
}
const AIRCRAFT_CATEGORY_TO_DESCRIPTION = new Map([
  ["A0", ""],
  ["A1", "Light"],
  ["A2", "Small"],
  ["A3", "Large"],
  ["A4", "High Vortex"],
  ["A5", "Heavy"],
  ["A6", "High Perf"],
  ["A7", "Rotary Wing"],
  ["B0", ""],
  ["B1", "Glider"],
  ["B2", "Lighter-than-Air"],
  ["B3", "Para"],
  ["B4", "Ultralight"],
  ["B5", ""],
  ["B6", "UAV"],
  ["B7", "Space"],
  ["C0", ""],
  ["C1", "Emergency Veh."],
  ["C2", "Service Veh."],
  ["C3", "Obstruction"]
]);
const AIRCRAFT_CATEGORY_TO_SYMBOL = new Map([
  ["A0", "SUAPCF----"],
  ["A1", "SUAPCF----"],
  ["A2", "SUAPCF----"],
  ["A3", "SUAPCF----"],
  ["A4", "SUAPCF----"],
  ["A5", "SUAPCF----"],
  ["A6", "SUAPCF----"],
  ["A7", "SUAPCH----"],
  ["B0", "SUAPC-----"],
  ["B1", "SUAPC-----"],
  ["B2", "SUAPCL----"],
  ["B3", "SUAPC-----"],
  ["B4", "SUAPC-----"],
  ["B5", "SUAPC-----"],
  ["B6", "SUAPMFQ---"],
  ["B7", "SUPPL-----"],
  ["C0", "SUGP------"],
  ["C1", "SUGP------"],
  ["C2", "SUGP------"],
  ["C3", "SUGP------"]
]);
const SHIP_TYPE_TO_SYMBOL = new Map([
  ["Unknown", "SUSPX-------"],
  ["Passenger ship", "SUSPXMP-----"],
  ["Pleasure craft", "SUSPXR------"],
  ["Sailing vessel", "SUSPXR------"],
  ["Cargo ship", "SUSPXMC-----"],
  ["Cargo ship (HAZ-A)", "SUSPXMH-----"],
  ["Cargo ship (HAZ-B)", "SUSPXMH-----"],
  ["Cargo ship (HAZ-C)", "SUSPXMH-----"],
  ["Cargo ship (HAZ-D)", "SUSPXMH-----"],
  ["Tanker", "SUSPXMO-----"],
  ["Tanker (HAZ-A)", "SUSPXMH-----"],
  ["Tanker (HAZ-B)", "SUSPXMH-----"],
  ["Tanker (HAZ-C)", "SUSPXMH-----"],
  ["Tanker (HAZ-D)", "SUSPXMH-----"],
  ["Tug", "SUSPXMTU----"],
  ["Military ops", "SFSPC-------"],
  ["HSC", "SUSPXMP-----"]
]);
var entities = new Map(); // uid -> Entity
var dump1090HistoryStore = [];
var showTypes = [types.AIRCRAFT, types.SHIP, types.AIRPORT, types.SEAPORT, types.BASE];
var darkTheme = true;
var clockOffset = 0; // Local PC time (UTC) minus data time. Used to prevent data appearing as too new or old if the local PC clock is off.
var selectedEntityUID = "";
var snailTrailLength = 500;
var deadReckonTimeMS = 1000; // Fixed on a very short time to always show dead reckoned position, like FlightRadar24
var showAirAnticipatedTimeMS = 60000; // 60 sec
var showShipAnticipatedTimeMS = 300000; // 5 min
var dropAirTrackTimeMS = 300000; // 5 min
var dropAirTrackAtZeroAltTimeMS = 10000; // Drop tracks at zero altitude sooner because they've likely landed, dead reckoning far past the airport runway looks weird
var dropMovingShipTrackTimeMS = 3600000; // 1 hour
var dropStaticShipTrackTimeMS = 172800000; // 2 days


/////////////////////////////
//        CLASSES          //
/////////////////////////////

// Entity class.
// Altitude is stored in feet, heading/lat/lon in degrees, speed in knots.
class Entity {
  // ICAO Hex code (aircraft) or MMSI (ship)
  uid = null;
  // Type (aircraft, ship etc.)
  type = null;
  // Flight ID (aircraft) or vessel name (ship)
  name = null;
  // Position history
  positionHistory = [];
  // Heading (deg)
  heading = null;
  // Course (deg)
  course = null;
  // Altitude (ft) (aircraft only)
  altitude = null;
  // Altitude rate (ft/s) (aircraft only)
  altRate = null;
  // Speed (knots)
  speed = null;
  // Registration / tail number (aircraft only)
  registration = null;
  // Callsign (ship only)
  callsign = null;
  // Squawk (4 digit octal) (aircraft only)
  squawk = null;
  // Mode S category (A0, A1...) (aircraft only)
  modeSCategory = null;
  // Vessel/cargo type number (ship only)
  vesselCargoType = null;
  // Aircraft type derived from database lookup (aircraft only)
  icaoType = null;
  // Navigation status (ship only)
  navStatus = null;
  // Destination (ship only unless we get from FlightAware/FlightRadar API in future)
  destination = null;
  // Fixed first description line (base/airport only)
  fixedFirstDescrip = null;
  // Fixed second description line (base/airport only)
  fixedSecondDescrip = null;
  // Received signal strength (dB)
  rssi = null;
  // Last time any data was updated
  updateTime = null;
  // Last time position was updated
  posUpdateTime = null;
  // Last time altitude rate was updated (aircraft only)
  altRateUpdateTime = null;

  // Create new entity
  constructor(uid, type) {
    this.uid = uid;
    this.type = type;
    if (type == types.AIRCRAFT) {
      this.getDump1090Metadata();
    }
  }

  // Get metadata based on the ICAO hex code, using functions from
  // dump1090
  getDump1090Metadata() {
    getAircraftData(this.uid, dump1090url).done(function(data) {
      if ("r" in data) {
        this.registration = data.r.trim();
      }
      if ("t" in data) {
        this.icaoType = data.t.trim();
      }
      if ("desc" in data) {
        this.typeDescription = data.desc.trim();
      }
      if ("wtc" in data) {
        this.wtc = data.wtc.trim();
      }
    }.bind(this));
  }

  // internalise data from the provided Dump1090 aircraft object into the Entity
  internaliseFromDump1090(a, dataTime) {
    // Get "best" versions of some parameters that have multiple variants
    // conveying similar information
    var bestHeading = a.track;
    if (a.mag_heading != null) {
      bestHeading = a.mag_heading;
    }
    if (a.true_heading != null) {
      bestHeading = a.true_heading;
    }
    var bestAlt = a.alt_geom;
    if (a.alt_baro != null) {
      bestAlt = a.alt_baro;
    }
    var bestAltRate = a.geom_rate / 60.0;
    if (a.baro_rate != null) {
      bestAltRate = a.baro_rate / 60.0;
    }
    var bestSpeed = null;
    if (a.mach != null) {
      bestSpeed = a.mach * MACH_TO_KNOTS;
    }
    if (a.ias != null) {
      bestSpeed = a.ias;
    }
    if (a.tas != null) {
      bestSpeed = a.tas;
    }
    if (a.gs != null) {
      bestSpeed = a.gs;
    }

    // Update time adjustment
    var seen = moment.unix(dataTime).utc();
    if (a.seen != null) {
      seen = seen.subtract(a.seen, 'seconds');
    }
    var posSeen = null;
    if (a.lat != null) {
      posSeen = moment.unix(dataTime).utc();
      if (a.seen_pos != null) {
        posSeen = posSeen.subtract(a.seen_pos, 'seconds');
      }
    }

    // Set internal variables
    this.rssi = a.rssi;
    this.updateTime = seen;

    if (a.lat != null) {
      this.addPosition(a.lat, a.lon);
    }
    if (bestHeading != null) {
      this.heading = bestHeading;
      this.course = bestHeading; // We can assume no significant course/heading difference for planes
    }
    if (bestAlt != null) {
      this.altitude = bestAlt;
    }
    if (bestAltRate != null) {
      this.altRate = bestAltRate;
      this.altRateUpdateTime = seen;
    }
    if (a.mach != null) {
      this.speed = bestSpeed;
    }
    if (a.flight != null) {
      this.name = a.flight.trim();
    }
    if (a.squawk != null) {
      this.squawk = a.squawk;
    }
    if (a.category != null) {
      this.modeSCategory = a.category.trim();
    }
    if (posSeen != null) {
      this.posUpdateTime = posSeen;
    }
  }

  // internalise data from the AIS data provided as a KML placemark into the Entity
  internaliseFromAIS(placemark) {
    // Name and position are contained nicely within the placemark XML
    var name = placemark.getElementsByTagName("name")[0].childNodes[0].nodeValue.trim();
    var posString = placemark.getElementsByTagName("Point")[0].getElementsByTagName("coordinates")[0].childNodes[0].nodeValue.trim()
    var posBits = posString.split(",");
    if (posBits.length >= 2) {
      var lon = posBits[0];
      var lat = posBits[1];
    }
    // Then... we have the "description" which is an HTML table containing
    // the rest of the data we need. We use a second XML parser to deal with that.
    // Entries are always present and always in the same order thankfully!
    var description = placemark.getElementsByTagName("description")[0].childNodes[0].nodeValue;
    var parser = new DOMParser();  
    var table = parser.parseFromString(description, 'text/xml');
    var cells = table.getElementsByTagName("td");
    var lastSeenStr = cells[1].childNodes[0].data;
    var mmsi = cells[5].childNodes[0].data.trim();
    var callsign = cells[7].childNodes[0] ? cells[7].childNodes[0].data : "";
    var vesselType = cells[11].childNodes[0].data;
    var navstat = cells[13].childNodes[0].data;
    var destination = cells[15].childNodes[0] ? cells[15].childNodes[0].data.trim() : "";
    var speedStr = cells[21].childNodes[0] ? cells[21].childNodes[0].data.replace("kts", "") : "";
    var courseStr = cells[23].childNodes[0] ? cells[23].childNodes[0].data.replace("°", "") : "";
    var headingStr = cells[25].childNodes[0] ? cells[25].childNodes[0].data.replace("°", "") : "";

    // Prepend "MMSI" to track names that are just an MMSI not a real vessel name
    if (name == mmsi) {
      name = "MMSI " + mmsi;
    }
    this.name = name;

    // Handle true age of track
    if (lastSeenStr) {
      var lastSeen = moment.utc(lastSeenStr.replace(" UTC",""), 'DD-MM-YYYY hh:mm:ss a');
      if (lastSeen.year() < 2020) {
        // Clearly a junk date, use "now"
        lastSeen = moment().utc();
      }
      this.updateTime = lastSeen;
      this.posUpdateTime = lastSeen; // AIS Dispatcher data doesn't distinguish between "last seen" and "position last recorded"
    }

    if (lat) {
      this.addPosition(parseFloat(lat), parseFloat(lon));
    }
    if (speedStr) {
      var speed = parseFloat(speedStr);
      // If < 2 knots treat this as "no speed", to prevent long-term drift of dead reckoned
      // anchored vessels
      if (speed >= 2) {
        this.speed = speed;
      } else {
        this.speed = null;
      }
    }
    if (courseStr) {
      var course = parseFloat(courseStr);
      if (course != 511) {
        this.course = course;
      } else {
        this.course = null;
      }
    }
    if (headingStr) {
      var heading = parseFloat(headingStr);
      if (heading != 511) {
        this.heading = heading;
      } else {
        this.heading = null;
      }
    }

    this.callsign = callsign;
    this.vesselCargoType = vesselType;
    this.navStatus = navstat;
    this.destination = destination;
  }

  // Update its position, adding to the history
  addPosition(lat, lon) {
    // Trim the snail trail if required
    this.trimSnailTrail();

    // Add the new entry
    this.positionHistory.push([lat, lon]);
  }

  // Get the latest known position
  position() {
    return this.positionHistory[this.positionHistory.length - 1];
  }

  // Get the dead reckoned position based on its last position update plus
  // course and speed at that time
  drPosition() {
    if (this.position() != null && this.posUpdateTime != null && this.speed != null && this.course != null) {
      // Can dead reckon
      var timePassedSec = getTimeInServerRefFrame().diff(this.posUpdateTime) / 1000.0;
      var speedMps = this.speed * KNOTS_TO_MPS;
      var newPos = destVincenty(this.position()[0], this.position()[1], this.course, timePassedSec * speedMps);
      return newPos;
    } else {
      return null;
    }
  }

  // Get the latest known altitude to the nearest 100 ft (air only)
  getAltitude() {
    if (this.altitude != null && !isNaN(this.altitude)) {
      return Math.max(0, (this.altitude / 100).toFixed(0) * 100);
    } else {
      return null;
    }
  }

  // Get the dead reckoned altitude based on its last altitude update plus
  // altitude rate at that time (air only)
  drAltitude() {
    if (this.altitude != null && !isNaN(this.altitude) && this.altRateUpdateTime != null && this.altRate != null) {
      // Can dead reckon
      var timePassedSec = getTimeInServerRefFrame().diff(this.posUpdateTime) / 1000.0;
      var drAlt = this.altitude + (this.altRate * timePassedSec);
      return Math.max(0, (drAlt / 100).toFixed(0) * 100);
    } else {
      return null;
    }
  }

  // Gets a position for the icon, either position() or drPosition() as required
  iconPosition() {
    var pos = this.position();
    // If we are dead reckoning position, use that instead to place the marker
    if (this.oldEnoughToDR() && this.drPosition() != null) {
      pos = this.drPosition();
    }
    return pos;
  }

  // Gets an altitude for the icon, either getAltitude() or drAltitude() as required (air only)
  iconAltitude() {
    var alt = this.getAltitude();
    if (this.oldEnoughToDR() && this.drAltitude() != null && !isNaN(this.drAltitude())) {
      alt = this.drAltitude();
    }
    return alt;
  }

  // Based on the type, is this considered a fixed entity (airport, sea port or
  // base station)?
  fixed() {
    return this.type == types.AIRPORT || this.type == types.SEAPORT || this.type == types.BASE;
  }

  // Is the track old enough that we should display the track as an anticipated
  // position?
  oldEnoughToShowAnticipated() {
    if (this.fixed()) {
      return false;
    } else if (this.type == types.AIRCRAFT) {
      return this.posUpdateTime != null && getTimeInServerRefFrame().diff(this.posUpdateTime) > showAirAnticipatedTimeMS;
    } else if (this.type == types.SHIP) {
      return this.posUpdateTime != null && getTimeInServerRefFrame().diff(this.posUpdateTime) > showShipAnticipatedTimeMS;
    }
  }

  // Is the track old enough that we should dead reckon the position?
  oldEnoughToDR() {
    return !this.fixed() && this.posUpdateTime != null && getTimeInServerRefFrame().diff(this.posUpdateTime) > deadReckonTimeMS;
  }

  // Is the track old enough that we should drop it?
  oldEnoughToDelete() {
    if (this.fixed()) {
      return false;
    } else if (this.type == types.AIRCRAFT) {
      return getTimeInServerRefFrame().diff(this.updateTime) > dropAirTrackTimeMS || (this.iconAltitude() <= 0 && getTimeInServerRefFrame().diff(this.updateTime) > dropAirTrackAtZeroAltTimeMS);
    } else if (this.type == types.SHIP) {
      return getTimeInServerRefFrame().diff(this.updateTime) > dropStaticShipTrackTimeMS || (this.speed != null && getTimeInServerRefFrame().diff(this.updateTime) > dropMovingShipTrackTimeMS);
    }
  }

  // Based on the selected type filters, should we be displaying this entity
  // on the map?
  shouldShowIcon() {
    return showTypes.includes(this.type);
  }

  // Generate the name for display on the map. Prefer vessel name/flight ID, then registration (tail number),
  // finally just the MMSI/ICAO hex code
  mapDisplayName() {
    if (this.name != null && this.name != "") {
      return this.name;
    } else if (this.registration != null && this.registration != "") {
      return this.registration;
    } else {
      return "ICAO " + this.uid;
    }
  }

  // Generate a "sub type" for display in the map. Note this is different from
  // the top level "type" (aircraft, ship etc.) and gives more detail.
  // In descending preference order, for aircraft:
  // 1) Use the full name e.g. "BOEING 747", if we have it in our hard-coded
  // table and if we have a proper ICAO type for the plane due to the dump1090
  // database lookup
  // 2) If we have an ICAO type and category, but it's not in our hard-coded
  //    table, show those e.g. "B747 (HEAVY)"
  // 3) If we have ICAO type but not category, display that e.g. "B747"
  // 4) If we have a category only, show that e.g. "(A4 HEAVY)"
  // 5) Otherwise show nothing.
  // For ships:
  // 1) Show the AIS cargo/vessel type, if known
  // 2) Otherwise show nothing.
  mapDisplaySubType() {
    var type = ""
    if (this.type == types.AIRCRAFT) {
      if (this.icaoType != null && this.icaoType != "") {
        if (AIRCRAFT_TYPE_DESIGNATORS.has(this.icaoType)) {
          type= AIRCRAFT_TYPE_DESIGNATORS.get(this.icaoType);
        } else {
          type = this.icaoType;
          if (this.modeSCategory != null && this.modeSCategory != "" && AIRCRAFT_CATEGORY_TO_DESCRIPTION.has(this.modeSCategory) && AIRCRAFT_CATEGORY_TO_DESCRIPTION.get(this.modeSCategory) != "") {
            type = type + " (" + AIRCRAFT_CATEGORY_TO_DESCRIPTION.get(this.modeSCategory) + ")";
          }
        }
      } else if (this.modeSCategory != null && this.modeSCategory != "") {
        type = "(" + this.modeSCategory;
        if (AIRCRAFT_CATEGORY_TO_DESCRIPTION.has(this.modeSCategory) && AIRCRAFT_CATEGORY_TO_DESCRIPTION.get(this.modeSCategory) != "") {
          type = type + " " + AIRCRAFT_CATEGORY_TO_DESCRIPTION.get(this.modeSCategory);
        }
        type = type + ")";
      }
    } else if (this.type == types.SHIP) {
      if (this.vesselCargoType != "Unknown") {
        type = this.vesselCargoType;
      } else {
        type = "Ship (Unknown Type)"
      }
    }
    return type;
  }

  // Generate symbol code
  symbolCode() {
    if (this.type == types.BASE) {
      return BASE_STATION_SYMBOL;
    } else if (this.type == types.AIRPORT) {
      return AIRPORT_SYMBOL;
    } else if (this.type == types.SEAPORT) {
      return SEAPORT_SYMBOL;
    } else if (this.type == types.AIRCRAFT) {
      // Generate symbol based on airline code and/or category
      var airlineCode = this.airlineCode();
      var symbol = DEFAULT_AIRCRAFT_SYMBOL;
      if (airlineCode != null && AIRLINE_CODE_SYMBOLS.has(airlineCode)) {
        symbol = AIRLINE_CODE_SYMBOLS.get(airlineCode);
      } else if (this.modeSCategory != null && AIRCRAFT_CATEGORY_TO_SYMBOL.has(this.modeSCategory)) {
        symbol = AIRCRAFT_CATEGORY_TO_SYMBOL.get(this.modeSCategory);
      }

      // Change symbol to "anticipated" if old enough
      if (this.oldEnoughToShowAnticipated()) {
        symbol = symbol.substr(0, 3) + "A" + symbol.substr(4);
      }
      return symbol;
    } else {
      // Generate symbol based on ship/cargo type
      var symbol = DEFAULT_SHIP_SYMBOL;
      if (this.vesselCargoType != null && SHIP_TYPE_TO_SYMBOL.has(this.vesselCargoType)) {
        symbol = SHIP_TYPE_TO_SYMBOL.get(this.vesselCargoType);
      }

      // Change symbol to "anticipated" if old enough
      if (this.oldEnoughToShowAnticipated()) {
        symbol = symbol.substr(0, 3) + "A" + symbol.substr(4);
      }
      return symbol;
    }
  }

  // Generate first "description" line. This can be either fixed (for base,
  // airport & port which never change) or the entity "sub type" descriptor
  // generated from data (e.g. "Boeing 747" or "Passenger Ship").
  firstDescrip() {
    if (this.fixedFirstDescrip != null) {
      return this.fixedFirstDescrip;
    } else {
      return this.mapDisplaySubType();
    }
  }

  // Generate second "description" line. This can be either fixed (for base,
  // airport & port which never change) or a descriptor generated from data
  // (e.g. airline name or COLREGS state).
  secondDescrip() {
    if (this.fixedSecondDescrip != null) {
      return this.fixedSecondDescrip;
    } else if (this.type == types.AIRCRAFT) {
      var airline = "";
      var airlineCode = this.airlineCode();
      if (airlineCode != null) {
        if (AIRLINE_CODES.has(airlineCode)) {
          airline = AIRLINE_CODES.get(airlineCode);
        }
      }
      return airline;
    } else {
      var descrip = this.navStatus;
      if (this.destination) {
        descrip += " - DEST: " + this.destination;
      }
      return descrip;
    }
  }

  // Get the airline code from the flight name (air only)
  airlineCode() {
    if (this.name != null && this.name != "") {
      var matches = /^[a-zA-Z]*/.exec(this.name.trim());
      return matches[0].toUpperCase();
    }
    return null;
  }

  // Generate a Milsymbol icon for the entity
  icon() {
    // No point returning an icon if we don't know where to draw it
    if (this.iconPosition() == null) {
      return null;
    }

    // Get position for display
    var lat = this.iconPosition()[0];
    var lon = this.iconPosition()[1];

    // Generate full symbol for display
    var detailedSymb = this.entitySelected();
    var mysymbol = new ms.Symbol(this.symbolCode(), {
      staffComments: (detailedSymb && this.firstDescrip()) ? this.firstDescrip().toUpperCase() : "",
      additionalInformation: (detailedSymb && this.secondDescrip()) ? this.secondDescrip().toUpperCase() : "",
      direction: (this.heading != null) ? this.heading : "",
      altitudeDepth: (this.iconAltitude() != null && detailedSymb) ? ("FL" + this.iconAltitude() / 100) : "",
      speed: (this.speed != null && detailedSymb) ? (this.speed.toFixed(0) + "KTS") : "",
      type: this.mapDisplayName().toUpperCase(),
      dtg: ((!this.fixed() && this.posUpdateTime != null && detailedSymb) ? this.posUpdateTime.utc().format("DD HHmm[Z] MMMYY").toUpperCase() : ""),
      location: detailedSymb ? (Math.abs(lat).toFixed(4).padStart(7, '0') + ((lat >= 0) ? 'N' : 'S') + " " + Math.abs(lon).toFixed(4).padStart(8, '0') + ((lon >= 0) ? 'E' : 'W')) : ""
    });
    // Styles, some of which change when the entity is selected and depending on the theme
    var showLight = (darkTheme && this.entitySelected()) || (!darkTheme && !this.entitySelected());
    mysymbol = mysymbol.setOptions({
      size: 30,
      civilianColor: false,
      colorMode: showLight ? "Light" : "Dark",
      fillOpacity: this.entitySelected() ? 1 : 0.6,
      infoBackground: this.entitySelected() ? (darkTheme ? "black" : "white") : "transparent",
      infoColor: darkTheme ? "white" : "black",
      outlineWidth: this.entitySelected() ? 5 : 0,
      outlineColor: '#007F0E',
//      fontfamily: 'Exo, Exo Regular, Verdana, sans-serif'
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
  marker() {
    var pos = this.iconPosition();
    var icon = this.icon();
    if (this.shouldShowIcon() && pos != null && icon != null) {
      // Create marker
      var m = L.marker(pos, {
        icon: icon
      });
      // Set the click action for the marker
      var uid = this.uid;
      m.on('click', (function(uid) {
        return function() {
          iconSelect(uid);
        };
      })(uid));
      return m;
    } else {
      return null;
    }
  }

  // Check if the entity is currently selected
  entitySelected() {
    return this.uid == selectedEntityUID;
  }

  // Generate a snail trail polyline for the entity based on its
  // reported positions
  trail() {
    if (this.shouldShowIcon()) {
      return L.polyline(this.positionHistory, { color: '#007F0E' });
    }
  }

  // Generate a snail trail line for the entity joining its
  // last reported position with the current dead reckoned
  // position, or null if not dead reckoning.
  drTrail() {
    if (this.shouldShowIcon() && this.positionHistory.length > 0 && this.oldEnoughToDR() && this.drPosition() != null) {
      var points = [this.position(), this.drPosition()];
      return L.polyline(points, {
        color: '#007F0E',
        dashArray: "5 5"
      });
    } else {
      return null;
    }
  }

  // Trim the snail trail if required
  trimSnailTrail() {
    while (this.positionHistory.length >= snailTrailLength) {
      this.positionHistory.shift();
    }
  }
}


/////////////////////////////
//       FUNCTIONS         //
/////////////////////////////

// Dump1090 history retrieval method (only called once at startup). This just
// queries for history data and populates the dump1090HistoryStore variable, this
// is then later used in processDump1090History().
function requestDump1090History() {
  var url = dump1090url + "/data/receiver.json";
  $.getJSON(url, function(data) {
    // Iterate through all history files. This could be up to 120!
    var historyFileCount = data.history;
    var i;
    for (i = 0; i < historyFileCount; i++) {
      var url = dump1090url + "/data/history_" + i + ".json";
      $.getJSON(url, async function(data) {
        // Got history data, store it. We don't want to process it immediately
        // because history data is not ordered; we need to store it first then
        // order it as soon as we think all the data will have arrived.
        dump1090HistoryStore.push(data);
      });
    }
  });
}

// Take whatever history data we have managed to acquire from Dump1090 at this point,
// sort by date, push all the updates into the main data store, delete anything
// old. After this function finishes, we are then ready to start receiving
// live data on top of the historical data.
function processDump1090History() {
  // At startup we did one initial retrieve of live data so we had a nice display
  // from the start. Now we have history data to load in which is older. So,
  // delete the existing live aircraft data first.
  entities.forEach(function(e) {
    if (e.type == types.AIRCRAFT) {
      entities.delete(e.uid);
    }
  });

  // History data could have come in any order, so first sort it.
  dump1090HistoryStore.sort((a, b) => (a.now > b.now) ? 1 : -1);

  // Now use it
  for (item of dump1090HistoryStore) {
    handleDataDump1090(item, false);
  }

  // Drop anything timed out
  dropTimedOutEntities();

  // Now trigger retrieval of a new set of live data, to top off the history
  requestDump1090LiveData();
}

// Dump1090 live data retrieval method. This is the main data request
// function which gets called every 10 seconds to update the internal
// data store
function requestDump1090LiveData() {
  var url = dump1090url + "/data/aircraft.json?_=" + (new Date()).getTime();
  $.ajax({
    url: url,
    dataType: 'json',
    timeout: 9000,
    success: async function(result) {
      handleSuccessDump1090(result);
    },
    error: function() {
      handleFailureDump1090();
    },
    complete: function() {
      dropTimedOutEntities();
      // No need to update the map here as it has its own refresh interval
    }
  });
}

// Handle successful receive of data
async function handleSuccessDump1090(result) {
  $("#aircraftTrackerOffline").css("display", "none");

  // Update the data store
  handleDataDump1090(result, true);
}

// Update the internal data store with the provided data
function handleDataDump1090(result, live) {
  // Update clock offset (local PC time - data time) - only if data
  // is live rather than historic data being loaded in
  if (live) {
    clockOffset = moment().diff(moment.unix(result.now).utc(), 'seconds');
  }

  // Add/update aircraft in entity list
  for (a of result.aircraft) {
    if (!entities.has(a.hex)) {
      // Doesn't exist, so create
      entities.set(a.hex, new Entity(a.hex, types.AIRCRAFT));
    }
    entities.get(a.hex).internaliseFromDump1090(a, result.now);
  }
}

// Handle a failure to receive data
async function handleFailureDump1090() {
  $("#aircraftTrackerOffline").css("display", "inline-block");
}

// AIS Dispatcher data retrieval method. This is the main data request
// function which gets called every 10 seconds to update the internal
// data store
function requestAISDispatcherLiveData() {
  $.ajax({
    url: aisdurl,
    dataType: 'xml',
    timeout: 9000,
    success: async function(result) {
      handleSuccessAISD(result);
    },
    error: function() {
      handleFailureAISD();
    },
    complete: function() {
      dropTimedOutEntities();
      // No need to update the map here as it has its own refresh interval
    }
  });
}

// Handle successful receive of data
async function handleSuccessAISD(result) {
  $("#shipTrackerOffline").css("display", "none");

  // Update the data store
  handleDataAISD(result, true);
}

// Update the internal data store with the provided data
function handleDataAISD(result, live) {
  var placemarks = result.getElementsByTagName("Placemark");
  for (i = 0; i < placemarks.length; i++) {
    // We want a unique ID (here the MMSI) to find out which track to update
    // Unfortunately this is buried in an HTML table insid the description field
    var description = placemarks[i].getElementsByTagName("description")[0].childNodes[0].nodeValue;
    var parser = new DOMParser();  
    var table = parser.parseFromString(description, 'text/xml');
    var cells = table.getElementsByTagName("td");
    var mmsi = cells[5].childNodes[0].data;

    // Update internal data
    if (!entities.has(mmsi)) {
      // Doesn't exist, so create
      entities.set(mmsi, new Entity(mmsi, types.SHIP));
    }
    entities.get(mmsi).internaliseFromAIS(placemarks[i]);
  }
}

// Handle a failure to receive data
async function handleFailureAISD() {
  $("#shipTrackerOffline").css("display", "inline-block");
}

// Drop any entities too old to be displayed
function dropTimedOutEntities() {
  entities.forEach(function(e) {
    if (e.oldEnoughToDelete()) {
      entities.delete(e.uid);
    }
  });
}

// Update map, clearing old markers and drawing new ones
async function updateMap() {
  // Remove existing markers
  markersLayer.clearLayers();

  // Add entity markers to map
  entities.forEach(function(e) {
    if (e.marker() != null) {
      markersLayer.addLayer(e.marker());
    }
  });

  // Add snail trails to map for selected entity
  entities.forEach(function(e) {
    if (e.uid == selectedEntityUID) {
      markersLayer.addLayer(e.trail());
    }
  });
  entities.forEach(function(e) {
    if (e.uid == selectedEntityUID && e.drTrail() != null) {
      markersLayer.addLayer(e.drTrail());
    }
  });

  // Update counters
  var aircraftCount = 0;
  var shipCount = 0;
  entities.forEach(function(e) {
    if (e.type == types.AIRCRAFT) {
      aircraftCount++;
    } else if (e.type == types.SHIP) {
      shipCount++;
    }
  });
  $("#aircraftCount").text("(" + aircraftCount + ")");
  $("#shipCount").text("(" + shipCount + ")");
}

// Function called when an icon is clicked. Just set entity as selected,
// unless it already is, in which case deselect.
async function iconSelect(uid) {
  if (uid != selectedEntityUID) {
    selectedEntityUID = uid;
  } else {
    selectedEntityUID = 0;
  }
  updateMap();
}

// Utility function to get local PC time with data time offset applied.
function getTimeInServerRefFrame() {
  return moment().subtract(clockOffset, "seconds");
}

// Retrieve METAR & TAF data from CheckWX and update an airport entity
// Runs asynchronously, updates "fixedSecondDescrip" and 
// "fixedSecondDescrip" in the airport entity when done.
function updateMETAR(uid, icaoCode) {
  $.ajax({
    type: 'GET',
    url: 'https://api.checkwx.com/metar/' + icaoCode,
    headers: { 'X-API-Key': CHECKWX_API_KEY },
    dataType: 'json',
    success: function (result) {
      entities.get(uid).fixedFirstDescrip = "METAR " + result.data[0];
    }
  });
  $.ajax({
    type: 'GET',
    url: 'https://api.checkwx.com/taf/' + icaoCode,
    headers: { 'X-API-Key': CHECKWX_API_KEY },
    dataType: 'json',
    success: function (result) {
      entities.get(uid).fixedSecondDescrip = result.data[0];
    }
  });
}

function setLightTheme() {
  darkTheme = false;
  document.documentElement.setAttribute("color-mode", "light");
  var metaThemeColor = document.querySelector("meta[name=theme-color]");
  metaThemeColor.setAttribute("content", "#DDDDB9");
  tileLayer.setOpacity(1.0);
  updateMap();
}

function setDarkTheme() {
  darkTheme = true;
  document.documentElement.setAttribute("color-mode", "dark");
  var metaThemeColor = document.querySelector("meta[name=theme-color]");
  metaThemeColor.setAttribute("content", "#2C2C25");
  tileLayer.setOpacity(1.0);
  tileLayer.setOpacity(0.2);
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
//          INIT           //
/////////////////////////////

// Pick which URL to use based on the query string parameters
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var dump1090url = DUMP1090_URL;
var aisdurl = AIS_DISPATCHER_KML_URL;
if (urlParams.get("alt") == "true") {
  dump1090url = DUMP1090_URL_ALT;
  aisdurl = AIS_DISPATCHER_KML_URL_ALT;
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

// Add background layers
var tileLayer = L.tileLayer(MAP_URL);
tileLayer.setOpacity(0.2);
tileLayer.addTo(map);


/////////////////////////////
//       THEME SETUP       //
/////////////////////////////

setThemeToMatchOS();
window.matchMedia("(prefers-color-scheme: dark)").addListener(setThemeToMatchOS);

/////////////////////////////
//    PANEL MANAGEMENT     //
/////////////////////////////

$("div#top").show("slide", { direction: "up" }, 1000);
setTimeout(function(){ $("div#top").hide("slide", { direction: "up" }, 1000); }, 10000);


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
//   FIXED ENTITY SETUP    //
/////////////////////////////

// Fixed entities have negative number IDs, to ensure they never conflict
// with ICAO hex codes or MMSIs.
var i = -1;

// Add base station
var base = new Entity(i, types.BASE);
base.name = BASE_STATION.name;
base.addPosition(BASE_STATION.lat, BASE_STATION.lon);
base.fixedFirstDescrip = BASE_STATION.firstDescrip;
base.fixedSecondDescrip = BASE_STATION.secondDescrip;
entities.set(i, base);

// Add airports
for (ap of AIRPORTS) {
  i--;
  var e = new Entity(i, types.AIRPORT);
  e.name = ap.name;
  e.addPosition(ap.lat, ap.lon);
  e.fixedFirstDescrip = ap.firstDescrip;
  entities.set(i, e);
  // Request METAR
  updateMETAR(i, ap.icaoCode);
}

// Add sea ports
for (sp of SEAPORTS) {
  i--;
  var e = new Entity(i, types.SEAPORT);
  e.name = sp.name;
  e.addPosition(sp.lat, sp.lon);
  entities.set(i, e);
}

// Update map so we see these instantly
updateMap();


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

// The loading procedure is quite complex. Dump 1090 provides both history
// data and live data. We want to load the history data first, so we have
// as much info (e.g. snail trails) to plot, however it takes a while to
// load as it can be up to 120 separate requests. So the procedure is:
// 1) Get a single shot of live data, so the display comes up populated ASAP
// 2) Update map once after 2 seconds, when it should be complete
// 3) Kick off all the history requests asynchronously
// 4) Wait 9 seconds
// 5) Delete the single shot of live data and replace it with the full
//    history store of data
// 6) Run another single shot of live data, appending to the end of the
//    history
// 7) Update display once, at the end of that process.
// 8) We are now fully up-to-date, so now kick off the two interval
//    processes that will request new live data every 10 seconds, and
//    update the display every second.

// First do a one-off live data request so we have something to display.
requestDump1090LiveData();
requestAISDispatcherLiveData();
setTimeout(updateMap, 2000);

// Now grab the dump1090 history data. The request calls are asynchronous,
// so we have an additional call after 9 seconds (just before live data is
// first requested) to unpack and use whatever history data we have at that
// point. There is no history equivalent for AIS.
requestDump1090History();
setTimeout(processDump1090History, 9000);
setTimeout(function() { $("#loadingpanel").css("display", "none");}, 10000);

// Set up the timed data request & update threads.
setInterval(requestDump1090LiveData, 10000);
setInterval(requestAISDispatcherLiveData, 60000);
setInterval(updateMap, 1000);
