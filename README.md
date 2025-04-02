# Plane✈/Sailing⛵

*The completely unnecessary military situational awareness display for your home!*

![Plane Sailing Banner](./banner.png)

## What is it?

Plane/Sailing shows the location of nearby aircraft, ships, amateur radio stations, radiosondes and Meshtastic nodes, in real time, using NATO symbology overlaid on a map.

This software receives data from local ADS-B, AIS, APRS and HORUS-compatible receiving software, along with Meshtastic nodes. It combines them into one large "track table", and provides a web interface to view them.

For more information on the Plane/Sailing project, including the hardware build guide, please see https://ianrenton.com/projects/planesailing.

You can see my instance running, showing live data from my ADS-B, AIS and APRS receivers, at https://planesailing.ianrenton.com.

### Why is it?

I spent too much time thinking about whether I *could*, and not enough time thinking about whether I *should*.

### Who is it for?

No idea. Ex-military hams who can't leave the SIGINT life behind? Turbo nerds with a hard-on for MIL-STD 2525 symbology? Anyone with a family tolerant enough to let them wall-mount a huge telly and make their kitchen look like Apollo Mission Control?

## Features

* Receives AIS messages in NMEA-0183 format via UDP (e.g. from rtl_ais)
* Receives Mode-S/A/C, ADS-B and some Comm-B messages in BEAST Binary, BEAST AVR and SBS/BaseStation format (e.g. from Dump1090)
* Receives MLAT messages in BEAST Binary and SBS/BaseStation format (e.g. from PiAware)
* Receives complete aircraft data sets direct from Dump1090 in its own JSON format, if preferred
* Receives APRS messages via KISS TCP (e.g. from Direwolf)
* Receives HORUS JSON format messages via UDP (e.g. from radiosonde_auto_rx)
* Queries Meshtastic nodes via their Python API to obtain details of nearby nodes
* Includes support for config-based addition of extra tracks for the base station, airports and seaports
* Includes support for config-based addition of AIS track names, to cover the period between getting a position message and a details message
* Includes look-up tables to determine aircraft operators, types, and the correct MIL-STD2525C symbols to use for a variety of tracks
* Persists data to disk so the content of the track table is not lost on restart
* Provides a fully featured web UI to view the information, with customisable layers and settings
* Provides a track table and statistics for the backend in the web UI
* Provides a web-based JSON API which can be used to retrieve the data so you can write other front-ends.

## Getting a Copy

