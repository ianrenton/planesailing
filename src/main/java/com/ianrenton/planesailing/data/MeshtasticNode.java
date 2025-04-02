package com.ianrenton.planesailing.data;

import com.ianrenton.planesailing.app.Application;

import java.io.Serial;

public class MeshtasticNode extends Track {
    @Serial
    private static final long serialVersionUID = 1L;
    private static final String DEFAULT_SYMBOL = "SUGPUUSR----";
    public static final Long DROP_MESHTASTIC_TRACK_TIME = Application.CONFIG.getLong("timing.drop-meshtastic-after");
    
    private String shortName = "";
    private String longName = "";
    private String hardware = "";
    private Double channelUtil;
    private Double airUtilTx;
    private Double batteryLevel;
    private Double voltage;
    private Double snr;

    public MeshtasticNode(String id) {
        super(id);
        setTrackType(TrackType.MESHTASTIC_NODE);
        setSymbolCode(DEFAULT_SYMBOL);
        positionHistory.setHistoryLength(DROP_MESHTASTIC_TRACK_TIME);
    }

    /**
     * @return the shortName
     */
    public String getShortName() {
        return shortName;
    }

    /**
     * @param shortName the shortName to set
     */
    public void setShortName(String shortName) {
        this.shortName = shortName;
    }

    /**
     * @return the longName
     */
    public String getLongName() {
        return longName;
    }

    /**
     * @param longName the longName to set
     */
    public void setLongName(String longName) {
        this.longName = longName;
    }

    /**
     * @return the hardware
     */
    public String getHardware() {
        return hardware;
    }

    /**
     * @param hardware the hardware to set
     */
    public void setHardware(String hardware) {
        this.hardware = hardware;
    }

    /**
     * @return the channelUtil
     */
    public Double getChannelUtil() {
        return channelUtil;
    }

    /**
     * @param channelUtil the channelUtil to set
     */
    public void setChannelUtil(double channelUtil) {
        this.channelUtil = channelUtil;
    }

    /**
     * @return the airUtilTx
     */
    public Double getAirUtilTx() {
        return airUtilTx;
    }

    /**
     * @param airUtilTx the airUtilTx to set
     */
    public void setAirUtilTx(double airUtilTx) {
        this.airUtilTx = airUtilTx;
    }

    /**
     * @return the batteryLevel
     */
    public Double getBatteryLevel() {
        return batteryLevel;
    }

    /**
     * @param batteryLevel the batteryLevel to set
     */
    public void setBatteryLevel(double batteryLevel) {
        this.batteryLevel = batteryLevel;
    }

    /**
     * @return the voltage
     */
    public Double getVoltage() {
        return voltage;
    }

    /**
     * @param voltage the voltage to set
     */
    public void setVoltage(double voltage) {
        this.voltage = voltage;
    }

    /**
     * @return the snr
     */
    public Double getSnr() {
        return snr;
    }

    /**
     * @param snr the snr to set
     */
    public void setSnr(double snr) {
        this.snr = snr;
    }

    @Override
    public boolean shouldDrop() {
        return getTimeSinceLastUpdate() > DROP_MESHTASTIC_TRACK_TIME;
    }

    @Override
    public String getDisplayName() {
        if (!longName.isBlank()) {
            return longName;
        } else if (!shortName.isBlank()) {
            return shortName;
        } else {
            return id.replace("!", "");
        }
    }

    @Override
    public String getTypeDescription() {
        return "MESHTASTIC_NODE";
    }

    @Override
    public String getDisplayInfo1() {
        StringBuilder sb = new StringBuilder();
        if (!hardware.isBlank()) {
            sb.append(hardware);
        }
        if (batteryLevel != null) {
            sb.append(String.format(" Batt: %.0f%%", batteryLevel));
        }
        if (voltage != null) {
            sb.append(String.format(" %.2fV", voltage));
        }
        return sb.toString();
    }

    @Override
    public String getDisplayInfo2() {
        StringBuilder sb = new StringBuilder();
        if (snr != null) {
            sb.append(String.format("SNR: %.1fdB", snr));
        }
        if (channelUtil != null) {
            sb.append(String.format(" ChUtil: %.1f%%", channelUtil));
        }
        if (airUtilTx != null) {
            sb.append(String.format(" AirTx: %.1f%%", airUtilTx));
        }
        return sb.toString();
    }
}
