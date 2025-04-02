package com.ianrenton.planesailing.app;

import com.ianrenton.planesailing.comms.Feeder;
import com.ianrenton.planesailing.comms.WebServer;
import com.ianrenton.planesailing.utils.DataMaps;
import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

/**
 * Server for Plane/Sailing.
 */
public class Application {
    public static final Config CONFIG = ConfigFactory.load().getConfig("plane-sailing");
    public static final long START_TIME = System.currentTimeMillis();

    private static Application instance;
    private static final Logger LOGGER = LogManager.getLogger(Application.class);
    private static String softwareVersion = "Unknown";

    private final TrackTable trackTable = new TrackTable();

    private WebServer webServer;
    private final List<Feeder> feeders = new ArrayList<>();

    /**
     * Start the application
     *
     * @param args None used
     */
    public static void main(String[] args) {
        instance = new Application();
        instance.setup();
        instance.run();
    }

    /**
     * Get the application instance singleton
     */
    public static Application getInstance() {
        return instance;
    }

    public void setup() {
        // Fetch software version
        Properties p = new Properties();
        InputStream is = DataMaps.class.getClassLoader().getResourceAsStream("version.properties");
        try {
            p.load(is);
            if (p.containsKey("version")) {
                softwareVersion = p.getProperty("version");
            }
        } catch (IOException e) {
            // Failed to load, just use the default
        }
        LOGGER.info("This is Plane/Sailing Server v{}", softwareVersion);

        try {
            // Load data
            DataMaps.initialise();

            // Set up track table
            trackTable.initialise();

            // Load custom tracks from config
            trackTable.loadCustomTracksFromConfig();

            // Set up web server
            webServer = new WebServer(CONFIG.getInt("comms.web-server.port"));

            // Set up feeders, and clients within them
            List<? extends Config> feedersConfig = CONFIG.getConfigList("comms.feeders");
            if (!feedersConfig.isEmpty()) {
                for (Config c : feedersConfig) {
                    feeders.add(new Feeder(c, trackTable));
                }
            } else {
                LOGGER.error("No feeders are defined, Plane/Sailing Server will not receive any data.");
            }

        } catch (Exception ex) {
            LOGGER.error("Exception when setting up Plane/Sailing Server", ex);
            System.exit(1);
        }
    }

    private void run() {
        try {
            // Run web server thread
            webServer.run();

            // Run data receiver client threads
            for (Feeder f : feeders) {
                f.runAll();
            }

            // Add a JVM shutdown hook to stop threads nicely
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                webServer.stop();
                for (Feeder f : feeders) {
                    f.stopAll();
                }
                trackTable.shutdown();
            }));

            LOGGER.info("Plane/Sailing Server is up and running!");
        } catch (Exception ex) {
            LOGGER.error("Exception when starting Plane/Sailing Server", ex);
            System.exit(1);
        }
    }

    public static String getSoftwareVersion() {
        return softwareVersion;
    }

    public TrackTable getTrackTable() {
        return trackTable;
    }

    public List<Feeder> getFeeders() {
        return feeders;
    }
}
