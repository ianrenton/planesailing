package com.ianrenton.planesailing.comms;

import com.ianrenton.planesailing.app.Application;
import com.ianrenton.planesailing.app.TrackTable;
import com.ianrenton.planesailing.data.Track;
import com.ianrenton.planesailing.data.TrackType;
import com.ianrenton.planesailing.utils.PrometheusMetricGenerator;
import com.sun.management.OperatingSystemMXBean;
import com.sun.net.httpserver.*;
import com.typesafe.config.ConfigValue;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.management.ManagementFactory;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The HTTP server that will provide data to the Plane/Sailing client over the
 * web.
 */
public class WebServer {
    private static final Application APP = Application.getInstance();
    private static final Logger LOGGER = LogManager.getLogger(WebServer.class);
    private static final OperatingSystemMXBean OS_BEAN = ManagementFactory
            .getPlatformMXBean(OperatingSystemMXBean.class);
    // Work-around to specify total memory size of the PC manually (here, 2GB to
    // match my
    // Raspberry Pi) for JDKs where querying it doesn't work properly
    private static final long TOTAL_MEM_BYTES = (OS_BEAN.getTotalMemorySize() != 0)
            ? OS_BEAN.getTotalMemorySize() : 2000000000;
    // Expected milliseconds between receiving requests when a client is online
    private static final long CLIENT_REQUEST_RATE_MILLIS = 10000;

    private final HttpServer server;
    private final int localPort;
    private final boolean readableJSON = Application.CONFIG.getBoolean("comms.web-server.api-readable-json");
    private boolean online;
    private long lastReceivedTime;
    private int requestsServed = 0;

    /**
     * Create the web server
     *
     * @param localPort Port to listen on.
     * @exception IOException if the server could not be set up.
     */
    public WebServer(int localPort) throws IOException {
        this.localPort = localPort;
        server = HttpServer.create(new InetSocketAddress(localPort), 10);

        // For the special endpoints, set up specific call handlers
        server.createContext("/api/first", new CallHandler(Call.FIRST));
        server.createContext("/api/update", new CallHandler(Call.UPDATE));
        server.createContext("/api/telemetry", new CallHandler(Call.TELEMETRY));
        server.createContext("/api/config", new CallHandler(Call.CONFIG));
        server.createContext("/metrics", new CallHandler(Call.METRICS));

        // For everything else, serve static content to deliver the web interface
        server.createContext("/", SimpleFileServer.createFileHandler(Path.of(new File("static/").getCanonicalPath())));

        server.setExecutor(null);
    }

    public void run() {
        server.start();
        online = true;
        LOGGER.info("Started web server on port {}.", localPort);
    }

    public void stop() {
        server.stop(0);
        online = false;
    }

    private class CallHandler implements HttpHandler {
        private final Call call;

        public CallHandler(Call call) {
            this.call = call;
        }

        @Override
        public void handle(HttpExchange t) {
            lastReceivedTime = System.currentTimeMillis();
            String response = "";
            String contentType = "application/json";

            try (t) {
                switch (call) {
                    case FIRST -> response = getFirstCallJSON();
                    case UPDATE -> response = getUpdateCallJSON();
                    case TELEMETRY -> response = getTelemetryCallJSON();
                    case CONFIG -> response = getConfigCallJSON();
                    case METRICS -> {
                        response = getMetricsForPrometheus();
                        contentType = "text/plain";
                    }
                }

                final Headers headers = t.getResponseHeaders();
                final String requestMethod = t.getRequestMethod().toUpperCase();
                headers.add("Access-Control-Allow-Origin", "*");
                switch (requestMethod) {
                    case "GET" -> {
                        headers.set("Content-Type", String.format(contentType + "; charset=%s", "UTF8"));
                        final byte[] rawResponseBody = response.getBytes(StandardCharsets.UTF_8);
                        t.sendResponseHeaders(200, rawResponseBody.length);
                        t.getResponseBody().write(rawResponseBody);
                    }
                    case "OPTIONS" -> {
                        headers.set("Allow", "GET, OPTIONS");
                        headers.add("Access-Control-Allow-Methods", "GET, OPTIONS");
                        headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization");
                        t.sendResponseHeaders(200, -1);
                    }
                    default -> {
                        headers.set("Allow", "GET, OPTIONS");
                        t.sendResponseHeaders(405, -1);
                    }
                }
                requestsServed++;
            } catch (Exception ex) {
                LOGGER.error("Exception responding to web request", ex);
            }
        }
    }

