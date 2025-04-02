package com.ianrenton.planesailing.data;

import java.io.Serial;
import java.io.Serializable;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Position history for a track.
 */
public class PositionHistory extends CopyOnWriteArrayList<TimestampedPosition> implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;
    private long historyLength = Long.MAX_VALUE;

    /**
     * Create a position history.
     *
     * @param historyLength Length, in milliseconds, that the history should preserve.
     */
    public void setHistoryLength(long historyLength) {
        this.historyLength = historyLength;
        cull();
    }

    public long getHistoryLength() {
        return historyLength;
    }

    /**
     * Add a position, or if the position is unchanged, remove the previous position
     * before adding this one with the updated timestamp. This avoids having massive
     * position histories for fixed objects.
     */
    public boolean add(TimestampedPosition p) {
        if (!isEmpty()) {
            TimestampedPosition lastP = get(size() - 1);
            if (lastP.latitude() == p.latitude() && lastP.longitude() == p.longitude()) {
                remove(size() - 1);
            }
        }
        return super.add(p);
    }

    /**
     * Get the most recent entry, or null if the history is empty.
     */
    public TimestampedPosition getLatest() {
        if (!isEmpty()) {
            return get(size() - 1);
        }
        return null;
    }

    /**
     * Cull history older than historyLength.
     */
    public void cull() {
        long threshold = System.currentTimeMillis() - historyLength;
        removeIf(e -> e.time() < threshold);
    }

    /**
     * Keep only the latest position and remove any older ones.
     */
    public void keepOnlyLatest() {
        if (size() > 1) {
            subList(0, size() - 1).clear();
        }
    }
}
