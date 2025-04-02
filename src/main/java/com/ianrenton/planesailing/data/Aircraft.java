package com.ianrenton.planesailing.data;

import com.ianrenton.planesailing.app.Application;
import com.ianrenton.planesailing.utils.DataMaps;

import java.io.Serial;
import java.util.Map.Entry;

public class Aircraft extends Track {
    @Serial
    private static final long serialVersionUID = 1L;
    private static final String DEFAULT_AIRCRAFT_SYMBOL = "SUAPCF----";
    private static final Long DROP_AIR_TRACK_AT_ZERO_ALT_TIME = Application.CONFIG.getLong("timing.drop-air-track-at-zero-alt-after");
    private static final Long DROP_AIR_TRACK_TIME = Application.CONFIG.getLong("timing.drop-air-track-after");
    private static final Long DROP_AIR_TRACK_WITH_NO_POS_TIME = Application.CONFIG.getLong("timing.drop-air-track-no-position-after");
    public static final Long MAX_AIRCRAFT_RANGE = Application.CONFIG.getLong("ranges.expected-aircraft-range");

    private boolean onGround;
    private Integer squawk;
    private String category; // e.g. "A1" = light
    private String categoryDescription; // e.g. "Light"
    private String registration; // aka Tail Number
    private String aircraftTypeShort; // e.g. "A320"
    private String aircraftTypeLong; // e.g. "Airbus A320"
    private String operator; // e.g. "Ryanair"

    // We prefer to use a symbol created from the airline code, because that
    // lets us show symbols for military flights, but we can also set a
    // symbol based on airframe, or on aircraft category, or of course the
    // default symbol for an aircraft. This field tracks what it was set by
    // to make sure only higher-priority things can override the symbol.
    private SymbolSetBy symbolSetBy = SymbolSetBy.DEFAULT;

    public Aircraft(String id) {
        super(id);
        setTrackType(TrackType.AIRCRAFT);
        setSymbolCode(DEFAULT_AIRCRAFT_SYMBOL);
        positionHistory.setHistoryLength(60 * 60 * 1000); // 1 hour
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
        registration = DataMaps.AIRCRAFT_ICAO_HEX_TO_REGISTRATION.getOrDefault(id.toUpperCase(), null);
        aircraftTypeShort = DataMaps.AIRCRAFT_ICAO_HEX_TO_TYPE.getOrDefault(id.toUpperCase(), null);
        if (aircraftTypeShort != null) {
            aircraftTypeLong = DataMaps.AIRCRAFT_TYPE_SHORT_TO_LONG.getOrDefault(aircraftTypeShort, null);
            String symbolCodeFromAirframe = DataMaps.AIRCRAFT_TYPE_SHORT_TO_SYMBOL.getOrDefault(aircraftTypeShort, null);
            if (symbolCodeFromAirframe != null) {
                setSymbolCode(symbolCodeFromAirframe);
                symbolSetBy = SymbolSetBy.AIRFRAME;
            }
        }

        // Set the right symbol code for the ICAO hex if known
        String tmpSymbolCode = DataMaps.AIRCRAFT_ICAO_HEX_TO_SYMBOL.getOrDefault(id.toUpperCase(), null);
        if (tmpSymbolCode != null) {
            setSymbolCode(tmpSymbolCode);
            symbolSetBy = SymbolSetBy.CALLSIGN;
        }
        // Set the right operator for the ICAO hex if known
        String tmpOperator = DataMaps.AIRCRAFT_ICAO_HEX_TO_OPERATOR.getOrDefault(id.toUpperCase(), null);
        if (tmpOperator != null) {
            setOperator(tmpOperator);
        }
    }

    public Integer getSquawk() {
        return squawk;
    }

    /**
     * Consider an aircraft on the ground if:
     * 1) Its ADS-B flag says it is, or
     * 2) Altitude is under 100ft, or
     * 3) Altitude is under 500ft, and falling.
     * This is an arbitrary bit of logic to try and stop aircraft that have clearly landed
     * being dead reckoned well beyond the runway.
     */
    public boolean isOnGround() {
        return onGround || (altitude != null && altitude <= 100) || (altitude != null && verticalRate != null && altitude <= 500 && verticalRate < -2.0);
    }

