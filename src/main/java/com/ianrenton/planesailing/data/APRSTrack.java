package com.ianrenton.planesailing.data;

import com.ianrenton.planesailing.app.Application;
import com.ianrenton.planesailing.utils.DataMaps;

import java.io.Serial;
import java.util.Map.Entry;

public class APRSTrack extends Track {
    @Serial
    private static final long serialVersionUID = 1L;
    private static final String DEFAULT_APRS_SYMBOL = "SUGPEVC-----";
    private static final Long DROP_STATIC_APRS_TRACK_TIME = Application.CONFIG.getLong("timing.drop-aprs-track-static-after");
    private static final Long DROP_MOVING_APRS_TRACK_TIME = Application.CONFIG.getLong("timing.drop-aprs-track-moving-after");
    private static final Long DROP_APRS_TRACK_WITH_NO_POS_TIME = Application.CONFIG.getLong("timing.drop-aprs-track-no-position-after");
    private static final Long DROP_APRS_BASE_STATION_TIME = Application.CONFIG.getLong("timing.drop-aprs-base-station-after");

    private String packetDestCall = null;
    private String packetRoute = null;
    private String comment = null;
    private String ssid = null;

    public APRSTrack(String id) {
        super(id);
        setTrackType(TrackType.APRS_MOBILE);
        setSymbolCode(DEFAULT_APRS_SYMBOL);
        positionHistory.setHistoryLength(60 * 60 * 1000); // 1 hour
    }

    public String getPacketDestCall() {
        return packetDestCall;
    }

    public void setPacketDestCall(String packetDestCall) {
        this.packetDestCall = packetDestCall;
    }

    public String getPacketRoute() {
        return packetRoute;
    }

    public void setPacketRoute(String packetRoute) {
        this.packetRoute = packetRoute;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getSSID() {
        return ssid;
    }

    public void setSSID(String ssid) {
        if (ssid != null && ssid.isEmpty()) {
            ssid = "0";
        }

        this.ssid = ssid;

        // Set the right symbol for the SSID if known
        for (Entry<String, String> e : DataMaps.APRS_SSID_TO_SYMBOL.entrySet()) {
            if (ssid.equals(e.getKey())) {
                setSymbolCode(e.getValue());
                break;
            }
        }

        // SSIDs 0, 10 & 13 represent fixed stations, unless a course/speed
        // are known, in which case it must be mobile but the owner hasn't
        // set the SSID properly.
        boolean tmpFixed = (ssid.equals("0") || ssid.equals("10") || ssid.equals("13")) && course == null && speed == null;
        setFixed(tmpFixed);
        setTrackType(tmpFixed ? TrackType.APRS_BASE_STATION : TrackType.APRS_MOBILE);
    }

    @Override
    public void setCourse(Double course) {
        super.setCourse(course);
        // Got a valid course, this is not a fixed track no matter what the SSID says
        setFixed(false);
        setTrackType(TrackType.APRS_MOBILE);
    }

    @Override
    public void setSpeed(Double speed) {
        super.setSpeed(speed);
        // Got a valid speed, this is not a fixed track no matter what the SSID says
        setFixed(false);
        setTrackType(TrackType.APRS_MOBILE);
    }

    @Override
    public boolean shouldDrop() {
        if (positionHistory.isEmpty()) {
            return getTimeSinceLastUpdate() > DROP_APRS_TRACK_WITH_NO_POS_TIME;
        } else if (fixed) {
            return getTimeSinceLastUpdate() > DROP_APRS_BASE_STATION_TIME;
        } else if (getSpeed() == null || getSpeed() < 1.0) {
            return getTimeSinceLastUpdate() > DROP_STATIC_APRS_TRACK_TIME;
        } else {
            return getTimeSinceLastUpdate() > DROP_MOVING_APRS_TRACK_TIME;
        }
    }

    @Override
    public String getTypeDescription() {
        if (isFixed()) {
            return "APRS BASE STATION";
        } else {
            return "APRS MOBILE TRACK";
        }
    }

    @Override
    public String getDisplayInfo1() {
        return (comment != null && !comment.isEmpty()) ? comment : "";
    }

    @Override
    public String getDisplayInfo2() {
        return ((packetDestCall != null && !packetDestCall.isEmpty()) ? (">" + packetDestCall) : "") + ((packetRoute != null && !packetRoute.isEmpty()) ? ("," + packetRoute) : "");
    }
}
