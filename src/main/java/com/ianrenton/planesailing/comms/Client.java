package com.ianrenton.planesailing.comms;

import com.ianrenton.planesailing.app.TrackTable;
import org.apache.logging.log4j.Logger;

public abstract class Client {

    protected final String name;
    protected final TrackTable trackTable;
    protected boolean online;
    protected long lastReceivedTime;

    public Client(String name, TrackTable trackTable) {
        this.name = name;
        this.trackTable = trackTable;
    }

    /**
     * Run the client.
     */
    public abstract void run();

    /**
     * Stop the client.
     */
    public abstract void stop();

    public String getName() {
        return name;
    }

    public ConnectionStatus getStatus() {
        if (online) {
            if (System.currentTimeMillis() - lastReceivedTime <= getTimeoutMillis()) {
                return ConnectionStatus.ACTIVE;
            } else {
                return ConnectionStatus.WAITING;
            }
        } else {
            return ConnectionStatus.OFFLINE;
        }
    }

    /**
     * Get the data type this connection handles.
     */
    public abstract ClientType getType();

    /**
     * Get the subclass logger implementation
     */
    protected abstract Logger getLogger();

    /**
     * Means for implementations to update the "last received time" so
     * we know packets are arriving.
     */
    protected void updatePacketReceivedTime() {
        lastReceivedTime = System.currentTimeMillis();
    }

    /**
     * Means for implementations to provide their preferred socket timeout.
     * We typically get many SBS messages a second, but APRS only rarely,
     * so they have different timeouts.
     */
    protected abstract int getTimeoutMillis();

}