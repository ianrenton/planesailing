aircraft_airline_code_to_operator.csv
aircraft_airline_code_to_symbol.csv
aircraft_cat_to_description.csv
aircraft_cat_to_symbol.csv
ship_nav_status_to_description.csv
ship_type_to_description.csv
ship_type_to_symbol.csv
aprs_ssid_to_symbol.csv:

Created by Ian Renton.

aircraft_type_short_to_long.csv
aircraft_type_short_to_symbol.csv:

Created by Ian Renton based on http://www.icao.int/publications/DOC8643/ via OpenSky's CSV
https://opensky-network.org/datasets/metadata/doc8643AircraftTypes.csv

aircraft_icao_hex_to_registration.csv
aircraft_icao_hex_to_type.csv:

Generated from Dump1090's JSON database (https://github.com/flightaware/dump1090/tree/master/public_html/db)
and OpenSky's database (https://opensky-network.org/datasets/metadata/aircraftDatabase.csv) using the 
ImportAircraftDatabases utility included in this package.

ship_mmsi_to_name:

Created by Ian Renton based on https://www.itu.int/en/ITU-R/terrestrial/mars/Documents/2nd_ListV_compilation%202021.pdf
Converted to plain text using https://pdftotext.com/ then converted to CSV using the ImportMMSIDatabase utility
included in this package. Additional data for local vessels not on the ITU list appended to the end of the file.