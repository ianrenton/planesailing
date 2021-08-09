var easterEggs = false;
var hostilesLastTick = false;
var lastKeyPressed = "";
var interdicted = [];

$("#easterEggs").change(function() {
  easterEggs = $(this).is(':checked');

  if (easterEggs) {
  	$("body").append("<div id='hostileWarning' style='display: none;    z-index: 99999;    position: absolute;    top: 10%;    left: 20%;    right: 20%;    border-top: 4px solid red;    border-bottom: 4px solid red;    text-align: center;    font-size: 36px;    font-weight: bold;    color: red;    -moz-transition:all 0.5s ease-in-out;    -webkit-transition:all 0.5s ease-in-out;    -o-transition:all 0.5s ease-in-out;    -ms-transition:all 0.5s ease-in-out;    transition:all 0.5s ease-in-out;    -moz-animation:blink normal 1.5s infinite ease-in-out;    -webkit-animation:blink normal 1.5s infinite ease-in-out;    -ms-animation:blink normal 1.5s infinite ease-in-out;    animation:blink normal 1.5s infinite ease-in-out;'>WARNING: HOSTILE TARGET DETECTED</div>");
    if (onMobile) { $("div#hostileWarning").css("font-size", "20px"); }
    document.onkeypress = function (e) {
        e = e || window.event;
        keyPressed(e.key);
    };
  } else {
  	$("div#hostileWarning").remove();
    hostilesLastTick = false;
    document.onkeypress = null;
    lastKeyPressed = "";
    interdicted = [];
    symbolOverrides.forEach((symbol, id) => {
      if (symbol.substr(3, 1) == "X") {
        symbol = symbol.substr(0, 3) + "P" + symbol.substr(4);
        symbolOverrides.set(id, symbol);
      }
    });
    updateMapObjects();
  }
});

async function eggTimer() {
  if (easterEggs) {

    // Check for hostile tracks
    hostilesThisTick = false;
	  tracks.forEach(function(t) {	    
			var symbol = getSymbolCode(t);
	    if (symbol != null && symbol.length > 4 && symbol.substr(1,1) == "H") {
	      hostilesThisTick = true;
        if (!interdicted.includes(t["id"]) && t["symbolcode"] != "SHAPML------") {
          interdicted.push(t["id"]);
          interdict(t);
        }
	    }
	  });
    if (hostilesThisTick && !hostilesLastTick) {
      $("div#hostileWarning").fadeIn();
      new Audio('warning.mp3').play();
    } else if (hostilesLastTick && !hostilesThisTick) {
      $("div#hostileWarning").fadeOut();
    } 
    hostilesLastTick = hostilesThisTick;

	}
}

async function interdict(t) {
  var start = map.getBounds().getSouthWest();
  var targetpos = L.latLng(t["lat"], t["lon"]);
  var firedist = start.distanceTo(targetpos) * 0.75;
  var firepos = L.GeometryUtil.destinationOnSegment(map, start, targetpos, firedist);
  var pSymbol = new ms.Symbol((t["tracktype"] == "AIRCRAFT") ? "SFAPMFF-----" : "SFAPMFB-----", { size: 30, colorMode: darkSymbols ? "Dark" : "Light" });
  var pIcon = L.icon({ iconUrl: pSymbol.toDataURL(), iconAnchor: [pSymbol.getAnchor().x, pSymbol.getAnchor().y] });
  var mSymbol = new ms.Symbol((t["tracktype"] == "AIRCRAFT") ? "SFAPWMAA----" : "SFAPWMAS----", { size: 30, colorMode: darkSymbols ? "Dark" : "Light" });
  var mIcon = L.icon({ iconUrl: mSymbol.toDataURL(), iconAnchor: [mSymbol.getAnchor().x, mSymbol.getAnchor().y] });
  var p = L.Marker.movingMarker([start, firepos, start], 20000, {icon: pIcon, zIndexOffset: 1200, autostart: true});
  p.on('end', function() { map.removeLayer(p); });
  map.addLayer(p);
  setTimeout(function() {
    var targetpos = L.latLng(tracks.get(t["id"])["lat"], tracks.get(t["id"])["lon"]);
    var m1 = L.Marker.movingMarker([p.getLatLng(), targetpos], 4000, {icon: mIcon, zIndexOffset: 1100, autostart: true});
    m1.on('end', function() { 
      map.removeLayer(m1);
      var symbol = getSymbolCode(t);
      symbol = symbol.substr(0, 3) + "X" + symbol.substr(4);
      symbolOverrides.set(t["id"], symbol);
      updateMapObjects();
    });
    map.addLayer(m1);
  }, 8000);
  setTimeout(function() {
    var targetpos = L.latLng(tracks.get(t["id"])["lat"], tracks.get(t["id"])["lon"]);
    var m2 = L.Marker.movingMarker([p.getLatLng(), targetpos], 3600, {icon: mIcon, zIndexOffset: 1100, autostart: true});
    m2.on('end', function() { map.removeLayer(m2); });
    map.addLayer(m2);
  }, 9000);
  setTimeout(function() {
    var targetpos = L.latLng(tracks.get(t["id"])["lat"], tracks.get(t["id"])["lon"]);
    var m3 = L.Marker.movingMarker([p.getLatLng(), targetpos], 3200, {icon: mIcon, zIndexOffset: 1100, autostart: true});
    m3.on('end', function() { map.removeLayer(m3); });
    map.addLayer(m3);
  }, 10000);
}