    @Override
    public void setCallsign(String callsign) {
        super.setCallsign(callsign);

        // Set the right symbol code for the callsign if known
        for (Entry<String, String> e : DataMaps.AIRCRAFT_AIRLINE_CODE_TO_SYMBOL.entrySet()) {
            if (callsign.startsWith(e.getKey())) {
                setSymbolCode(e.getValue());
                symbolSetBy = SymbolSetBy.CALLSIGN;
                break;
            }
        }

        // Set the right operator for the callsign if known
        for (Entry<String, String> e : DataMaps.AIRCRAFT_AIRLINE_CODE_TO_OPERATOR.entrySet()) {
            if (callsign.startsWith(e.getKey())) {
                setOperator(e.getValue());
                break;
            }
        }
    }

    public void setOnGround(boolean onGround) {
        this.onGround = onGround;
    }

    public void setSquawk(int squawk) {
        this.squawk = squawk;
    }

    /**
     * Get the aircraft category (if known), otherwise null.
     */
    public String getCategory() {
        return category;
    }

    /**
     * Get the aircraft category description (if known), otherwise null.
     */
    public String getCategoryDescription() {
        return categoryDescription;
    }

    public void setCategory(String category) {
        this.category = category;

        // Set the right description for the category if known
        for (Entry<String, String> e : DataMaps.AIRCRAFT_CATEGORY_TO_DESCRIPTION.entrySet()) {
            if (category.equals(e.getKey())) {
                categoryDescription = e.getValue();
                break;
            }
        }

        // Set the right symbol for the category if known
        if (symbolSetBy == SymbolSetBy.DEFAULT) {
            for (Entry<String, String> e : DataMaps.AIRCRAFT_CATEGORY_TO_SYMBOL.entrySet()) {
                if (category.equals(e.getKey())) {
                    setSymbolCode(e.getValue());
                    break;
                }
            }
        }
    }

    /**
     * Get the aircraft type (if known), otherwise null.
     */
    public String getAircraftTypeShort() {
        return aircraftTypeShort;
    }

    /**
     * Get the aircraft type description (if known), otherwise null.
     */
    public String getAircraftTypeLong() {
        return aircraftTypeLong;
    }

    /**
     * Get the aircraft registration, aka "tail number" (if known), otherwise null.
     */
    public String getRegistration() {
        return registration;
    }

    /**
     * Get the aircraft operator (if known), otherwise null.
     */
    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public boolean shouldDrop() {
        if (isOnGround()) {
            return getTimeSinceLastUpdate() > DROP_AIR_TRACK_AT_ZERO_ALT_TIME;
        } else if (positionHistory.isEmpty()) {
            return getTimeSinceLastUpdate() > DROP_AIR_TRACK_WITH_NO_POS_TIME;
        } else {
            return getTimeSinceLastUpdate() > DROP_AIR_TRACK_TIME;
        }
    }

    @Override
    public String getDisplayName() {
        if (callsign != null) {
            return callsign;
        } else if (registration != null) {
            return registration;
        } else {
            return "ICAO " + id;
        }
    }

    /**
     * Get the altitude, formatted for display. Overrides the default
     * format to provide it in Flight Level and show climbing/falling
     * indicator.
     */
    public String getDisplayAltitude() {
        String ret = "";
        if (altitude != null) {
            ret += "FL" + Math.round(altitude / 100.0);
            if (verticalRate != null) {
                if (verticalRate > 2) {
                    ret += " + ";
                } else if (verticalRate < -2) {
                    ret += " - ";
                }
            }
        }
        return ret;
    }

    @Override
    public String getTypeDescription() {
        if (aircraftTypeLong != null && !aircraftTypeLong.isEmpty()) {
            return aircraftTypeLong.toUpperCase();
        } else if (aircraftTypeShort != null && !aircraftTypeShort.isEmpty() && categoryDescription != null && !categoryDescription.isEmpty()) {
            return aircraftTypeShort.toUpperCase() + " (" + categoryDescription.toUpperCase() + ")";
        } else if (aircraftTypeShort != null && !aircraftTypeShort.isEmpty()) {
            return aircraftTypeShort.toUpperCase();
        } else if (categoryDescription != null && !categoryDescription.isEmpty()) {
            return "AIRCRAFT (" + categoryDescription.toUpperCase() + ")";
        } else {
            return "AIRCRAFT (UNKNOWN TYPE)";
        }
    }

    @Override
    public String getDisplayInfo1() {
        return (operator != null) ? ("OPERATOR: " + operator.toUpperCase()) : "";
    }

    @Override
    public String getDisplayInfo2() {
        return (squawk != null) ? String.format("SQUAWK: %04d", squawk) : "";
    }

    private enum SymbolSetBy {
        CALLSIGN, ICAO_HEX, AIRFRAME, CATEGORY, DEFAULT
    }
}
