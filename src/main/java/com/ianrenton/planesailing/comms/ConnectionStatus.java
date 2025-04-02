package com.ianrenton.planesailing.comms;

public enum ConnectionStatus {
    OFFLINE("Offline"), WAITING("Waiting"), ACTIVE("Active");

    private final String prettyName;

    ConnectionStatus(String s) {
        prettyName = s;
    }

    public String toString() {
        return prettyName;
    }

}