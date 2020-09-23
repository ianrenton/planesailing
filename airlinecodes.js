// From https://en.wikipedia.org/wiki/List_of_airline_codes. I've just added common
// ones for my area because there are a lot of duplicates across different countries
// If running Plane Sailing for yourself you may want to change them for what you see
// in your area.
var AIRLINE_CODES = new Map([
  ["RYR", "Ryanair"],
  ["BAW", "British Airways"],
  ["SHT", "British Airways"],
  ["EZY", "EasyJet"],
  ["EXS", "Jet2"],
  ["KLM", "KLM"],
  ["TFL", "TUI"],
  ["TOM", "TUI"],
  ["AFR", "Air France"],
  ["VIR", "Virgin Atlantic"],
  ["AAL", "American Airlines"],
  ["UAL", "United Airlines"],
  ["DAL", "Delta Airlines"],
  ["NPT", "Atlantic Airlines"],
  ["TAM", "LATAM Brasil"],
  ["WGN", "Western Global"],
  ["SWN", "West Air Sweden"],
  ["THY", "Turkish Airlines"],
  ["QTR", "Qatar Airways"],
  ["IBE", "Iberia"],
  ["VLG", "Vueling Airlines"],
  ["EIN", "Aer Lingus"],
  ["WUK", "Wizz Air"],
  ["TAP", "TAP Air Portugal"],
  ["FDX", "FedEx"],
  ["UPS", "UPS"],
  ["LH", "Lufthansa"],
  ["DLH", "Lufthansa"],
  ["GEC", "Lufthansa Cargo"],
  ["CKS", "Kalitta Air"],
  ["ETP", "Empire Test Pilots"],
  ["CLF", "Bristol Flying Centre"],
  ["MLT", "Maleth Aero"],
  ["AMBER", "Cobham"],
  ["UKP", "Police"],
  ["HLE", "Air Ambulance"],
  ["CG", "Coastguard"],
  ["RRR", "Royal Air Force"],
  ["ASCOT", "Royal Air Force"],
  ["COMET", "Royal Air Force"],
  ["SNAKE", "Royal Air Force"],
  ["SRPNT", "Royal Air Force"],
  ["NOH", "RAF Northolt 32 Sqdn"],
  ["AAC", "Army Air Corps"],
  ["SHF", "Joint Helicopter Command"],
  ["SPEAR", "UK Armed Forces"],
  ["VGBND", "UK Armed Forces"],
  ["RECON", "UK Armed Forces"],
  ["CMNDO", "UK Armed Forces"],
  ["MARINE", "Royal Marines"],
  ["BWY", "736 Naval Air Sqdn"],
  ["RCH", "U.S. Air Mobility Command"]
]);
// Symbol overrides for certain airline codes, principally military. Again you
// may want to change them for the codes used in your area/country.
var AIRLINE_CODE_SYMBOLS = new Map([
  ["UKP", "SUAPMH------"],
  ["HLE", "SUAPMHO-----"],
  ["CG", "SFAPMHH-----"],
  ["RRR", "SFAPMFC-----"],
  ["ASCOT", "SFAPMFC-----"],
  ["COMET", "SFAPMFC-----"],
  ["SNAKE", "SFAPMF-------"],
  ["SRPNT", "SFAPMF-------"],
  ["NOH", "SFAPM-------"],
  ["AAC", "SFAPM-------"],
  ["SHF", "SFAPMHUH----"],
  ["SPEAR", "SFAPMH------"],
  ["VGBND", "SFAPMH------"],
  ["RECON", "SFAPMH------"],
  ["CMNDO", "SFAPMH------"],
  ["DOLPHN", "SFAPMH------"],
  ["DOLPN", "SFAPMH------"],
  ["MARINE", "SFAPMH------"],
  ["CASTLE", "SFAPMH------"],
  ["BWY", "SFAPMF------"],
  ["RCH", "SFAPMFC-----"]
]);
