package com.ianrenton.planesailing.comms;

import com.ianrenton.planesailing.app.TrackTable;
import com.ianrenton.planesailing.data.MeshtasticNode;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/**
 * Querier for Meshtastic node data using the Meshtastic Python CLI.
 */
public class MeshtasticNodeQuerier extends Client {

    private static final Logger LOGGER = LogManager.getLogger(MeshtasticNodeQuerier.class);
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private final String command;
    private final int queryIntervalSec;

    /**
     * Create the receiver
     *
     * @param name The name of the connection.
     * @param command The command to run to query node data
     * @param queryIntervalSec Time in seconds between performing queries.
     * @param trackTable The track table to use.
     */
    public MeshtasticNodeQuerier(String name, String command, int queryIntervalSec, TrackTable trackTable) {
        super(name, trackTable);
        this.command = command;
        this.queryIntervalSec = queryIntervalSec;
    }

    /**
     * Run the receiver.
     */
    @Override
    public void run() {
        online = true;
        LOGGER.info("Starting Meshtastic querier");
        executor.scheduleWithFixedDelay(new QueryTask(), 0, queryIntervalSec, TimeUnit.SECONDS);
    }

    /**
     * Stop the receiver.
     */
    @Override
    public void stop() {
        executor.shutdown();
        online = false;
    }

    /**
     * Handle the "Nodes in Mesh" data from the result of the query.
     */
    private void handle(JSONObject o) {
        try {
            List<String> ids = new ArrayList<>(o.keySet());
            for (String id : ids) {
                JSONObject nodeData = o.getJSONObject(id);

                // If this is a new track, add it to the track table
                if (!trackTable.containsKey(id)) {
                    MeshtasticNode newTrack = new MeshtasticNode(id);
                    trackTable.put(id, newTrack);
                }

                // Extract the data and update the track
                MeshtasticNode n = (MeshtasticNode) trackTable.get(id);

                // Meshtastic data isn't reported live from a receiver, we are
                // querying a device that may have history. If we are looking
                // at a node last heard longer ago than the timeout, skip it -
                // only handle data from nodes whose data is new enough.
                if (nodeData.has("lastHeard") && System.currentTimeMillis() -
                        (nodeData.getLong("lastHeard") * 1000L) < MeshtasticNode.DROP_MESHTASTIC_TRACK_TIME) {
                    
                    if (nodeData.has("snr")) {
                        n.setSnr(nodeData.getDouble("snr"));
                    }
                    
                    if (nodeData.has("user")) {
                        JSONObject userData = nodeData.getJSONObject("user");
                        if (userData.has("hwModel")) {
                            n.setHardware(userData.getString("hwModel"));
                        }
                        if (userData.has("shortName")) {
                            n.setShortName(userData.getString("shortName"));
                        }
                        if (userData.has("longName")) {
                            n.setLongName(userData.getString("longName"));
                        }
                    }
                    
                    if (nodeData.has("deviceMetrics")) {
                        JSONObject deviceData = nodeData.getJSONObject("deviceMetrics");
                        if (deviceData.has("channelUtilization")) {
                            n.setChannelUtil(deviceData.getDouble("channelUtilization"));
                        }
                        if (deviceData.has("airUtilTx")) {
                            n.setAirUtilTx(deviceData.getDouble("airUtilTx"));
                        }
                        if (deviceData.has("batteryLevel")) {
                            n.setBatteryLevel(deviceData.getDouble("batteryLevel"));
                        }
                        if (deviceData.has("voltage")) {
                            n.setVoltage(deviceData.getDouble("voltage"));
                        }
                    }
                    
                    if (nodeData.has("position")) {
                        JSONObject positionData = nodeData.getJSONObject("position");
                        if (positionData.has("latitude") && positionData.has("longitude")) {
                            double lat = positionData.getDouble("latitude");
                            double lon = positionData.getDouble("longitude");
                            long time = nodeData.getLong("lastHeard");
                            if (positionData.has("time")) {
                                time = positionData.getLong("time");
                            }
                            n.addPosition(lat, lon, time * 1000L);
                        }
                        if (positionData.has("altitude")) {
                            n.setAltitude(positionData.getDouble("altitude") * 3.28); // Metres to feet
                        }
                    }

                    n.updateMetadataTime(nodeData.getLong("lastHeard") * 1000L);
                    
                } else {
                    LOGGER.debug("Rejecting node " + id + " data as 'last heard' unknown or too long ago");
                }
            }

        } catch (Exception ex) {
            LOGGER.error("Exception handling Meshtastic data, catching exception so handling can continue.", ex);
        }
    }

    /**
     * Inner query task. Runs the command to query the node, extracts the "nodes
     * in mesh" JSON from the result, and calls the handle() method.
     */
    private class QueryTask implements Runnable {

        @Override
        public void run() {
            try {
                Process p = new ProcessBuilder("bash", "-c", command).start();
                List<String> lines = new ArrayList<>();
                BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()));
                String line;
                while ((line = reader.readLine()) != null) {
                    lines.add(line);
                }

                // The format is part text part JSON, so find the bit we want. It
                // starts with a line containing "Nodes in mesh:" and finishes with
                // the next empty line.
                int startLine = 0;
                int endLine = 0;
                for (int i = 0; i < lines.size(); i++) {
                    if (lines.get(i).startsWith("Nodes in mesh:")) {
                        startLine = i;
                    }
                    if (startLine != 0 && lines.get(i).isBlank()) {
                        endLine = i;
                        break;
                    }
                }

                if (endLine > startLine) {
                    String jsonResponse = String.join(System.lineSeparator(), lines.subList(startLine, endLine));
                    jsonResponse = jsonResponse.replace("Nodes in mesh: ", "");
                    JSONObject obj = new JSONObject(jsonResponse);
                    handle(obj);
                    lastReceivedTime = System.currentTimeMillis();
                } else {
                    LOGGER.error("Could not parse Meshtastic info");
                }
            } catch (IOException ex) {
                LOGGER.error("Could not query Meshtastic node, check the command from your application.conf works!", ex);
            }
        }
    }

    @Override
    public ClientType getType() {
        return ClientType.MESHTASTIC;
    }

    @Override
    protected Logger getLogger() {
        return LOGGER;
    }

    @Override
    protected int getTimeoutMillis() {
        return queryIntervalSec * 2 * 1000;
    }
}
