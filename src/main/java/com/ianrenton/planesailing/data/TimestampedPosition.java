package com.ianrenton.planesailing.data;

import java.io.Serial;
import java.io.Serializable;

/**
 * @param latitude  degrees
 * @param longitude degrees
 * @param time      UTC millis since epoch
 */
public record TimestampedPosition(double latitude, double longitude,
                                  long time) implements Comparable<TimestampedPosition>, Serializable {

    @Serial
    private static final long serialVersionUID = 1L;


    /**
     * Get the time, in UTC milliseconds since UNIX epoch, of this position update.
     */
    @Override
    public long time() {
        return time;
    }

    /**
     * Get the age in milliseconds of this position update.
     */
    public long getAge() {
        return System.currentTimeMillis() - time;
    }

    /**
     * Sort by time.
     */
    public int compareTo(TimestampedPosition o) {
        return Long.compare(this.time, o.time);
    }
}
