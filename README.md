# Plane✈/Sailing⛵

*The home situational awareness display nobody wanted or needed!*

![Plane Sailing Banner](./banner.png)

### What is it?

A completely unnecessary military situational awareness display for your home. It shows the location of nearby aircraft and ships in real time, using NATO symbology overlaid on a map.

This project contains the client, which runs in a web browser. For a fully functioning Plane/Sailing system, the [server](https://github.com/ianrenton/planesailing-server) is also required, as are third-party applications such as Dump1090, rtl_ais & Direwolf, and a number of radio receivers. You can check out the full build guide for the system [here](https://ianrenton.com/hardware/planesailing/).

### Why is it?

I spent too much time thinking about whether I *could*, and not enough time thinking about whether I *should*.

### Who is it for?

No idea. Ex-military hams who can't leave the SIGINT life behind? Turbo nerds with a hard-on for MIL-STD 2525 symbology? Anyone with a family tolerant enough to let them wall-mount a huge telly and make their kitchen look like Apollo Mission Control?

### This seems like a lot of work just for a "plain sailing" pun

Blame [@elderlygoose](https://twitter.com/ElderlyGoose)

### Can I see what it looks like?

You can see it running, showing live data from my ADS-B, AIS and APRS receivers, at https://planesailing.ianrenton.com.

### What's the hardware behind it?

You can check out the hardware and build guide at https://ianrenton.com/hardware/planesailing/.

### Can I run my own version?

My code in this project is subject to "The Unlicence", i.e. it's public domain and you can do what you want with it.

If you want to use this for yourself, go right ahead. There are some static variables at the top of `code.js` that you will need to tweak to match your install, in particular the URL of the Plane/Sailing server that it should talk to.

Note that this repository only provides the web-based user interface, and so is only part of the whole system. If you want to recreate the whole thing for yourself, you will need to set up the [server](https://github.com/ianrenton/planesailing-server) so the client has something to talk to, and set up other ADS-B, AIS and/or APRS decoding applications, and provide radio receivers and antennas. Plane/Sailing is not pulling data from sites with global coverage APIs like FlightRadar24 or MarineTraffic. Check out the [build guide](https://ianrenton.com/hardware/planesailing/) for a complete set of instructions on how to set the system up!

### A note about "Connect via LAN"

As discussed above, Plane/Sailing uses a client/server architecture&mdash;this repository provides only the client, which must be pointed at the server to work. 

There is a complication here if you want the client web interface to be able to connect to the server from both inside and outside the network that hosts that server.

For a public version, the client needs to be configured to talk to your server via your (probably home) network's public IP address, which will then need to be forwarded through your router to the PC that hosts the server. If you're using HTTPS for this (see the instructions in [the server README](https://github.com/ianrenton/planesailing-server/blob/main/README.md)), you will also have a CNAME set up for this. For example, I use a CNAME of `planesailingserver.ianrenton.com` that points to a dynamic DNS entry, which points to my home network's public IP. Ports 80 & 443 are then forwarded to the Plane/Sailing server inside the network.

This is great for the rest of the world, but if you're trying to use Plane/Sailing from inside your home network, you'll find that it doesn't work. There are three ways to solve this problem:

1. Host a second copy of the client inside your network, e.g. on the same PC that hosts the server, and specifying the internal IP address of that server in `code.js`. This is inelegant as you need a second copy, and it will also only be accessible via HTTP not HTTPS as your HTTPS certificate for the server won't work with an IP address only.
2. Add a CNAME internal to your own network, so that requests to e.g. `planesailingserver.ianrenton.com` get forwarded direct to the IP address of the server and don't leave your network. This is what I do, because it allows you to have a single copy of the client and HTTPS will still work. However you will need a custom DNS server for your home network like a PiHole to achieve this, most routers supplied by your ISP don't have this level of functionality.
3. For users that can't don't want to do (1) and can't do (2), the client software includes the ability to specify *two* server URLs, which are toggled between using the "Connect via LAN" switch in the Config panel. This allows you to swap between external and internal URLs. External should be the default, as this will be used for first-time visitors to the public site, but you can enable "Connect via LAN" for computers/devices on your network. From a phone, you might have to toggle it on and off when you join/leave WiFi coverage. As with (1), HTTPS won't work within your LAN, so the internal URL must use HTTP. Unfortunately you also can't make AJAX calls to HTTP from an HTTPS-served page, so if you want LAN Mode toggled on, you will also have to use HTTP and not HTTPS to access the *client* as well. But external users can still use HTTPS.

### Can I contribute?

Sure. Pull request away!
