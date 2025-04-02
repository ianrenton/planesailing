package com.ianrenton.planesailing.comms;

import com.ianrenton.planesailing.app.TrackTable;
import com.ianrenton.planesailing.data.Aircraft;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.opensky.libadsb.ModeSDecoder;
import org.opensky.libadsb.Position;
import org.opensky.libadsb.exceptions.BadFormatException;
import org.opensky.libadsb.exceptions.UnspecifiedFormatError;
import org.opensky.libadsb.msgs.*;
import org.opensky.libadsb.tools;

import java.io.IOException;
import java.io.InputStream;

/**
 * Receiver for ADS-B & other Mode S/A/C messages, in BEAST binary format:
 * binary message type, timestamp, signal level and raw Mode S/A/C message, with
 * 0x1a delimiter. (This is output by Dump1090 on port 30005 for directly
 * received messages, and MLAT information can be output in the same format by
 * enabling a config option.)
 */
public class BEASTBinaryTCPClient extends TCPClient {

    private static final Logger LOGGER = LogManager.getLogger(BEASTBinaryTCPClient.class);
    private static final byte ESC = (byte) 0x1a;
    private static final String COMMB_CALLSIGN_BASE64 = "@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_ !\"#$%&'()*+,-./0123456789:;<=>?";
    private static final ModeSDecoder DECODER = new ModeSDecoder();

    private final boolean mlat;
    private final int socketTimeoutMillis;

    /**
     * Create the client
     *
     * @param name       The name of the connection.
     * @param remoteHost Host to connect to.
     * @param remotePort Port to connect to.
     * @param trackTable The track table to use.
     * @param mlat       true if this connection will be receiving MLAT data, false
     *                   if it will be receiving Mode-S/ADS-B data from a local
     *                   radio.
     */
    public BEASTBinaryTCPClient(String name, String remoteHost, int remotePort, TrackTable trackTable, boolean mlat) {
        super(name, remoteHost, remotePort, trackTable);
        this.mlat = mlat;
        socketTimeoutMillis = mlat ? 600000 : 60000; // 1 min for local data, 10 min for MLAT from server
    }

    @Override
    protected boolean read(InputStream in) {
        try {
            byte[] buffer = new byte[1000];
            int bytesReceived = 0;
            int i;
            while ((i = in.read()) != -1) {
                byte b = (byte) i;
                if (b == ESC) {
                    // We found an 0x1a escape character, now we need to read the next
                    // byte to determine if it's on its own (thus a message
                    // delimiter) or if it's followed by another, in which case it's
                    // an escaped real 0x1a byte.
                    byte b2 = (byte) in.read();
                    if (b2 == ESC) {
                        // Two 0x1a in a row isn't a delimiter, just an escaped
                        // 0x1a, so add a single one to the buffer and keep reading
                        buffer[bytesReceived++] = b;
                    } else {
                        // This was a delimiter, so extract a message, and reset
                        // the buffer, making sure this extra character we read
                        // goes in there. Minimum message size is Mode A/C at
                        // 10 bytes so if it's shorter than that, skip it
                        if (bytesReceived >= 10) {
                            updatePacketReceivedTime();
                            byte[] beastBytes = new byte[bytesReceived];
                            System.arraycopy(buffer, 0, beastBytes, 0, bytesReceived);
                            try {
                                handle(stripHeader(beastBytes));
                            } catch (Exception ex) {
                                LOGGER.error("Encountered an exception when handling a BEAST binary packet.", ex);
                            }
                        } else {
                            LOGGER.error("Received message too small, skipping...");
                        }

                        // Reset the buffer, and add the extra character to it
                        buffer = new byte[1000];
                        buffer[0] = b2;
                        bytesReceived = 1;
                    }

                } else {
                    // New non-delimiter byte found, add to the buffer
                    buffer[bytesReceived++] = b;
                }
            }
            return false;
        } catch (IOException ex) {
            getLogger().warn("Exception encountered in Receiver {}.", getType(), ex);
            return false;
        }
    }