If you just want to use Plane/Sailing (without making any changes to the source code), go to the [latest release](https://github.com/ianrenton/planesailing/releases/latest) page and download the ZIP file containing the compiled software. This will be a ZIP named like "`plane-sailing-x.y.z.zip`" (*not* "Source Code (zip)").

Unpack this to wherever you would like to run it from, then jump ahead to the Setup section.

### Building from Scratch

If you want to modify and build the software yourself, it's best to clone it using git, e.g. `git clone git@github.com:ianrenton/planesailing.git`. If you're a GitHub user you could also create your own fork before doing this.

Plane/Sailing is a Maven project, so with Maven and a JDK installed, you can build it by running `mvn package`, and you'll find the output in `target/output/`.

### Using IDEs

IntelliJ IDEA is my IDE of choice, so the source code comes with IDEA config files to help you get up and running. If you prefer a different IDE, and you want to run the software direct from your IDE for testing, you will want to set the runtime working directory to `target/output` and add `-Dconfig.file=application.conf` to the VM arguments.

## Setup

In order to use this software, you should be running some combination of hardware and software to provide the data to it, e.g. a hardware AIS transponder, AIS-Catcher or rtl_ais, Dump1090/PiAware, Direwolf etc. You can find more information on how to install and set those up on the [Plane/Sailing build guide](https://ianrenton.com/hardware/planesailing). 

To run Plane/Sailing:

1. Ensure your machine has Java 21 or later installed, e.g. `sudo apt install openjdk-21-jre-headless`. If you're on something like Debian Stable which doesn't yet have Java 21, consider using [the Temurin packages](https://adoptium.net/en-GB/installation/linux/).
2. Find your copy of Plane/Sailing, either from the ZIP download or one you built yourself (see the previous section). You should have three files: a JAR file, an `application.conf` file, a `run.sh`, and a `data` subdirectory.
3. Edit `application.conf` and set the IP addresses and ports as required. A list of receiving nodes is supported, each with any number of AIS, ADS-B, MLAT, APRS, HORUS and Meshtastic receivers. One configuration of each type is provided as an example for you to copy. If there's something your setup doesn't do, just delete the corresponding section.
4. Set the base station position, and any airports and seaports you'd like to appear in your data.
5. Save `application.conf` and run the application, e.g. `chmod +x run.sh`, `./run.sh`
6. Hopefully you should see log messages indicating that it has started up and loaded data! Every 10 seconds it will print out a summary of what's in its track table.
7. Leave the software running, then access the web server at `http://[ipaddress]:8090`. You should see the web interface and data will hopefully start coming through. 

If you'd like to make it run automatically on startup on something like a Raspberry Pi, and put it on the internet for everyone to use, the later sections of this README will help you.

### Troubleshooting: "Address already in use" on Windows

If you're running Plane/Sailing on Windows, you may see an "Address already in use" error, and the software will fail to start. This is due to the choice of default port for the webserver, 8090, and its [interaction with a Windows 10/11 feature called WinNAT](https://blog.deanosim.net/windows-10-winnat-and-why-your-programs-cant-listen-on-certain-ports/). While there is a workaround for this involving stopping/starting WinNAT, it's probably easier just to pick a different port for Plane/Sailing's web interface to run on. You can change it in `application.conf`.

### A Note on Choosing Aircraft Data Protocols

A number of aircraft data formats are supported&mdash;for the gory details see the [Tracking Packet Format FAQ](https://ianrenton.com/hardware/planesailing/tracking-packet-format-faq/#what-are-the-common-formats-of-mode-s-data). The preferred format is BEAST Binary format, which Dump1090 produces as an output. This contains the raw Mode-A, Mode-C, Mode-S, ADS-B and Comm-B bytes with some encapsulation. Plane/Sailing can use the same format for receiving live data from the radio via Dump1090 as it can receiving MLAT data from PiAware.

BEAST AVR format is also supported, which is ASCII-encoded and therefore a little easier to parse, but PiAware does not support this for MLAT data. SBS/BaseStation format is supported too, which is both ASCII-encoded *and* supported by PiAware for MLAT, but it doesn't contain all information fields e.g. aircraft category.

Finally, Plane/Sailing v1 loaded its aircraft data from a JSON file written by Dump1090, and Plane/Sailing v2 preserves this capability. This data contains every data point including merged-in MLAT data, however the data is not "live" so requires some adjustments in the code for the time at which data was recorded. It's no longer the preferred option but it is available.

If you're not sure, the default will work fine.

### A Note on Meshtastic Support

Meshtastic node support relies on calling on the Python command-line utility to connect to the node and retrieve data. This is inelegant and somewhat insecure, but does easily provide the ability to connect to Bluetooth nodes as well as WiFi, and avoids me having to write and maintain a Meshtastic protobuf API for Java :)

In `application.conf` you will simply provide a command line for the application to run at an interval. In order for this to work, you will need to [set up the Meshtastic Python CLI interface](https://meshtastic.org/docs/software/python/cli/installation/). On some systems (e.g. recent Ubuntu), this involves a `venv` (virtual environment) as `pip` cannot be run at the system level and the Meshtastic library is not yet available in the package manager. For example, the following may be required to set it up:

```bash
sudo apt install python3 python3-pip python3-venv 
python3 -m venv ~/meshtastic-venv 
source ~/meshtastic-venv/bin/activate 
pip3 install --upgrade pytap2 
pip3 install --upgrade meshtastic 
deactivate
```

Then the following command is run from Plane/Sailing:

```bash
source ~/meshtastic-venv/bin/activate && meshtastic --host [ipaddress] --info 
```

Plane/Sailing is currently *explicitly calling `bash`* to run the command, and therefore this will only work on Linux and where `bash` is available. Improving this is a work in progress.

## Automatic Run on Startup

Depending on your use case you may wish to have the software run automatically on startup. How to do this is system-dependent, on most Linux systems that use systemd, like Ubuntu and Raspbian, you will want to create a file like `/etc/systemd/system/plane-sailing.service` with the contents similar to this:

```
[Unit]
Description=Plane/Sailing
After=network.target

[Service]
ExecStart=/home/pi/plane-sailing/run.sh
WorkingDirectory=/home/pi/plane-sailing
StandardOutput=inherit
StandardError=inherit
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

Then to complete the setup by running:

```bash
sudo systemctl daemon-reload
sudo systemctl enable plane-sailing
sudo systemctl start plane-sailing
```

If you want to check it's working, use e.g. `systemctl status plane-sailing` to check it's alive, and `journalctl -u plane-sailing.service -f` to see its logs in real time. You should see it successfully start up its interfaces to Dump1090, AIS Dispatcher and Direwolf (assuming they are all enabled) and the regular track table messages should indicate several ships, aircraft and APRS tracks depending on what's around you.

If you are running Plane/Sailing on Windows you can make it start automatically by using NSSM to install Plane/Sailing as a service, or with Scheduled Tasks, a shortcut in your Startup items, etc.

## Reverse Proxy Setup

Users can quite happily connect to Plane/Sailing's web server directly on its default port of 8090. However, you may wish to add a "proper" web server providing a reverse proxy setup. There are several reasons you might want to do this:

* It allows the use HTTPS (with certificates, e.g. from Let's Encrypt), so the client can connect securely
* It allows Plane/Sailing to run on a port that Linux will let it open with normal user privileges (by default 8090) while still making it accessible to the internet on port 80 and/or 443
* You can host other software with web interfaces on the same machine, e.g. SkyAware, AIS Dispatcher etc. via the same public port.
* You can [enable caching in the web server](https://docs.nginx.com/nginx/admin-guide/content-cache/content-caching/), so that no matter how many visitors your site gets, the server itself sees a stable number of requests and doesn't get overloaded.

In this example, we will use Nginx due to its relatively easy config and support in Let's Encrypt Certbot, but you could use Apache, Lighttpd, HAProxy or anything you like that supports a reverse proxy configuration.

Start off by installing Nginx, e.g. `sudo apt install nginx`. You should then be able to enter the IP address of the server using a web browser and see the "Welcome to nginx" page. Next we need to change that default setup to instead provide a reverse proxy pointing at Plane/Sailing. Create a file like `/etc/nginx/sites-available/plane-sailing.conf` with contents similar to the following:

```
server {
    listen 80;
    server_name planesailing.ianrenton.com;

    location / {
        proxy_pass http://127.0.0.1:8090;
    }
}
```

This sets up your server for HTTP only at the moment, which is OK - we will let Certbot set up the HTTPS configuration later.

Once you're finished creating that file, delete the default site, enable the new one, and restart nginx:

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/plane-sailing.conf /etc/nginx/sites-enabled/plane-sailing.conf
sudo systemctl restart nginx
```

When you now visit the IP address of your server using a web browser, without specifying a port, you should see Plane/Sailing's web interface. Your reverse proxy setup is now working!

If nginx didn't restart properly, you may have mistyped your configuration. Try `sudo nginx -t` to find out what the problem is.

You may wish to add extra features to this configuration. For example if you wanted Plane/Sailing accessible in the root directory as normal, but then have Dump1090 on `/dump1090-fa` and AIS Dispatcher's web interface on `/aisdispatcher` too, all on port 80, you can do that by tweaking the adding new "location" parameters as follows. They are handled in order so Plane/Sailing comes *last*, only if the URL doesn't match any of the other locations.

```
server {   
    listen 80;
    server_name planesailing.ianrenton.com;

    # Skyaware web interface
    rewrite ^/skyaware$ /skyaware/ permanent;
    location /skyaware/ {
        alias /usr/share/skyaware/html/;
        # Allow CORS requests to /data/ for UMID1090 - not necessarily required for your server!
        add_header Access-Control-Allow-Origin *;
    }
    location /skyaware/data/ {
        alias /run/dump1090-fa/;
        # Allow CORS requests to /data/ for UMID1090 - not necessarily required for your server!
        add_header Access-Control-Allow-Origin *;
    }

    # AIS Dispatcher web interface
    rewrite ^/aisdispatcher$ /aisdispatcher/ permanent;
    location /aisdispatcher/ {
        proxy_pass http://127.0.0.1:8080;
    }

    # Plane/Sailing
    location / {
        proxy_pass http://127.0.0.1:8090;
    }
}

```

### HTTPS Setup

You can use Let's Encrypt to enable HTTPS on your Nginx server, so the client can request data securely. The easiest way is using Certbot, so following the [instructions here](https://certbot.eff.org/lets-encrypt/debianbuster-nginx):

```bash
sudo apt install snapd
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx
```

At this stage you will be prompted to enter your contact details and domain information, but Certbot will take it from there&mdash;it will automatically validate the server as being reachable from the (sub)domain you specified, issue a certificate, install it, and reconfigure nginx to use it.

If it fails with an error involving `/.well-known/acme-challenge`, it's trying to verify that your server can be retrieved at the URL you have set up, but it can't create a file and and check that it exists because your nginx config is pointing to Plane/Sailing via the remote proxy setup rather than a standard directory of HTML files. If this is the case, you will want to add the following to your nginx config:

```
    # Wellknown area for Lets Encrypt
    location /.well-known/ {
        alias /var/www/html/.well-known/;
    }
```

Once Certbot finishes its job, what you'll probably find is that it has helpfully reconfigured your server to use *only* HTTPS, and HTTP now returns a 404 error. In my opinion it would be best for both versions to provide the same response. To re-enable both HTTP and HTTPS, you need to delete the extra "server" block in `/etc/nginx/sites-enabled/plane-sailing.conf` and add `listen 80` back into the main block. You should end up with something like this (with your own domain names in there):

```
server {
    listen 80;
    listen 443 ssl;
    server_name planesailing.ianrenton.com;

    location / {
        proxy_pass http://127.0.0.1:8090;
    }

    ssl_certificate /etc/letsencrypt/live/planesailing.ianrenton.com/full$
    ssl_certificate_key /etc/letsencrypt/live/planesailing.ianrenton.com/$
}

```

Finally, `sudo systemctl restart nginx` and you should now find that Plane/Sailing is accessible via both HTTP and HTTPS. The good news is, Certbot should automatically renew your certificate when required, and shouldn't mess with your config again.

## Prometheus Metrics

Plane/Sailing exposes a Prometheus metrics endpoint from its web server, at the standard URL of `/metrics`. Metrics available include the number of tracks of various types in the system, and maximum detection ranges. This can be used to aggregate & analyse data on performance, provide alerting on the loss of a feed, and to add pretty graphs to Grafana.

![Aircraft, Ship and APRS track charts in Grafana](./grafana-screenshot.png)
