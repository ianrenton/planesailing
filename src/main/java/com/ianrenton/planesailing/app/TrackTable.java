package com.ianrenton.planesailing.app;

import com.ianrenton.planesailing.data.*;
import com.typesafe.config.ConfigList;
import com.typesafe.config.ConfigValue;
import org.apache.commons.lang3.SerializationException;
import org.apache.commons.lang3.SerializationUtils;
import org.apache.commons.lang3.concurrent.BasicThreadFactory;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.opensky.libadsb.Position;

import java.io.*;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.*;

/**
 * Track table
 */
public class TrackTable extends ConcurrentHashMap<String, Track> {

    public static final double METRES_TO_NMI = 0.000539957;

    @Serial
    private static final long serialVersionUID = 1L;
    private static final Logger LOGGER = LogManager.getLogger(TrackTable.class);

    private transient final File serializationFile = new File("track_data_store.dat");

    public final Map<Integer, String> aisNameCache = new ConcurrentHashMap<>();

    private Position baseStationPosition = null;

    private transient final ScheduledExecutorService scheduledExecutorService = Executors.newScheduledThreadPool(2, new BasicThreadFactory.Builder().namingPattern("Track Table Processing Thread %d").build());
    @SuppressWarnings("rawtypes")
    private transient ScheduledFuture maintenanceTask;
    @SuppressWarnings("rawtypes")
    private transient ScheduledFuture backupTask;

    private final transient boolean printTrackTableToStdOut = Application.CONFIG.getBoolean("print-track-table-to-stdout");

    /**
     * Set up the track table, using data found on disk if present. Spawns internal
     * threads to run scheduled tasks such as culling old positions, printing status
     * data, and backing up the track table to disk.
     * <p>
     * This must be called before using the track table, unless creating one for
     * unit tests.
     */
    public void initialise() {
        // Load data from serialised track data store, and immediately delete
        // anything too old to survive
        loadFromFile();
        cullOldPositionData();
        dropExpiredTracks();

        // Set up tasks to run in the background
        maintenanceTask = scheduledExecutorService.scheduleWithFixedDelay(new MaintenanceTask(), 10, 10, TimeUnit.SECONDS);
        backupTask = scheduledExecutorService.scheduleWithFixedDelay(new BackupTask(), 10, 600, TimeUnit.SECONDS);
    }

    private long countTracksOfType(TrackType t) {
        return values().stream().filter(track -> track.getTrackType() == t).count();
    }

    /**
     * Delete position data older than the threshold for all non-fixed tracks.
     * For fixed tracks, just leave the single most recent position (regardless
     * of age) since it won't have moved anyway.
     */
    private void cullOldPositionData() {
        for (Track t : values()) {
            try {
                if (!t.isFixed()) {
                    t.getPositionHistory().cull();
                } else {
                    t.getPositionHistory().keepOnlyLatest();
                }
            } catch (Exception ex) {
                LOGGER.error("Caught exception when culling old position data for {}, continuing...", t.getDisplayName(), ex);
            }
        }
    }

    /**
     * Drop any tracks that have no current data
     */
    private void dropExpiredTracks() {
        for (Iterator<Entry<String, Track>> it = entrySet().iterator(); it.hasNext(); ) {
            Track t = it.next().getValue();
            try {
                if (t.shouldDrop()) {
                    it.remove();
                }
            } catch (Exception ex) {
                LOGGER.error("Caught exception when checking if {} should be dropped, continuing...", t.getDisplayName(), ex);
            }
        }
    }

    /**
     * Load data from serialisation file on disk.
     */
    public void loadFromFile() {
        loadFromFile(serializationFile);
    }

    /**
     * Load data from serialisation file on disk.
     */
    public void loadFromFile(File file) {
        if (file.exists()) {
            try {
                clear();
                ObjectInputStream ois = new ObjectInputStream(new FileInputStream(file));
                TrackTable newTT = (TrackTable) ois.readObject();
                ois.close();
                copy(newTT);
                LOGGER.info("Loaded {} tracks from track data store at {}", size(), file.getAbsolutePath());
                LOGGER.info("Loaded {} AIS names from track data store", aisNameCache.size());

                // Perform post-load tasks on each loaded track
                for (Track t : values()) {
                    t.performPostLoadTasks();
                }
            } catch (SerializationException | IOException | ClassNotFoundException | ClassCastException ex) {
                LOGGER.error("Exception loading track data store. Deleting the file so this doesn't reoccur.", ex);
                boolean success = file.delete();
                if (!success) {
                    LOGGER.error("Failed to delete the file, check file permissions!");
                }
            }
        } else {
            LOGGER.info("Track table file did not exist in {}, probably first startup.", file.getAbsolutePath());
        }
    }

