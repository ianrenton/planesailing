package com.ianrenton.planesailing.utils;

import com.opencsv.CSVReader;
import com.opencsv.CSVWriter;
import com.opencsv.exceptions.CsvValidationException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.*;
import java.util.*;

/**
 * Standalone util for converting OpenSky's CSV data and Dump1090's JSON data
 * into CSV files for Plane Sailing to use. We don't want to use the files "raw"
 * as it takes ages to read them in via JSON.
 */
public class ImportAircraftDatabases {

    /**
     * Location of saved copy of
     * <a href="https://opensky-network.org/datasets/metadata/aircraftDatabase.csv">...</a>
     */
    private static final File PATH_TO_OPENSKY_CSV = new File("/home/ian/Downloads/aircraftDatabase.csv");

    /**
     * Location of saved copy of
     * <a href="https://github.com/flightaware/dump1090/tree/master/public_html/db">...</a>
     */
    private static final File PATH_TO_DUMP1090_DB = new File("/home/ian/code/dump1090-fa/public_html/db");

    private static final File OUTPUT_DIR = new File("/home/ian");


    private static final Map<String, String> ICAO_HEX_TO_REGISTRATION = new HashMap<>();
    private static final Map<String, String> ICAO_HEX_TO_TYPE = new HashMap<>();

    public static void main(String[] args) throws Exception {
        loadOpenSkyData();
        loadDump1090Data();

        writeFile("aircraft_icao_hex_to_registration.csv", ICAO_HEX_TO_REGISTRATION);
        writeFile("aircraft_icao_hex_to_type.csv", ICAO_HEX_TO_TYPE);
        System.out.println("Done. Found " + ICAO_HEX_TO_REGISTRATION.size() + " registrations and " + ICAO_HEX_TO_TYPE.size() + " types.");
    }

    private static void loadDump1090Data() throws FileNotFoundException {
        File[] files = PATH_TO_DUMP1090_DB.listFiles((dir, name) -> name.endsWith(".json"));
        assert files != null;
        for (File f : files) {
            String prefix = f.getName().replaceFirst(".json", "");

            FileInputStream fis = new FileInputStream(f);
            JSONTokener tokener = new JSONTokener(fis);
            JSONObject object = new JSONObject(tokener);

            for (String hex : object.keySet()) {
                if (!hex.equals("children")) {
                    String completeICAOHex = (prefix + hex).toUpperCase();
                    System.out.println(completeICAOHex);

                    JSONObject o = object.getJSONObject(hex);
                    if (o.has("r")) {
                        ICAO_HEX_TO_REGISTRATION.put(completeICAOHex, o.getString("r"));
                    }
                    if (o.has("t")) {
                        ICAO_HEX_TO_TYPE.put(completeICAOHex, o.getString("t"));
                    }
                }
            }
        }
    }

    private static void loadOpenSkyData() throws CsvValidationException, IOException {
        CSVReader reader = new CSVReader(new FileReader(PATH_TO_OPENSKY_CSV));
        // Skip over the header
        reader.readNext();
        reader.readNext();

        String[] row;
        while ((row = reader.readNext()) != null) {
            String icaoHex = row[0].toUpperCase();
            String reg = row[1];
            String typeCode = row[5];
            System.out.println(icaoHex);

            if (!icaoHex.isEmpty()) {
                if (!reg.isEmpty()) {
                    ICAO_HEX_TO_REGISTRATION.put(icaoHex, reg);
                }
                if (!typeCode.isEmpty()) {
                    ICAO_HEX_TO_TYPE.put(icaoHex, typeCode);
                }
            }
        }

        reader.close();
    }

    private static void writeFile(String filename, Map<String, String> map) throws IOException {
        FileWriter fw = new FileWriter(new File(OUTPUT_DIR, filename));
        CSVWriter writer = new CSVWriter(fw);

        List<String> sortedKeys = new ArrayList<>(map.keySet());
        Collections.sort(sortedKeys);

        for (String k : sortedKeys) {
            writer.writeNext(new String[]{k, map.get(k)});
        }
        writer.flush();
        writer.close();
    }

}