    /**
     * <p>
     * Remove the header data from BEAST binary format, leaving just the raw
     * Mode-S/A/C bytes. We remove:
     * </p>
     * <ul>
     * <li>Byte 0, which gives the message type (the Mode S parser will handle the
     * message based on its length regardless)</li>
     * <li>Bytes 1-6, which contain the timestamp (a server doing MLAT would need
     * this but we don't care, we know the packet is "live enough")</li>
     * <li>Byte 7, which contains the signal strength (Plane/Sailing doesn't use
     * this)</li>
     * </ul>
     */
    private static byte[] stripHeader(byte[] data) {
        byte[] ret = new byte[data.length - 8];
        System.arraycopy(data, 8, ret, 0, data.length - 8);
        return ret;
    }

    /**
     * Handle a new packet of ADS-B, Mode S/A/C or MLAT data.
     *
     * @param data The packet, in binary form.
     */
    private void handle(byte[] data) {
        try {
            // Modify MLAT data to look like "real" ADS-B data
            byte[] fudgedData = fudgeMLATData(data);
            // Handle the message
            handle(DECODER.decode(fudgedData), trackTable, name);

        } catch (BadFormatException e) {
            LOGGER.debug("Malformed message skipped. Message: {}", e.getMessage());
        } catch (UnspecifiedFormatError e) {
            LOGGER.debug("Unspecified message skipped.");
        }
    }

    /**
     * Hack to handle MLAT data. java-ADSB doesn't support MLAT data yet (see
     * <a href="https://github.com/openskynetwork/java-adsb/issues/32">...</a>) even though it has all
     * the decoding logic to do so, just because it doesn't understand downlink
     * format 18, first field 2 is decodable. Before we decode the message, we check
     * for this case and set the first field to zero, making MLAT look just like a
     * "real" directly received ADS-B message.
     */
    private byte[] fudgeMLATData(byte[] data) {
        byte tmp = data[0];
        byte firstField = (byte) (tmp & 0x7);
        byte downlinkFormat = (byte) (tmp >>> 3 & 0x1F);

        if (downlinkFormat == 18 && firstField == 2) {
            data[0] = (byte) (tmp & 0xF8);
        }
        return data;
    }

