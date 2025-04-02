package com.ianrenton.planesailing.comms;

import com.ianrenton.planesailing.app.TrackTable;

import java.io.IOException;
import java.io.InputStream;
import java.net.Socket;
import java.util.concurrent.TimeUnit;

/**
 * Generic line-reading TCP client implementation, to abstract out commonality
 * between SBS and APRS clients.
 */
public abstract class TCPClient extends Client {

    protected final String remoteHost;
    protected final int remotePort;
    final Receiver receiver = new Receiver();
    protected boolean run = true;

    /**
     * Create the client
     *
     * @param name       The name of the connection.
     * @param remoteHost Host to connect to.
     * @param remotePort Port to connect to.
     * @param trackTable The track table to use.
     */
    public TCPClient(String name, String remoteHost, int remotePort, TrackTable trackTable) {
        super(name, trackTable);
        this.remoteHost = remoteHost;
        this.remotePort = remotePort;
    }

    @Override
    public void run() {
        run = true;
        new Thread(receiver, getType() + " receiver thread").start();
    }

    @Override
    public void stop() {
        run = false;
    }

    /**
     * Read data from the stream, and process it if appropriate.
     * This method can block for as long as it likes trying to
     * read, but the TCP server implements a socket timeout so
     * after a certain amount of time any read operation on the
     * stream will fail.
     *
     * @param in The input stream to read data from.
     * @return true if data was successfully read this time,
     * regardless of whether we chose to process it or not. False
     * if the read operation failed, and we need to reconnect
     * the socket.
     */
    protected abstract boolean read(InputStream in);

    /**
     * Inner receiver thread. Reads lines from the TCP socket, and provides them
     * to the handle() method.
     */
    private class Receiver implements Runnable {

        private Socket clientSocket;
        private InputStream in;

        public void run() {
            while (run) {
                while (run) {
                    // Try to connect
                    try {
                        getLogger().info("Trying to make TCP connection to {}:{} to receive {}...", remoteHost, remotePort, getType());
                        clientSocket = new Socket(remoteHost, remotePort);
                        clientSocket.setSoTimeout(getTimeoutMillis());
                        clientSocket.setSoLinger(false, 0);
                        clientSocket.setKeepAlive(true);
                        clientSocket.setReuseAddress(true);
                        in = clientSocket.getInputStream();
                        online = true;
                        getLogger().info("Receiver {} connected.", getType());
                        break;
                    } catch (IOException e) {
                        try {
                            getLogger().warn("Receiver {} could not connect ({}), trying again in one minute...", getType(), e.getLocalizedMessage());
                            TimeUnit.MINUTES.sleep(1);
                        } catch (InterruptedException ie) {
                            // This is fine, carry on
                        }
                    }
                }

                while (run) {
                    boolean ok = read(in);
                    if (!ok) {
                        getLogger().warn("Receiver {} read failed, reconnecting...", getType());
                        try {
                            online = false;
                            Thread.sleep(1000);
                            clientSocket.close();
                            break;
                        } catch (IOException | InterruptedException e) {
                            // Probably closed anyway
                        }
                    }
                }
            }
        }
    }
}