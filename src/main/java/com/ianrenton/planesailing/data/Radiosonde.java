package com.ianrenton.planesailing.data;

import com.ianrenton.planesailing.app.Application;

import java.io.Serial;

public class Radiosonde extends Track {
    @Serial
    private static final long serialVersionUID = 1L;
    private static final String DEFAULT_SYMBOL = "SUAPML----";
    private static final Long DROP_RADIOSONDE_TRACK_TIME = Application.CONFIG.getLong("timing.drop-radiosonde-after");
    public static final Long MAX_RADIOSONDE_RANGE = Application.CONFIG.getLong("ranges.expected-radiosonde-range");
    
    private String frequencyString = "";
    private String model = "";
    private Double temperature = null;

    public Radiosonde(String callsign) {
        super(callsign);
        setCallsign(callsign);
        setTrackType(TrackType.RADIOSONDE);
        setSymbolCode(DEFAULT_SYMBOL);
        positionHistory.setHistoryLength(6 * 60 * 60 * 1000); // 6 hours
    }

    /**
     * @return the frequencyString
     */
    public String getFrequencyString() {
        return frequencyString;
    }

    /**
     * @param frequencyString the frequencyString to set
     */
    public void setFrequencyString(String frequencyString) {
        this.frequencyString = frequencyString;
    }

    /**
     * @return the model
     */
    public String getModel() {
        return model;
    }

    /**
     * @param model the model to set
     */
    public void setModel(String model) {
        this.model = model;
    }

    /**
     * @return the temperature
     */
    public Double getTemperature() {
        return temperature;
    }

    /**
     * @param temperature the temperature to set
     */
    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public boolean shouldDrop() {
        return getTimeSinceLastUpdate() > DROP_RADIOSONDE_TRACK_TIME;
    }

    @Override
    public String getDisplayName() {
        return callsign;
    }

    @Override
    public String getTypeDescription() {
        return "RADIOSONDE";
    }

    @Override
    public String getDisplayInfo1() {
        return model + " " + frequencyString;
    }

    @Override
    public String getDisplayInfo2() {
        return (temperature != null) ? "Temp: " + temperature.toString() + "C" : "";
    }
}
