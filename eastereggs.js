var easterEggs = false;
var hostilesLastTick = false;
var lastKeyPressed = "";

$("#easterEggs").change(function() {
  easterEggs = $(this).is(':checked');

  if (easterEggs) {
  	$("body").append("<div id='hostileWarning' style='display: none;    z-index: 99999;    position: absolute;    top: 10%;    left: 20%;    right: 20%;    border-top: 4px solid red;    border-bottom: 4px solid red;    text-align: center;    font-size: 36px;    font-weight: bold;    color: red;    -moz-transition:all 0.5s ease-in-out;    -webkit-transition:all 0.5s ease-in-out;    -o-transition:all 0.5s ease-in-out;    -ms-transition:all 0.5s ease-in-out;    transition:all 0.5s ease-in-out;    -moz-animation:blink normal 1.5s infinite ease-in-out;    -webkit-animation:blink normal 1.5s infinite ease-in-out;    -ms-animation:blink normal 1.5s infinite ease-in-out;    animation:blink normal 1.5s infinite ease-in-out;'>WARNING: HOSTILE TARGET DETECTED</div>");
    document.onkeypress = function (e) {
        e = e || window.event;
        keyPressed(e.key);
    };
  } else {
  	$("div#hostileWarning").remove();
    var hostilesLastTick = false;
    document.onkeypress = null;
    lastKeyPressed = "";
  }
});

async function eggTimer() {
  if (easterEggs) {

    // Check for hostile tracks
    hostilesThisTick = false;
	  tracks.forEach(function(t) {	    
			var symbol = getSymbolCode(t);
	    if (symbol != null && symbol.length > 2 && symbol.substr(1,1) == "H") {
	      hostilesThisTick = true;
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