    /**
     * Returns JSON corresponding to the "first" API call of the server, which
     * includes all tracks (including base station, airports and seaports), and the
     * complete position history for all tracks that have it, so that the client can
     * populate both the full current picture and the snail trail for tracks. It
     * also includes the server's current time, so that clients can determine the
     * age of tracks correctly, and the server version number.
     */
    public String getFirstCallJSON() {
        Map<String, Object> map = new HashMap<>();
        map.put("time", System.currentTimeMillis());
        map.put("version", Application.getSoftwareVersion());

        Map<String, Map<String, Object>> tracks = new HashMap<>();
        for (Track t : APP.getTrackTable().values()) {
            tracks.put(t.getID(), t.getFirstCallData());
        }
        map.put("tracks", tracks);

        JSONObject o = new JSONObject(map);
        return o.toString(readableJSON ? 2 : 0);
    }

    /**
     * Returns JSON corresponding to the "update" API call of the server, which is
     * designed to update a picture previously populated by the "first" call. To
     * save bandwidth, no position history is sent - the client is expected to
     * append the reported position to its own position history store. This call
     * also omits the base station, airports and seaports that can't change. It also
     * includes the server's current time, so that clients can determine the age of
     * tracks correctly.
     */
    public String getUpdateCallJSON() {
        Map<String, Object> map = new HashMap<>();
        map.put("time", System.currentTimeMillis());

        Map<String, Map<String, Object>> tracks = new HashMap<>();
        for (Track t : APP.getTrackTable().values()) {
            tracks.put(t.getID(), t.getUpdateCallData());
        }
        map.put("tracks", tracks);

        JSONObject o = new JSONObject(map);
        return o.toString(readableJSON ? 2 : 0);
    }

    /**
     * Get a map of some useful server telemetry
     */
    private String getTelemetryCallJSON() {
        Map<String, Object> map = new HashMap<>();
        map.put("cpuLoad", String.format("%.0f", OS_BEAN.getCpuLoad() * 100.0));
        map.put("memUsed",
                String.format("%.0f", ((OS_BEAN.getCommittedVirtualMemorySize() / (double) TOTAL_MEM_BYTES)) * 100.0));
        map.put("diskUsed", String.format("%.0f",
                (1.0 - (new File(".").getFreeSpace() / (double) new File(".").getTotalSpace())) * 100.0));
        map.put("uptime", String.format("%d", System.currentTimeMillis() - Application.START_TIME));
        Double temp = getTemp();
        if (temp != null) {
            map.put("temp", String.format("%.1f", temp));
        }
        map.put("webServerStatus", getStatus());
        map.put("feederStatus", getFeederStatus());

        JSONObject o = new JSONObject(map);
        return o.toString(readableJSON ? 2 : 0);
    }

    /**
     * Get a map of the frontend config which is stored in application.conf and transferred to the frontend via this call.
     */
    private String getConfigCallJSON() {
        Map<String, Object> map = new HashMap<>();
        for (Map.Entry<String, ConfigValue> e : Application.CONFIG.getConfig("frontend").entrySet()) {
            map.put(e.getKey(), e.getValue().unwrapped());
        }
        JSONObject o = new JSONObject(map);
        return o.toString(readableJSON ? 2 : 0);
    }

