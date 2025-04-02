package com.ianrenton.planesailing.utils;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.FileReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Utility class for loading CSV data maps and making them available to the
 * software.
 */
public class DataMaps {
    public static final Map<String, String> AIRCRAFT_CATEGORY_TO_DESCRIPTION = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_CATEGORY_TO_SYMBOL = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_AIRLINE_CODE_TO_OPERATOR = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_AIRLINE_CODE_TO_SYMBOL = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_ICAO_HEX_TO_REGISTRATION = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_ICAO_HEX_TO_TYPE = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_ICAO_HEX_TO_SYMBOL = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_ICAO_HEX_TO_OPERATOR = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_TYPE_SHORT_TO_LONG = new HashMap<>();
    public static final Map<String, String> AIRCRAFT_TYPE_SHORT_TO_SYMBOL = new HashMap<>();
    public static final Map<String, String> SHIP_NAV_STATUS_TO_DESCRIPTION = new HashMap<>();
    public static final Map<String, String> SHIP_MMSI_TO_NAME = new HashMap<>();
    public static final Map<String, String> SHIP_MMSI_TO_SYMBOL = new HashMap<>();
    public static final Map<String, String> SHIP_TYPE_TO_SYMBOL = new HashMap<>();
    public static final Map<String, String> SHIP_TYPE_TO_DESCRIPTION = new HashMap<>();
    public static final Map<String, String> APRS_SSID_TO_SYMBOL = new HashMap<>();

    private static final Logger LOGGER = LogManager.getLogger(DataMaps.class);

    public static void initialise() {
        load("aircraft_cat_to_description.csv", AIRCRAFT_CATEGORY_TO_DESCRIPTION);
        load("aircraft_cat_to_symbol.csv", AIRCRAFT_CATEGORY_TO_SYMBOL);
        load("aircraft_airline_code_to_operator.csv", AIRCRAFT_AIRLINE_CODE_TO_OPERATOR);
        load("aircraft_airline_code_to_symbol.csv", AIRCRAFT_AIRLINE_CODE_TO_SYMBOL);
        load("aircraft_icao_hex_to_registration.csv", AIRCRAFT_ICAO_HEX_TO_REGISTRATION);
        load("aircraft_icao_hex_to_type.csv", AIRCRAFT_ICAO_HEX_TO_TYPE);
        load("aircraft_icao_hex_to_symbol.csv", AIRCRAFT_ICAO_HEX_TO_SYMBOL);
        load("aircraft_icao_hex_to_operator.csv", AIRCRAFT_ICAO_HEX_TO_OPERATOR);
        load("aircraft_type_short_to_long.csv", AIRCRAFT_TYPE_SHORT_TO_LONG);
        load("aircraft_type_short_to_symbol.csv", AIRCRAFT_TYPE_SHORT_TO_SYMBOL);
        load("ship_nav_status_to_description.csv", SHIP_NAV_STATUS_TO_DESCRIPTION);
        load("ship_mmsi_to_name.csv", SHIP_MMSI_TO_NAME);
        load("ship_mmsi_to_symbol.csv", SHIP_MMSI_TO_SYMBOL);
        load("ship_type_to_symbol.csv", SHIP_TYPE_TO_SYMBOL);
        load("ship_type_to_description.csv", SHIP_TYPE_TO_DESCRIPTION);
        load("aprs_ssid_to_symbol.csv", APRS_SSID_TO_SYMBOL);
    }

    /**
     * Load a given two-column CSV file from the classpath resources into the given
     * hashmap.
     */
    private static void load(String filename, Map<String, String> map) {
        try {
            FileReader in = new FileReader("data/" + filename);
            try {
                CSVReader reader = new CSVReader(in);
                List<String[]> allRows = reader.readAll();
                for (String[] row : allRows) {
                    if (row.length >= 2) {
                        map.put(row[0], row[1]);
                    }
                }
                reader.close();
                LOGGER.info("Loaded {} entries from {}", map.size(), filename);
            } catch (CsvException ex) {
                LOGGER.error("Error loading data map file {}", filename, ex);
            }
        } catch (IOException ex) {
            LOGGER.error("Error loading data map file {}", filename, ex);
        }
    }
}
