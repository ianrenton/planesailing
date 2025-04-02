package com.ianrenton.planesailing.utils;

import com.opencsv.CSVWriter;

import java.io.*;
import java.util.*;

/**
 * Util to convert a text dump of the ITU ship database into a CSV mapping MMSI
 * to vessel name.
 * <p>
 * The format of the ITU MARS PDF at <a href="https://www.itu.int/en/ITU-R/terrestrial/mars/Documents/">...</a>
 * is not great for parsing programatically, and the text converted form via pdftotext.com
 * is not brilliant either, but has the information we need somewhere. We look for valid
 * MMSIs, then count on 4 lines and read that line as the vessel name. It mostly works!
 * <p>
 * This is the easiest way of parsing out the data that I have found so far, and it gets
 * about 95% of vessel names right. I have also tried a simple copy-paste, which works
 * from Chrome's PDF viewer but not Firefox's or Acrobat Reader. But, it results in space-
 * separated cells which are difficult to separate from spaces in vessel names.
 * <p>
 * As the ITU's own list is not exhaustive anyway, this is good enough for now!
 *
 * @author Ian
 */
public class ImportMMSIDatabase {
    private static final File PATH_TO_ITU_MARS_TEXT = new File("C:\\Users\\Ian\\Downloads\\2nd_ListV_compilation 2021.txt");
    private static final File OUTPUT_CSV = new File("C:\\\\Users\\\\Ian\\\\Downloads\\\\ship_mmsi_to_name.csv");

    private static final Map<String, String> MMSI_TO_NAME = new HashMap<>();

    public static void main(String[] args) throws Exception {
        loadData();

        writeFile(OUTPUT_CSV, MMSI_TO_NAME);
        System.out.println("Done.");
    }

    private static void loadData() throws IOException {
        BufferedReader reader = new BufferedReader(new FileReader(PATH_TO_ITU_MARS_TEXT));

        String line;
        while ((line = reader.readLine()) != null) {
            if (line.trim().matches("\\d{9}")) {
                String mmsi = line.trim();
                reader.readLine();
                reader.readLine();
                reader.readLine();
                String name = reader.readLine().trim();
                if (!name.isEmpty() && !name.trim().matches("\\d{9}")) {
                    System.out.println(mmsi + ": " + name);
                    MMSI_TO_NAME.put(mmsi, name);
                }
            }
        }

        reader.close();
    }

    @SuppressWarnings("SameParameterValue")
    private static void writeFile(File file, Map<String, String> map) throws IOException {
        FileWriter fw = new FileWriter(file);
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
