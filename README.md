# Plane/Sailing

*The home situational awareness display nobody wanted or needed!*

### What is it?

A completely unnecessary military situational awareness display for your home. It shows the location of nearby aircraft and ships in real time. It does this by pulling ADS-B data from a Dump1090 server and AIS from ??? (implementation TBD), and showing it overlaid on a map using NATO symbology.

This was a weekend project, the code quality here is a very hacky layer on top of the already dubious code for [UMID 1090](https://github.com/ianrenton/umid1090). Contributions are welcome.

### Why is it?

I spent too much time thinking about whether I *could*, and not enough time thinking about whether I *should*.

### Who is it for?

No idea. Ex-military hams who can't leave the SIGINT life behind? Turbo nerds with a hard-on for MIL-STD 2525 symbology? Anyone with a family tolerant enough to let them wall-mount a huge telly and make their kitchen look like Apollo Mission Control?

### This seems like a lot of work just for a "plain sailing" pun

Blame [@elderlygoose](https://twitter.com/ElderlyGoose)

### Using and Adapting

You can see it running, showing live data from my ADS-B and AIS receivers, at http://planesailing.ianrenton.com.

My code in this project is subject to "The Unlicence", i.e. it's public domain and you can do what you want with it. The source repository contains some libraries (milsymbol, moment.js, latlongcalc, dbloader) that aren't mine and are subject to other licences. All are used with great thanks, see their source files for licence details.

If you want to use this for yourself, go right ahead. There are some static variables at the top of code.js that you will need to tweak to match your install; you also need your own Mapbox API key in order to get the map background working properly.

Note that this software lives on the web and points to web interfaces of server(s) you provide, connected to radio receivers and antennas you provide. It's not pulling data from sites with global coverage APIs like FlightRadar24 or MarineTraffic.

### Future Plans

1. Actual AIS implementation (pending receiver hardware setup)
2. APRS?
3. Whatever else I can pick up with the ever expanding set of Raspberry Pis and RTL-SDR dongles on my desk