    /**
     * Get some server statistics formatted for use with Prometheus.
     */
    private String getMetricsForPrometheus() {
        TrackTable tt = APP.getTrackTable();
        return PrometheusMetricGenerator.generate("plane_sailing_uptime", "Uptime of the server in seconds",
                "counter", (System.currentTimeMillis() - Application.START_TIME) / 1000.0)
                + PrometheusMetricGenerator.generate("plane_sailing_requests_served", "Number of HTTP requests served by the Plane/Sailing server since start",
                "counter", requestsServed)
                + PrometheusMetricGenerator.generate("plane_sailing_adsb_inputs_available", "How many ADSB receivers are configured and connected?",
                "gauge", countADSBReceviersConnected())
                + PrometheusMetricGenerator.generate("plane_sailing_mlat_inputs_available", "How many MLAT receivers are configured and connected?",
                "gauge", countMLATReceviersConnected())
                + PrometheusMetricGenerator.generate("plane_sailing_ais_inputs_available", "How many AIS receivers are configured and connected?",
                "gauge", countAISReceviersConnected())
                + PrometheusMetricGenerator.generate("plane_sailing_aprs_inputs_available", "How many APRS receivers are configured and connected?",
                "gauge", countAPRSReceviersConnected())
                + PrometheusMetricGenerator.generate("plane_sailing_horus_inputs_available", "How many HORUS receivers are configured and connected?",
                "gauge", countHORUSReceviersConnected())
                + PrometheusMetricGenerator.generate("plane_sailing_meshtastic_inputs_available", "How many Meshtastic node queriers are configured and have communicated at least once?",
                "gauge", countMeshtasticReceviersConnected())
                + PrometheusMetricGenerator.generate("plane_sailing_adsb_inputs_receiving", "How many ADSB receivers are receiving data?",
                "gauge", countADSBReceviersActive())
                + PrometheusMetricGenerator.generate("plane_sailing_mlat_inputs_receiving", "How many MLAT receivers are receiving data?",
                "gauge", countMLATReceviersActive())
                + PrometheusMetricGenerator.generate("plane_sailing_ais_inputs_receiving", "How many AIS receivers are receiving data?",
                "gauge", countAISReceviersActive())
                + PrometheusMetricGenerator.generate("plane_sailing_aprs_inputs_receiving", "How many APRS receivers are receiving data?",
                "gauge", countAPRSReceviersActive())
                + PrometheusMetricGenerator.generate("plane_sailing_horus_inputs_receiving", "How many HORUS receivers are receiving data?",
                "gauge", countHORUSReceviersActive())
                + PrometheusMetricGenerator.generate("plane_sailing_meshtastic_inputs_receiving", "How many Meshtastic receivers have responded to query on schedule?",
                "gauge", countMeshtasticReceviersActive())
                + PrometheusMetricGenerator.generate("plane_sailing_track_count", "Number of tracks of all kinds in the system",
                "gauge", tt.size())
                + PrometheusMetricGenerator.generate("plane_sailing_aircraft_count", "Number of aircraft tracks in the system",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.AIRCRAFT).count())
                + PrometheusMetricGenerator.generate("plane_sailing_ship_count", "Number of ship tracks in the system",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.SHIP).count())
                + PrometheusMetricGenerator.generate("plane_sailing_ais_shore_station_count", "Number of AIS shore station tracks in the system",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.AIS_SHORE_STATION).count())
                + PrometheusMetricGenerator.generate("plane_sailing_aton_count", "Number of AtoN tracks in the system",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.AIS_ATON).count())
                + PrometheusMetricGenerator.generate("plane_sailing_aprs_mobile_count", "Number of mobile APRS tracks in the system",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.APRS_MOBILE).count())
                + PrometheusMetricGenerator.generate("plane_sailing_aprs_base_count", "Number of APRS base station tracks in the system",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.APRS_BASE_STATION).count())
                + PrometheusMetricGenerator.generate("plane_sailing_radiosonde_count", "Number of radiosondes in the system",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.RADIOSONDE).count())
                + PrometheusMetricGenerator.generate("plane_sailing_aircraft_furthest_distance", "Distance in nautical miles from the base station to the furthest tracked aircraft",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.AIRCRAFT).mapToDouble(tt::getDistanceFromBaseStationOrZero).map(d -> d * 0.000539957).max().orElse(0.0))
                + PrometheusMetricGenerator.generate("plane_sailing_ship_furthest_distance", "Distance in nautical miles from the base station to the furthest tracked ship",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.SHIP).mapToDouble(tt::getDistanceFromBaseStationOrZero).map(d -> d * TrackTable.METRES_TO_NMI).max().orElse(0.0))
                + PrometheusMetricGenerator.generate("plane_sailing_ais_furthest_distance", "Distance in nautical miles from the base station to the furthest tracked AIS contact",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.SHIP || t.getTrackType() == TrackType.AIS_SHORE_STATION || t.getTrackType() == TrackType.AIS_ATON).mapToDouble(tt::getDistanceFromBaseStationOrZero).map(d -> d * 0.000539957).max().orElse(0.0))
                + PrometheusMetricGenerator.generate("plane_sailing_aprs_furthest_distance", "Distance in nautical miles from the base station to the furthest tracked APRS contact",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.APRS_MOBILE || t.getTrackType() == TrackType.APRS_BASE_STATION).mapToDouble(tt::getDistanceFromBaseStationOrZero).map(d -> d * 0.000539957).max().orElse(0.0))
                + PrometheusMetricGenerator.generate("plane_sailing_radiosonde_furthest_distance", "Distance in nautical miles from the base station to the furthest tracked radiosonde",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.RADIOSONDE).mapToDouble(tt::getDistanceFromBaseStationOrZero).map(d -> d * 0.000539957).max().orElse(0.0))
                + PrometheusMetricGenerator.generate("plane_sailing_meshtastic_node_furthest_distance", "Distance in nautical miles from the base station to the furthest tracked Meshtastic node",
                "gauge", tt.values().stream().filter(t -> t.getTrackType() == TrackType.MESHTASTIC_NODE).mapToDouble(tt::getDistanceFromBaseStationOrZero).map(d -> d * 0.000539957).max().orElse(0.0));
    }

    /**
     * Get a connection status summary for all feeders and all their receiver clients' status.
     */
    private Map<String, Map<String, ConnectionStatus>> getFeederStatus() {
        return APP.getFeeders().stream().collect(Collectors.toMap(Feeder::getName, Feeder::getStatus));
    }

    private long countADSBReceviersConnected() {
        return getAllReceiversOfType(ClientType.ADSB).stream().filter(r -> r.getStatus() == ConnectionStatus.WAITING || r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countMLATReceviersConnected() {
        return getAllReceiversOfType(ClientType.MLAT).stream().filter(r -> r.getStatus() == ConnectionStatus.WAITING || r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countAISReceviersConnected() {
        return getAllReceiversOfType(ClientType.AIS).stream().filter(r -> r.getStatus() == ConnectionStatus.WAITING || r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countAPRSReceviersConnected() {
        return getAllReceiversOfType(ClientType.APRS).stream().filter(r -> r.getStatus() == ConnectionStatus.WAITING || r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countHORUSReceviersConnected() {
        return getAllReceiversOfType(ClientType.HORUS).stream().filter(r -> r.getStatus() == ConnectionStatus.WAITING || r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countMeshtasticReceviersConnected() {
        return getAllReceiversOfType(ClientType.MESHTASTIC).stream().filter(r -> r.getStatus() == ConnectionStatus.WAITING || r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countADSBReceviersActive() {
        return getAllReceiversOfType(ClientType.ADSB).stream().filter(r -> r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countMLATReceviersActive() {
        return getAllReceiversOfType(ClientType.MLAT).stream().filter(r -> r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countAISReceviersActive() {
        return getAllReceiversOfType(ClientType.AIS).stream().filter(r -> r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countAPRSReceviersActive() {
        return getAllReceiversOfType(ClientType.APRS).stream().filter(r -> r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countHORUSReceviersActive() {
        return getAllReceiversOfType(ClientType.HORUS).stream().filter(r -> r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private long countMeshtasticReceviersActive() {
        return getAllReceiversOfType(ClientType.MESHTASTIC).stream().filter(r -> r.getStatus() == ConnectionStatus.ACTIVE).count();
    }

    private List<Client> getAllReceiversOfType(ClientType type) {
        List<Client> receivers = new ArrayList<>();
        for (Feeder f : APP.getFeeders()) {
            f.getReceivers().stream().filter(r -> r.getType() == type).forEach(receivers::add);
        }
        return receivers;
    }

    private enum Call {
        FIRST, UPDATE, TELEMETRY, CONFIG, METRICS
    }

    public ConnectionStatus getStatus() {
        if (online) {
            if (System.currentTimeMillis() - lastReceivedTime <= CLIENT_REQUEST_RATE_MILLIS * 2) {
                return ConnectionStatus.ACTIVE;
            } else {
                return ConnectionStatus.WAITING;
            }
        } else {
            return ConnectionStatus.OFFLINE;
        }
    }

    private Double getTemp() {
        Process proc;
        try {
            proc = Runtime.getRuntime().exec("cat /sys/class/thermal/thermal_zone0/temp");
            BufferedReader stdInput = new BufferedReader(new InputStreamReader(proc.getInputStream()));
            String s = stdInput.readLine();
            if (s != null) {
                // Value returned is in "millidegrees", we want degrees
                return Double.parseDouble(s) / 1000.0;
            } else {
                // Could not read temperature, maybe this value isn't available?
                return null;
            }
        } catch (Exception e) {
            // Could not read temperature, maybe this isn't running on Linux?
            return null;
        }


    }
}
