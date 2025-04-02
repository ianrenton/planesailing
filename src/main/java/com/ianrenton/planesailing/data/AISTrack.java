package com.ianrenton.planesailing.data;

import com.ianrenton.planesailing.app.Application;
import com.ianrenton.planesailing.utils.DataMaps;
import dk.tbsalling.aismessages.ais.messages.types.NavigationStatus;
import dk.tbsalling.aismessages.ais.messages.types.ShipType;

import java.io.Serial;
import java.util.Map.Entry;

public class AISTrack extends Track {
    @Serial
    private static final long serialVersionUID = 1L;
    private static final String DEFAULT_SHIP_SYMBOL = "SUSP------";
    private static final String SHORE_STATION_SYMBOL = "SUGPUUS-----";
    private static final Long DROP_STATIC_SHIP_TRACK_TIME = Application.CONFIG.getLong("timing.drop-ship-track-static-after");
    private static final Long DROP_MOVING_SHIP_TRACK_TIME = Application.CONFIG.getLong("timing.drop-ship-track-moving-after");
    private static final Long DROP_SHIP_TRACK_WITH_NO_POS_TIME = Application.CONFIG.getLong("timing.drop-ship-track-no-position-after");
    private static final Long DROP_AIS_BASE_STATION_TIME = Application.CONFIG.getLong("timing.drop-ais-base-station-after");
    public static final Long MAX_AIS_RANGE = Application.CONFIG.getLong("ranges.expected-ais-range");

    private final int mmsi;
    private String name;
    private ShipType shipType = ShipType.NotAvailable;
    private String shipTypeDescription = null;
    private boolean shoreStation = false;
    private boolean aton = false;
    private NavigationStatus navStatus = NavigationStatus.Undefined;
    private String navStatusDescription = null;
    private String destination = null;

    public AISTrack(int mmsi) {
        super(String.valueOf(mmsi));
        this.mmsi = mmsi;
        // Assume ship by default
        setTrackType(TrackType.SHIP);
        setSymbolCode(DEFAULT_SHIP_SYMBOL);
        positionHistory.setHistoryLength(24 * 60 * 60 * 1000); // 24 hours
        loadDataFromStaticMaps();
    }

    @Override
    public void performPostLoadTasks() {
        loadDataFromStaticMaps();
    }

    /**
     * Load any data from static data maps. Called on track creation and
     * as a post-load task.
     */
    private void loadDataFromStaticMaps() {
        // If we have known names and symbols for this MMSI, set them now
        if (DataMaps.SHIP_MMSI_TO_NAME.containsKey(Integer.toString(mmsi))) {
            setName(DataMaps.SHIP_MMSI_TO_NAME.get(Integer.toString(mmsi)));
        }
        if (DataMaps.SHIP_MMSI_TO_SYMBOL.containsKey(Integer.toString(mmsi))) {
            setSymbolCode(DataMaps.SHIP_MMSI_TO_SYMBOL.get(Integer.toString(mmsi)));
        }
    }

    public int getMmsi() {
        return mmsi;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ShipType getShipType() {
        return shipType;
    }

    public String getShipTypeDescription() {
        return shipTypeDescription;
    }

    public void setShipType(ShipType shipType) {
        if (shipType != null) {
            this.shipType = shipType;

            // Set the right symbol for the ship type if known
            for (Entry<String, String> e : DataMaps.SHIP_TYPE_TO_SYMBOL.entrySet()) {
                if (shipType.getCode() == Integer.parseInt(e.getKey())) {
                    setSymbolCode(e.getValue());
                    break;
                }
            }

            // Set the right description for the ship type if known
            for (Entry<String, String> e : DataMaps.SHIP_TYPE_TO_DESCRIPTION.entrySet()) {
                if (shipType.getCode() == Integer.parseInt(e.getKey())) {
                    shipTypeDescription = e.getValue();
                    break;
                }
            }
        }
    }

    public boolean isShoreStation() {
        return shoreStation;
    }

    public void setShoreStation(boolean shoreStation) {
        this.shoreStation = shoreStation;
        if (shoreStation) {
            setSymbolCode(SHORE_STATION_SYMBOL);
        }
    }

    public boolean isAtoN() {
        return aton;
    }

    public void setAtoN(boolean aton) {
        this.aton = aton;
    }

    public NavigationStatus getNavStatus() {
        return navStatus;
    }

    public void setNavStatus(NavigationStatus navStatus) {
        this.navStatus = navStatus;

        // Set the right description for the nav status if known
        for (Entry<String, String> e : DataMaps.SHIP_NAV_STATUS_TO_DESCRIPTION.entrySet()) {
            if (navStatus.getCode() == Integer.parseInt(e.getKey())) {
                navStatusDescription = e.getValue();
                break;
            }
        }
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public boolean shouldDrop() {
        if (positionHistory.isEmpty()) {
            return getTimeSinceLastUpdate() > DROP_SHIP_TRACK_WITH_NO_POS_TIME;
        } else if (fixed) {
            return getTimeSinceLastUpdate() > DROP_AIS_BASE_STATION_TIME;
        } else if (getSpeed() == null || getSpeed() < 1.0) {
            return getTimeSinceLastUpdate() > DROP_STATIC_SHIP_TRACK_TIME;
        } else {
            return getTimeSinceLastUpdate() > DROP_MOVING_SHIP_TRACK_TIME;
        }
    }

    @Override
    public String getDisplayName() {
        if (name != null) {
            return name;
        }
        return "MMSI " + mmsi;
    }

    @Override
    public String getTypeDescription() {
        if (shoreStation || trackType == TrackType.AIS_SHORE_STATION) {
            return "AIS SHORE STATION";
        } else if (aton || trackType == TrackType.AIS_ATON) {
            return "AID TO NAVIGATION";
        } else if (shipTypeDescription != null) {
            return "SHIP (" + shipTypeDescription.toUpperCase() + ")";
        } else {
            return "SHIP (UNKNOWN TYPE)";
        }
    }

    @Override
    public String getDisplayInfo1() {
        if (navStatusDescription != null && !navStatusDescription.isEmpty() && !navStatusDescription.equals("Undefined")) {
            return "NAV STATUS: " + navStatusDescription.toUpperCase();
        } else {
            return "";
        }
    }

    @Override
    public String getDisplayInfo2() {
        if (destination != null && !destination.isEmpty()) {
            return "DESTINATION: " + destination.toUpperCase();
        } else {
            return "";
        }
    }
}
