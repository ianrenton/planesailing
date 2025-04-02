package com.ianrenton.planesailing.comms;

import com.ianrenton.planesailing.app.TrackTable;
import com.ianrenton.planesailing.data.Aircraft;
import org.apache.commons.lang3.concurrent.BasicThreadFactory;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public class Dump1090JSONReader extends Client {
    private static final Logger LOGGER = LogManager.getLogger(Dump1090JSONReader.class);
    private static final int QUERY_INTERVAL_MS = 5000;
    private URL url;
    private transient final ScheduledExecutorService scheduledExecutorService = Executors.newScheduledThreadPool(1,
            new BasicThreadFactory.Builder().namingPattern(name + " client").build());
    @SuppressWarnings("rawtypes")
    private transient ScheduledFuture readerTask;

    public Dump1090JSONReader(String name, String url, TrackTable trackTable) {
        super(name, trackTable);
        try {
            this.url = new URL(url);
        } catch (MalformedURLException e) {
            LOGGER.error("{} is an invalid URL, {} client could not be created!", url, name);
        }
    }

    @Override
    public void run() {
        online = true;
        readerTask = scheduledExecutorService.scheduleWithFixedDelay(new ReaderTask(), 0,
                QUERY_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    @Override
    public void stop() {
        online = false;
        readerTask.cancel(true);
    }

    @Override
    public ClientType getType() {
        return ClientType.ADSB;
    }

    @Override
    protected Logger getLogger() {
        return LOGGER;
    }

    @Override
    protected int getTimeoutMillis() {
        return QUERY_INTERVAL_MS * 2;
    }

    /**
     * Inner reader task. Queries the JSON file and updates the internal data store.
     */
    private class ReaderTask implements Runnable {

        public void run() {
            try {
                // Read in complete JSON file
                BufferedReader in = new BufferedReader(new InputStreamReader(url.openStream()));
                StringBuilder json = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    json.append(inputLine);
                }
                in.close();
                JSONObject o = new JSONObject(json.toString());
                updatePacketReceivedTime();

                // Extract data
                JSONArray acList = o.getJSONArray("aircraft");
                if (acList != null) {
                    for (int i = 0; i < acList.length(); i++) {
                        try {
                            JSONObject ac = acList.getJSONObject(i);

                            // Get the ICAO 24-bit hex code
                            String icao24 = ac.getString("hex");

                            // If this is a new track, add it to the track table
                            if (!trackTable.containsKey(icao24)) {
                                trackTable.put(icao24, new Aircraft(icao24));
                            }

                            // Extract the data and update the track
                            Aircraft a = (Aircraft) trackTable.get(icao24);
                            if (ac.has("flight") && !ac.getString("flight").isEmpty()) {
                                a.setCallsign(ac.getString("flight").trim());
                            }
                            if (ac.has("squawk") && !ac.getString("squawk").isEmpty()) {
                                a.setSquawk(Integer.parseInt(ac.getString("squawk")));
                            }
                            if (ac.has("category") && !ac.getString("category").isEmpty()) {
                                a.setCategory(ac.getString("category").trim());
                            }
                            if (ac.has("lat") && ac.has("lon")) {
                                if (ac.has("pos_seen")) {
                                    long time = System.currentTimeMillis() - Math.round(ac.getDouble("pos_seen") * 1000);
                                    a.addPosition(ac.getDouble("lat"), ac.getDouble("lon"), time);
                                } else if (ac.has("seen")) {
                                    long time = System.currentTimeMillis() - Math.round(ac.getDouble("seen") * 1000);
                                    a.addPosition(ac.getDouble("lat"), ac.getDouble("lon"), time);
                                } else {
                                    a.addPosition(ac.getDouble("lat"), ac.getDouble("lon"));
                                }
                            }
                            if (ac.has("alt_baro")) {
                                if (ac.get("alt_baro") instanceof String && ac.getString("alt_baro").equals("ground")) {
                                    a.setAltitude(0.0);
                                    a.setOnGround(true);
                                } else {
                                    a.setAltitude(ac.getDouble("alt_baro"));
                                    a.setOnGround(false);
                                }
                            } else if (ac.has("alt_geom")) {
                                if (ac.get("alt_geom") instanceof String && ac.getString("alt_geom").equals("ground")) {
                                    a.setAltitude(0.0);
                                    a.setOnGround(true);
                                } else {
                                    a.setAltitude(ac.getDouble("alt_geom"));
                                    a.setOnGround(false);
                                }
                            } else if (ac.has("nav_altitude_mcp")) {
                                if (ac.get("nav_altitude_mcp") instanceof String && ac.getString("nav_altitude_mcp").equals("ground")) {
                                    a.setAltitude(0.0);
                                    a.setOnGround(true);
                                } else {
                                    a.setAltitude(ac.getDouble("nav_altitude_mcp"));
                                    a.setOnGround(false);
                                }
                            }
                            if (ac.has("baro_rate")) {
                                a.setVerticalRate(ac.getDouble("baro_rate") / 60.0);
                            } else if (ac.has("geom_rate")) {
                                a.setVerticalRate(ac.getDouble("geom_rate") / 60.0);
                            }
                            if (ac.has("track")) {
                                a.setCourse(ac.getDouble("track"));
                            } else if (ac.has("true_heading")) {
                                a.setCourse(ac.getDouble("true_heading"));
                            } else if (ac.has("mag_heading")) {
                                a.setCourse(ac.getDouble("mag_heading"));
                            } else if (ac.has("nav_heading")) {
                                a.setCourse(ac.getDouble("nav_heading"));
                            }
                            if (ac.has("true_heading")) {
                                a.setHeading(ac.getDouble("true_heading"));
                            } else if (ac.has("mag_heading")) {
                                a.setHeading(ac.getDouble("mag_heading"));
                            } else if (ac.has("nav_heading")) {
                                a.setHeading(ac.getDouble("nav_heading"));
                            } else if (ac.has("track")) {
                                a.setHeading(ac.getDouble("track"));
                            }
                            if (ac.has("gs")) {
                                a.setSpeed(ac.getDouble("gs"));
                            } else if (ac.has("tas")) {
                                a.setSpeed(ac.getDouble("tas"));
                            } else if (ac.has("ias")) {
                                a.setSpeed(ac.getDouble("ias"));
                            } else if (ac.has("mach")) {
                                a.setSpeed(ac.getDouble("mach") * 666.739);
                            }
                            if (ac.has("pos_seen")) {
                                long time = System.currentTimeMillis() - Math.round(ac.getDouble("pos_seen") * 1000);
                                a.updateMetadataTime(time);
                            } else if (ac.has("seen")) {
                                long time = System.currentTimeMillis() - Math.round(ac.getDouble("seen") * 1000);
                                a.updateMetadataTime(time);
                            } else {
                                a.updateMetadataTime();
                            }
                        } catch (Exception e) {
                            LOGGER.error("Exception reading data for an aircraft", e);
                        }
                    }
                }
            } catch (Throwable e) {
                LOGGER.error("Exception reading Dump1090 JSON data on connection {}", name, e);
            }
        }
    }

}
