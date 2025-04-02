package com.ianrenton.planesailing.data;

import java.io.Serial;

public class Seaport extends Track {
    @Serial
    private static final long serialVersionUID = 1L;
    private static final String SEAPORT_SYMBOL = "SFGPIBN---H-";
    private static int seaportCount;

    private final String name;

    public Seaport(String name, double lat, double lon) {
        super("SEAPORT-" + seaportCount++);
        this.name = name;
        setCreatedByConfig(true);
        setTrackType(TrackType.SEAPORT);
        setSymbolCode(SEAPORT_SYMBOL);
        addPosition(lat, lon);
    }

    public String getName() {
        return name;
    }

    @Override
    public String getDisplayName() {
        return name;
    }

    @Override
    public String getTypeDescription() {
        return "SEAPORT";
    }

    @Override
    public String getDisplayInfo1() {
        return "";
    }

    @Override
    public String getDisplayInfo2() {
        return "";
    }
}