    /**
     * Save data to serialisation file on disk.
     */
    public void saveToFile() {
        saveToFile(serializationFile);
    }

    /**
     * Save data to serialisation file on disk.
     */
    public void saveToFile(File file) {
        try {
            LOGGER.info("Saving to track data store...");
            if (file.exists()) {
                if (!file.delete()) {
                    LOGGER.error("Failed to delete old track data store before writing a new one, check file permissions!");
                }
            }

            ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(file));
            // Deep copy to avoid concurrent modification problems when the track table
            // contents are modified during save. While the top level object uses
            // ConcurrentHashMap to avoid this problem, we should not be forcing that
            // implementation detail on the whole tree of objects inside the table.
            TrackTable copy = SerializationUtils.clone(this);
            oos.writeObject(copy);
            oos.flush();
            oos.close();
            LOGGER.info("Saved {} tracks to track data store at {}", size(), file.getAbsolutePath());
            LOGGER.info("Saved {} AIS names to track data store", aisNameCache.size());
        } catch (IOException e) {
            LOGGER.error("Could not save track table to {}", file.getAbsolutePath(), e);
        }
    }

    /**
     * Copy another track table into this one
     */
    public void copy(TrackTable tt) {
        this.putAll(tt);
        this.aisNameCache.putAll(tt.getAISNameCache());
    }

    /**
     * Read the "custom tracks" (base station, airports and seaports) from the config file
     * and populate the track table.
     */
    @SuppressWarnings("unchecked")
    public void loadCustomTracksFromConfig() {
        // First, remove any existing base stations, airports and seaports from the track table.
        // We are loading a new set from config so we don't want to duplicate any old ones.
        values().removeIf(t -> t.getTrackType() == TrackType.BASE_STATION
                || t.getTrackType() == TrackType.AIRPORT
                || t.getTrackType() == TrackType.SEAPORT);

        // Now load.
        ConfigList baseStationConfigs = Application.CONFIG.getList("custom-tracks.base-stations");
        for (ConfigValue c : baseStationConfigs) {
            Map<String, Object> data = (Map<String, Object>) c.unwrapped();
            BaseStation bs = new BaseStation((String) data.get("name"),
                    ((Number) data.get("lat")).doubleValue(),
                    ((Number) data.get("lon")).doubleValue());
            put(bs.getID(), bs);
            // Special case - store the first base station's position as the ADS-B decoder
            // will want that. Note Position takes longitude first!
            baseStationPosition = new Position(
                    ((Number) data.get("lon")).doubleValue(),
                    ((Number) data.get("lat")).doubleValue(),
                    ((Number) data.get("alt")).doubleValue());
        }
        LOGGER.info("Loaded {} base stations from config file", baseStationConfigs.size());

        ConfigList airportConfigs = Application.CONFIG.getList("custom-tracks.airports");
        for (ConfigValue c : airportConfigs) {
            Map<String, Object> data = (Map<String, Object>) c.unwrapped();
            Airport ap = new Airport((String) data.get("name"),
                    ((Number) data.get("lat")).doubleValue(),
                    ((Number) data.get("lon")).doubleValue(),
                    (String) data.get("icao-code"));
            put(ap.getID(), ap);
        }
        LOGGER.info("Loaded {} airports from config file", airportConfigs.size());

        ConfigList seaportConfigs = Application.CONFIG.getList("custom-tracks.seaports");
        for (ConfigValue c : seaportConfigs) {
            Map<String, Object> data = (Map<String, Object>) c.unwrapped();
            Seaport sp = new Seaport((String) data.get("name"),
                    ((Number) data.get("lat")).doubleValue(),
                    ((Number) data.get("lon")).doubleValue());
            put(sp.getID(), sp);
        }
        LOGGER.info("Loaded {} seaports from config file", seaportConfigs.size());
    }

    public Map<Integer, String> getAISNameCache() {
        return aisNameCache;
    }

    public Position getBaseStationPosition() {
        return baseStationPosition;
    }

    /**
     * Returns the distance from the base station to the given track. If either the base station
     * position or the track position is unknown, return null.
     */
    public Double getDistanceFromBaseStation(Track t) {
        if (baseStationPosition != null && t != null && t.getPosition() != null) {
            return baseStationPosition.haversine(new Position(t.getPosition().longitude(), t.getPosition().latitude(), 0.0));
        } else {
            return null;
        }
    }

    /**
     * Returns the distance from the base station to the given track. If either the base station
     * position or the track position is unknown, return zero.
     */
    public double getDistanceFromBaseStationOrZero(Track t) {
        Double d = getDistanceFromBaseStation(t);
        return d != null ? d : 0.0;
    }

    /**
     * <p>Return true if the position provided is considered "reasonable" for a track of the given type. For aircraft and
     * AIS tracks, the position is compared against the base station position and expected ranges set in the config file
     * to determine whether this is reasonable or likely to be dodgy data. Checks performed are as follows:</p>
     * <ul>
     *     <li>If latitude or longitude are outside their numeric bounds, return false (corrupt or test data)</li>
     *     <li>If latitude and longitude are exactly zero, return false (bad transponder reporting 0,0 for no data)</li>
     *     <li>If no base station position is provided, return true (can't tell if positions are reasonable, assume they
     *     are</li>
     *     <li>If the type is null, return false (we don't want to accidentally add a position that will then become
     *     "unreasonable" once we know the type)</li>
     *     <li>If the type is base station, airport or seaport, return true (these are pre-programmed)</li>
     *     <li>If the type is APRS, return true (APRS is repeated so there is no reasonableness check for range)</li>
     *     <li>For the remaining types (aircraft & AIS) compare the range from the base station against the configued
     *     limits. Return true if their range looks reasonable, false otherwise.</li>
     * </ul>
     *
     * @param latitude  Latitude, decimal degrees
     * @param longitude Longitude, decimal degrees
     * @param type      The type of track
     */
    public boolean isReasonablePosition(double latitude, double longitude, TrackType type) {
        if (latitude < -90.0 || latitude > 90.0 || longitude < -180.0 || longitude > 180.0) {
            return false;
        }
        if (latitude == 0.0 && longitude == 0.0) {
            return false;
        }
        if (baseStationPosition == null) {
            return true;
        }
        if (type == null) {
            return false;
        }
        switch (type) {
            case AIRCRAFT -> {
                return baseStationPosition.haversine(new Position(longitude, latitude, 0.0)) * METRES_TO_NMI <= Aircraft.MAX_AIRCRAFT_RANGE;
            }
            case SHIP, AIS_ATON, AIS_SHORE_STATION -> {
                return baseStationPosition.haversine(new Position(longitude, latitude, 0.0)) * METRES_TO_NMI <= AISTrack.MAX_AIS_RANGE;
            }
            case RADIOSONDE -> {
                return baseStationPosition.haversine(new Position(longitude, latitude, 0.0)) * METRES_TO_NMI <= Radiosonde.MAX_RADIOSONDE_RANGE;
            }
            default -> {
                return true;
            }
        }
    }

    /**
     * Print some debug data
     */
    public void printStatusData() {
        StringBuilder summary = new StringBuilder();
        for (TrackType t : TrackType.values()) {
            long count = countTracksOfType(t);
            if (count > 0) {
                summary.append(count).append(" ").append(t).append("   ");
            }
        }
        LOGGER.info("Track table contains: {}", summary);

        if (printTrackTableToStdOut && !isEmpty()) {
            LOGGER.info("----------------------------------------------------------------------------------");
            LOGGER.info("Name                 Type       Description                               Age (ms)");
            LOGGER.info("----------------------------------------------------------------------------------");
            for (Track e : values()) {
                LOGGER.info("{} {} {} {} {}",
                        String.format("%-20.20s", e.getDisplayName()),
                        String.format("%-10.10s", e.getTrackType()),
                        String.format("%-20.20s", e.getDisplayInfo1()),
                        String.format("%-20.20s", e.getDisplayInfo2()),
                        e.getTimeSinceLastUpdate() != null ? String.format("%-6.6s", e.getTimeSinceLastUpdate()) : "------");
            }
            LOGGER.info("----------------------------------------------------------------------------------");
        }
    }

    /**
     * Stop internal threads and prepare for shutdown.
     */
    public void shutdown() {
        maintenanceTask.cancel(true);
        backupTask.cancel(true);
        saveToFile();
    }

    /**
     * Scheduled maintenance task that runs while the track table is running.
     */
    private class MaintenanceTask implements Runnable {

        @Override
        public void run() {
            try {
                printStatusData();
                cullOldPositionData();
                dropExpiredTracks();
            } catch (Throwable t) {
                LOGGER.error("Caught exception in maintenance task, continuing...", t);
            }
        }
    }

    /**
     * Scheduled backup task that runs while the track table is running.
     */
    private class BackupTask implements Runnable {

        @Override
        public void run() {
            try {
                saveToFile();
            } catch (Throwable t) {
                LOGGER.error("Caught exception in backup task, continuing...", t);
            }
        }
    }
}