    /**
     * Handle a new line of ADS-B Mode S data. Based on
     * <a href="https://github.com/openskynetwork/java-adsb/blob/master/src/main/java/org/opensky/example/ExampleDecoder.java">...</a>
     * <p>
     * Package-private and static so that BEASTAVRTCPClient can use it as well.
     *
     * @param msg        The Mode S packet
     * @param trackTable The track table to use
     * @param name       The name of this connection. Used only for logging.
     */
    static void handle(ModeSReply msg, TrackTable trackTable, String name) {
        try {
            // Get the ICAO 24-bit hex code
            String icao24 = tools.toHexString(msg.getIcao24());

            // If this is a new track, add it to the track table
            if (!trackTable.containsKey(icao24)) {
                trackTable.put(icao24, new Aircraft(icao24));
            }

            // Extract the data and update the track
            Aircraft a = (Aircraft) trackTable.get(icao24);

            // now check the message type / downlink format, and unpack data as necessary.
            switch (msg.getType()) {
                case ADSB_AIRBORN_POSITION_V0:
                case ADSB_AIRBORN_POSITION_V1:
                case ADSB_AIRBORN_POSITION_V2:
                    AirbornePositionV0Msg ap0 = (AirbornePositionV0Msg) msg;

                    // Figure out a position. If we have a real position decoded "properly" using
                    // two packets (odd and even) then use it. Otherwise, we fall back on the "local
                    // position" provided in the single packet we just received. This will be less
                    // accurate and will only work for planes within 180 nmi of the base station,
                    // but should be good enough to get us some kind of position rather than having
                    // it blank in the track table and no icon shown.
                    Position airPos = DECODER.decodePosition(System.currentTimeMillis(), ap0,
                            trackTable.getBaseStationPosition());
                    Position localPos = ap0.getLocalPosition(trackTable.getBaseStationPosition());
                    if (airPos != null) {
                        a.addPosition(airPos.getLatitude(), airPos.getLongitude());
                    } else if (localPos != null) {
                        a.addPosition(localPos.getLatitude(), localPos.getLongitude());
                    }

                    // Get an altitude, this could be barometric or geometric but Plane/Sailing
                    // doesn't really care
                    if (ap0.hasAltitude()) {
                        a.setAltitude(ap0.getAltitude().doubleValue());
                    }

                    // Got this message so we know this is airborne
                    a.setOnGround(false);
                    break;

                case ADSB_SURFACE_POSITION_V0:
                case ADSB_SURFACE_POSITION_V1:
                case ADSB_SURFACE_POSITION_V2:
                    SurfacePositionV0Msg sp0 = (SurfacePositionV0Msg) msg;

                    // Figure out a position. If we have a real position decoded "properly" using
                    // two packets (odd and even) then use it. Otherwise, we fall back on the "local
                    // position" provided in the single packet we just received. This will be less
                    // accurate and will only work for planes within 180 nmi of the base station,
                    // but should be good enough to get us some kind of position rather than having
                    // it blank in the track table and no icon shown.
                    Position surPos = DECODER.decodePosition(System.currentTimeMillis(), sp0,
                            trackTable.getBaseStationPosition());
                    Position localPos2 = sp0.getLocalPosition(trackTable.getBaseStationPosition());
                    if (surPos != null) {
                        a.addPosition(surPos.getLatitude(), surPos.getLongitude());
                    } else if (localPos2 != null) {
                        a.addPosition(localPos2.getLatitude(), localPos2.getLongitude());
                    }

                    if (sp0.hasGroundSpeed()) {
                        a.setSpeed(sp0.getGroundSpeed());
                    }

                    // We can approximate heading as course here, I suppose unless the aircraft
                    // is being pushed?
                    if (sp0.hasValidHeading()) {
                        a.setHeading(sp0.getHeading());
                        a.setCourse(sp0.getHeading());
                    }

                    // Got this message so we know this is on the ground
                    a.setOnGround(true);
                    a.setAltitude(0.0);
                    break;

                case ADSB_AIRSPEED:
                    AirspeedHeadingMsg airspeed = (AirspeedHeadingMsg) msg;

                    if (airspeed.hasAirspeedInfo()) {
                        a.setSpeed(airspeed.getAirspeed().doubleValue());
                    }

                    // Might as well approximate heading as course here,
                    // in lieu of any other source
                    if (airspeed.hasHeadingStatusFlag()) {
                        a.setHeading(airspeed.getHeading());
                        a.setCourse(airspeed.getHeading());
                    }

                    if (airspeed.hasVerticalRateInfo()) {
                        a.setVerticalRate(Double.valueOf(airspeed.getVerticalRate()));
                    }
                    break;

                case ADSB_VELOCITY:
                    VelocityOverGroundMsg veloc = (VelocityOverGroundMsg) msg;

                    if (veloc.hasVelocityInfo()) {
                        a.setSpeed(veloc.getVelocity());
                    }

                    // Might as well approximate heading as course here,
                    // in lieu of any other source
                    if (veloc.hasVelocityInfo()) {
                        a.setHeading(veloc.getHeading());
                        a.setCourse(veloc.getHeading());
                    }

                    if (veloc.hasVerticalRateInfo()) {
                        a.setVerticalRate(Double.valueOf(veloc.getVerticalRate()));
                    }
                    break;

                case ADSB_IDENTIFICATION:
                    IdentificationMsg ident = (IdentificationMsg) msg;

                    a.setCallsign(new String(ident.getIdentity()));
                    a.setCategory(getICAOCategoryFromIdentMsg(ident));
                    break;

                case SHORT_ACAS:
                    ShortACAS acas = (ShortACAS) msg;
                    if (acas.getAltitude() != null) {
                        a.setAltitude(acas.getAltitude().doubleValue());
                        a.setOnGround(!acas.isAirborne());
                    }
                    break;

                case ALTITUDE_REPLY:
                    AltitudeReply alti = (AltitudeReply) msg;
                    if (alti.getAltitude() != null) {
                        a.setAltitude(alti.getAltitude().doubleValue());
                        a.setOnGround(alti.isOnGround());
                    }
                    break;

                case IDENTIFY_REPLY:
                    IdentifyReply identify = (IdentifyReply) msg;
                    a.setSquawk(Integer.parseInt(identify.getIdentity()));
                    break;

                case LONG_ACAS:
                    LongACAS long_acas = (LongACAS) msg;
                    if (long_acas.getAltitude() != null) {
                        a.setAltitude(long_acas.getAltitude().doubleValue());
                        a.setOnGround(!long_acas.isAirborne());
                    }
                    break;

                case COMM_B_ALTITUDE_REPLY:
                    CommBAltitudeReply commBaltitude = (CommBAltitudeReply) msg;
                    if (commBaltitude.getAltitude() != null) {
                        a.setAltitude(commBaltitude.getAltitude().doubleValue());
                        a.setOnGround(commBaltitude.isOnGround());
                    }
                    // libadsb doesn't handle the Comm-B message contents yet apart from
                    // the header value covered above, so we must implement our own
                    // handling for this.
                    handleCommBMessage(msg, a);
                    break;

                case COMM_B_IDENTIFY_REPLY:
                    CommBIdentifyReply commBidentify = (CommBIdentifyReply) msg;
                    a.setSquawk(Integer.parseInt(commBidentify.getIdentity()));
                    // libadsb doesn't handle the Comm-B message contents yet apart from
                    // the header value covered above, so we must implement our own
                    // handling for this.
                    handleCommBMessage(msg, a);
                    break;

                case MODES_REPLY:
                case EXTENDED_SQUITTER:
                    // Technically ADS-B messages are a variety of Extended Squitter
                    // message, which is a type of Mode-S reply. However, we only get
                    // here if the message hasn't been understood to be one of the
                    // other message types. Therefore there's no data we need to parse
                    // from this.
                    break;

                case COMM_D_ELM:
                case ALL_CALL_REPLY:
                case ADSB_EMERGENCY:
                case ADSB_STATUS_V0:
                case ADSB_AIRBORN_STATUS_V1:
                case ADSB_AIRBORN_STATUS_V2:
                case ADSB_SURFACE_STATUS_V1:
                case ADSB_SURFACE_STATUS_V2:
                case ADSB_TCAS:
                case ADSB_TARGET_STATE_AND_STATUS:
                case MILITARY_EXTENDED_SQUITTER:
                    // Plane/Sailing doesn't need to know about this yet
                    // Useful things in future that can be extracted from some of these packets
                    // include:
                    // * True vs Mag north correction
                    // * Airspeed vs Ground speed correction
                    // * Barometric vs ground based altitude correction
                    // * Autopilot, alt hold, VNAV/LNAV and approach flags
                    break;
                default:
                    // Type not applicable for this downlink format
            }
            a.updateMetadataTime();

        } catch (Exception ex) {
            LOGGER.warn("Receiver {} encountered an exception handling a Mode S packet", name, ex);
        }
    }