async function keyPressed(key) {
  if (key == "9" && lastKeyPressed == "9") {
    spawnBal();
  }
  lastKeyPressed = key;
}

async function spawnBal() {
  var latlon = map.getBounds().getCenter();
  tracks.set("EGG-1", {
    id: "EGG-1",
    symbolcode: "SHAPML------",
    lat: latlon["lat"],
    lon: latlon["lng"],
    altitude: 3000,
    quantity: 99,
    tracktype: "AIRCRAFT",
    name: "???",
    typeDesc: "",
    info1: "PROBABLE ENEMY MISSILE LAUNCH",
    info2: "NUCLEAR RESPONSE AUTHORISED",
    createdByConfig: true
  });
  updateMapObjects();
  $("body").append("<iframe width='250' style='display: none' src='https://www.youtube.com/embed/hiwgOWo7mDc?&autoplay=1' frameborder='0' allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture' allowfullscreen></iframe>");
  setTimeout(function(){ startAWar(); }, 8000);
}

async function startAWar() {
  var lon = [51.52,-0.24];
  var par = [48.86,2.27];
  var ny = [40.69,-74.25];
  var sf = [37.76,-122.50];
  var mos = [55.58,36.82];
  var sp = [59.94,29.53];
  var bei = [39.93,116.12];
  map.flyTo([40, 0], 3, {duration: 3});
  setTimeout(function(){ 
    $("#infoPanel").hide();
    $("#configPanel").hide();
    $("#trackTablePanel").hide();

    var fSymbol = new ms.Symbol("SFAPWMB-----", { size: 30, colorMode: darkSymbols ? "Dark" : "Light" });
    var fIcon = L.icon({ iconUrl: fSymbol.toDataURL(), iconAnchor: [fSymbol.getAnchor().x, fSymbol.getAnchor().y] });
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(lon, mos).getLatLngs(), 60000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(par, mos).getLatLngs(), 65000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(ny, mos).getLatLngs(), 90000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(sf, mos).getLatLngs(), 120000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(lon, sp).getLatLngs(), 60000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(par, sp).getLatLngs(), 65000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(ny, sp).getLatLngs(), 90000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(sf, sp).getLatLngs(), 120000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(lon, bei).getLatLngs(), 240000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(par, bei).getLatLngs(), 245000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(ny, bei).getLatLngs(), 90000, {icon: fIcon, zIndexOffset: 1100, autostart: true}));
   }, 4000);
  setTimeout(function(){
    var hSymbol = new ms.Symbol("SHAPWMB-----", { size: 30, colorMode: darkSymbols ? "Dark" : "Light" });
    var hIcon = L.icon({ iconUrl: hSymbol.toDataURL(), iconAnchor: [hSymbol.getAnchor().x, hSymbol.getAnchor().y] });
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(mos, lon).getLatLngs(), 70000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(mos, par).getLatLngs(), 75000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(mos, sf).getLatLngs(), 140000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(mos, ny).getLatLngs(), 100000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(sp, lon).getLatLngs(), 70000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(sp, par).getLatLngs(), 75000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(sp, sf).getLatLngs(), 140000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(sp, ny).getLatLngs(), 100000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(bei, lon).getLatLngs(), 260000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(bei, par).getLatLngs(), 265000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
    map.addLayer(L.Marker.movingMarker(L.Polyline.Arc(bei, ny).getLatLngs(), 100000, {icon: hIcon, zIndexOffset: 1100, autostart: true}));
   }, 6000);
  setTimeout(function(){
    $("div#hostileWarning").remove();
    $("#top").fadeOut(2000);
    $("#map").fadeOut(2000, function() {
      $("body").append("<div id='signallost' style='z-index: 999999;    position: absolute;    top: 40%;    left: 20%;    right: 20%;    text-align: center;    font-size: 20px;    font-weight: bold;    color: #00ff00;    -moz-transition:all 0.5s ease-in-out;    -webkit-transition:all 0.5s ease-in-out;    -o-transition:all 0.5s ease-in-out;    -ms-transition:all 0.5s ease-in-out;    transition:all 0.5s ease-in-out;    -moz-animation:blink normal 1.5s infinite ease-in-out;    -webkit-animation:blink normal 1.5s infinite ease-in-out;    -ms-animation:blink normal 1.5s infinite ease-in-out;    animation:blink normal 1.5s infinite ease-in-out;'>SIGNAL LOST</div>");
    });
   }, 76000);
}

setInterval(eggTimer, 1000);