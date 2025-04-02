package com.ianrenton.planesailing.utils;

import com.ianrenton.planesailing.app.TrackTable;
import com.ianrenton.planesailing.comms.APRSTCPClient;
import com.ianrenton.planesailing.data.Track;
import com.ianrenton.planesailing.data.TrackType;
import net.ab0oo.aprs.parser.APRSPacket;
import net.ab0oo.aprs.parser.Parser;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map.Entry;

/**
 * Hacky util to read Direwolf-style ASCII dumps of APRS packets
 * extracted from syslog. Used once to recover knowledge of APRS
 * base stations after the track data store was unintentionally
 * wiped.
 */
public class APRSASCIIDumpParser {

    public static void main(String[] args) throws IOException {
        DataMaps.initialise();
        File f = new File("/home/ian/Documents/all2.txt");
        BufferedReader br = new BufferedReader(new FileReader(f));
        TrackTable tt = new TrackTable();
        APRSTCPClient dummyClient = new APRSTCPClient("", "", 0, tt);

        // Read in file, convert to APRS packets and load into temporary track table
        String s;
        while ((s = br.readLine()) != null) {
            //System.out.println(s);
            try {
                APRSPacket p = Parser.parse(s);
                dummyClient.addDataToTrack(p);
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }

        // Remove mobile tracks as they are not really current,
        // leaving only base stations
        for (Iterator<Entry<String, Track>> it = tt.entrySet().iterator(); it.hasNext(); ) {
            Track t = it.next().getValue();
            try {
                if (t.getTrackType() == TrackType.APRS_MOBILE) {
                    it.remove();
                }
            } catch (Exception ex) {
                // This is fine, carry on
            }
        }

        tt.printStatusData();

        // Load a track data store, merge the new data in, and re-save
        TrackTable newTT = new TrackTable();
        newTT.loadFromFile(new File("/home/ian/code/planesailing/target/track_data_store.dat"));
        newTT.printStatusData();
        newTT.copy(tt);
        newTT.printStatusData();
        newTT.saveToFile(new File("/home/ian/code/planesailing/target/track_data_store_merged.dat"));

    }
}