    /**
     * libadsb doesn't handle the Comm-B message contents yet apart from the header
     * value covered above, so we must implement our own handling for this.
     * Currently only very basic decoding is supported, e.g. aircraft callsign.
     *
     * @param msg The message
     * @param a   The aircraft to update
     */
    private static void handleCommBMessage(ModeSReply msg, Aircraft a) {
        byte[] commBMessage = new byte[0];
        if (msg instanceof CommBIdentifyReply) {
            commBMessage = ((CommBIdentifyReply) msg).getMessage();
        } else if (msg instanceof CommBAltitudeReply) {
            commBMessage = ((CommBAltitudeReply) msg).getMessage();
        }

        if (commBMessage.length > 0) {
            // Based on the contents of the message, determine the type
            // and extract the encoded data
            // ref: https://mode-s.org/decode/content/mode-s/9-inference.html
            if (commBMessage[0] == 0x20) {
                // BDS 2,0 - Aircraft identification
                // Payload contains callsign
                StringBuilder cs = new StringBuilder();
                for (int i = 0; i < 8; i++) {
                    int val = getbits(commBMessage, (6 * i) + 9, (6 * i) + 14);
                    val += (val < 0) ? 64 : 0;
                    cs.append(COMMB_CALLSIGN_BASE64.charAt(val));
                }
                String callsign = cs.toString().trim();
                // Callsign can be corrupt because there's no error checking here,
                // only handle it if it looks valid, and only use it if the
                // track doesn't already have a callsign set by ADS-B which is
                // more reliable.
                if (!callsign.isEmpty() && callsign.matches("[a-zA-z0-9]*") && a.getCallsign() == null) {
                    a.setCallsign(callsign);
                }
            } else {
                // Another type of Comm-B message, not handled currently
            }
        }
    }

