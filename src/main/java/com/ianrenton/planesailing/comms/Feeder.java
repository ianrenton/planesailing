package com.ianrenton.planesailing.comms;

import com.typesafe.config.Config;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import com.ianrenton.planesailing.app.TrackTable;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Class representing a feeder, which may have one or more receiver clients within it.
 */
public class Feeder {
    private static final Logger LOGGER = LogManager.getLogger(Feeder.class);
    private final String name;
    private final List<Client> receivers = new ArrayList<>();

    /**
     * Create a new feeder by providing a name and list of receiver clients
     * @param name The name of the feeder
     * @param receivers The receivers it should use
     */
    public Feeder(String name, List<Client> receivers) {
        this.name = name;
        this.receivers.addAll(receivers);
    }

    /**
     * Create a new feeder from config
     * @param config The config object for the feeder
     * @param trackTable Reference to the track table so the receiver clients can connect to it
     */
    public Feeder(Config config, TrackTable trackTable) {
        name = config.getString("name");

        List<? extends Config> receiversConfig = config.getConfigList("receivers");
        for (Config c : receiversConfig) {
            ClientType type = ClientType.valueOf(c.getString("type"));
            switch (type) {
                case AIS -> receivers.add(new AISUDPReceiver(c.getString("name"), c.getInt("port"), trackTable));
                case ADSB -> {
                    switch (c.getString("protocol")) {
                        case "dump1090json" ->
                                receivers.add(new Dump1090JSONReader(c.getString("name"), c.getString("file"), trackTable));
                        case "beastbinary" ->
                                receivers.add(new BEASTBinaryTCPClient(c.getString("name"), c.getString("host"), c.getInt("port"), trackTable, false));
                        case "beastavr" ->
                                receivers.add(new BEASTAVRTCPClient(c.getString("name"), c.getString("host"), c.getInt("port"), trackTable));
                        case "sbs" ->
                                receivers.add(new SBSTCPClient(c.getString("name"), c.getString("host"), c.getInt("port"), trackTable, false));
                        default ->
                                LOGGER.error("Unknown air data protocol '{}'. Options are 'beastbinary', 'beastavr' and 'sbs'.", c.getString("protocol"));
                    }
                }
                case MLAT -> {
                    switch (c.getString("protocol")) {
                        case "beastbinary" ->
                                receivers.add(new BEASTBinaryTCPClient(c.getString("name"), c.getString("host"), c.getInt("port"), trackTable, true));
                        case "sbs" ->
                                receivers.add(new SBSTCPClient(c.getString("name"), c.getString("host"), c.getInt("port"), trackTable, true));
                        default ->
                                LOGGER.error("Unknown air data protocol '{}'. Options are 'beastbinary' and 'sbs'.", c.getString("comms.mlat-receiver.protocol"));
                    }
                }
                case APRS -> receivers.add(new APRSTCPClient(c.getString("name"), c.getString("host"), c.getInt("port"), trackTable));
                case HORUS -> receivers.add(new HORUSJSONUDPReceiver(c.getString("name"), c.getInt("port"), trackTable));
                case MESHTASTIC -> receivers.add(new MeshtasticNodeQuerier(c.getString("name"), c.getString("command"), c.getInt("poll-interval-sec"), trackTable));
            }
        }
    }

    /**
     * Get the name of the feeder
     */
    public String getName() {
        return name;
    }

    /**
     * Get all receiver clients used by this feeder
     */
    public List<Client> getReceivers() {
        return receivers;
    }

    /**
     * Run all receiver clients
     */
    public void runAll() {
        receivers.forEach(Client::run);
    }

    /**
     * Stop all receiver clients
     */
    public void stopAll() {
        receivers.forEach(Client::stop);
    }

    /**
     * Get a connection status summary for all receiver clients' status.
     */
    public Map<String, ConnectionStatus> getStatus() {
        return receivers.stream().collect(Collectors.toMap(Client::getName, Client::getStatus));
    }
}
