package com.ianrenton.planesailing.comms;

import com.ianrenton.planesailing.app.TrackTable;
import com.ianrenton.planesailing.data.Radiosonde;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Receiver for HORUS JSON format messages from a UDP socket, e.g. as sent by
 * radiosonde_auto_rx.
 */
public class HORUSJSONUDPReceiver extends Client {

    private static final Logger LOGGER = LogManager.getLogger(HORUSJSONUDPReceiver.class);
    // Expected milliseconds between receiving packets
    private static final int PACKET_RX_RATE_MILLIS = 10800000;
    private final int localPort;
    private final UDPReceiver udpReceiverThread = new UDPReceiver();
    private final PipedOutputStream pipeOS = new PipedOutputStream();
    private boolean run = true;

    /**
     * Create the receiver
     *
     * @param name The name of the connection.
     * @param localPort Port to listen on.
     * @param trackTable The track table to use.
     */
    public HORUSJSONUDPReceiver(String name, int localPort, TrackTable trackTable) {
        super(name, trackTable);
        this.localPort = localPort;

        try {
            InputStream pipeIS = new PipedInputStream(pipeOS);
        } catch (IOException ex) {
            LOGGER.error("Could not set up internal pipe for HORUS Receiver", ex);
        }
    }

    /**
     * Run the receiver.
     */
    public void run() {
        run = true;
        online = true;
        new Thread(udpReceiverThread, "HORUS UDP receiver thread").start();
    }

    /**
     * Stop the receiver.
     */
    public void stop() {
        run = false;
        online = false;
    }

    /**
     * Handle an incoming message.
     */
    private void handle(JSONObject o) {
        try {
            String callsign = o.getString("callsign");

            // If this is a new track, add it to the track table
            if (!trackTable.containsKey(callsign)) {
                Radiosonde newTrack = new Radiosonde(callsign);
                trackTable.put(callsign, newTrack);
            }

            // Extract the data and update the track
            Radiosonde r = (Radiosonde) trackTable.get(callsign);
            if (o.has("latitude") && o.has("longitude")) {
                r.addPosition(o.getDouble("latitude"), o.getDouble("longitude"));
            }
            if (o.has("altitude")) {
                r.setAltitude(o.getDouble("altitude"));
            }
            if (o.has("speed")) {
                double speedKPH = o.getDouble("speed");
                if (speedKPH != -1) {
                    r.setSpeed(speedKPH * 0.54); // KPH to knots
                }
            }
            if (o.has("heading")) {
                double heading = o.getDouble("heading");
                if (heading != -1) {
                    r.setHeading(heading);
                }
            }
            if (o.has("temp")) {
                double tempC = o.getDouble("temp");
                if (tempC > -272) {
                    r.setTemperature(tempC);
                }
            }
            if (o.has("freq")) {
                r.setFrequencyString(o.getString("freq"));
            }
            if (o.has("model")) {
                r.setModel(o.getString("model"));
            }

        } catch (Exception ex) {
            LOGGER.error("Exception handling HORUS data, catching exception so handling can continue.", ex);
        }
    }

    /**
     * Inner receiver thread. Reads datagrams from the UDP socket, pipes them
     * over to the third-party AISInputStreamReader.
     */
    private class UDPReceiver implements Runnable {

        public void run() {
            try {
                DatagramSocket socket = new DatagramSocket(localPort);
                LOGGER.info("Opened local UDP port {} to receive HORUS JSON data.", localPort);

                while (run) {
                    // Read packet from the UDP port and handle it as JSON
                    byte[] buffer = new byte[65507];
                    DatagramPacket p = new DatagramPacket(buffer, buffer.length);
                    socket.receive(p);
                    String text = new String(p.getData(), StandardCharsets.US_ASCII);
                    JSONObject obj = new JSONObject(text);
                    handle(obj);
                    lastReceivedTime = System.currentTimeMillis();

                    Thread.sleep(1000);
                }

                socket.close();

            } catch (Exception ex) {
                LOGGER.error("Exception in AIS Receiver", ex);
            }
        }
    }

    @Override
    public ClientType getType() {
        return ClientType.HORUS;
    }

    @Override
    protected Logger getLogger() {
        return LOGGER;
    }

    @Override
    protected int getTimeoutMillis() {
        return PACKET_RX_RATE_MILLIS * 2;
    }
}