    /**
     * Extract bits from a byte array. Borrowed from dump1090
     * <a href="https://github.com/adsbxchange/dump1090-fa/blob/cdba7566fde1ab45186f2dc4ea53e0594de484b1/mode_s.h#L51">...</a>
     */
    private static int getbits(byte[] data, int firstbit, int lastbit) {
        int fbi = firstbit - 1;
        int lbi = lastbit - 1;
        int nbi = (lastbit - firstbit + 1);

        int fby = fbi >> 3;
        int lby = lbi >> 3;
        int nby = (lby - fby) + 1;

        int shift = 7 - (lbi & 7);
        int topmask = 0xFF >> (fbi & 7);

        assert (fbi <= lbi);
        assert (nbi <= 32);
        assert (nby <= 5);

        if (nby == 5) {
            return ((data[fby] & topmask) << (32 - shift)) | (data[fby + 1] << (24 - shift))
                    | (data[fby + 2] << (16 - shift)) | (data[fby + 3] << (8 - shift)) | (data[fby + 4] >> shift);
        } else if (nby == 4) {
            return ((data[fby] & topmask) << (24 - shift)) | (data[fby + 1] << (16 - shift))
                    | (data[fby + 2] << (8 - shift)) | (data[fby + 3] >> shift);
        } else if (nby == 3) {
            return ((data[fby] & topmask) << (16 - shift)) | (data[fby + 1] << (8 - shift)) | (data[fby + 2] >> shift);
        } else if (nby == 2) {
            return ((data[fby] & topmask) << (8 - shift)) | (data[fby + 1] >> shift);
        } else if (nby == 1) {
            return (data[fby] & topmask) >> shift;
        } else {
            return 0;
        }
    }

    /**
     * Return a category like "A2" from an ident message. The Java-ADSB library's
     * code does provide a description field but we prefer to have this and use our
     * own shorter descriptions and pick the right symbol codes based on our CSVs.
     */
    private static String getICAOCategoryFromIdentMsg(IdentificationMsg ident) {
        if (ident.getFormatTypeCode() > 0 && ident.getFormatTypeCode() <= 4) {
            String[] formatTypeCodeLetters = new String[]{"", "D", "C", "B", "A"};
            return formatTypeCodeLetters[ident.getFormatTypeCode()] + String.valueOf(ident.getEmitterCategory());
        } else {
            return null;
        }
    }

    @Override
    protected int getTimeoutMillis() {
        return socketTimeoutMillis;
    }

    @Override
    public ClientType getType() {
        return mlat ? ClientType.MLAT : ClientType.ADSB;
    }

    @Override
    protected Logger getLogger() {
        return LOGGER;
    }
}
