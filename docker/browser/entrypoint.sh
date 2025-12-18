#!/bin/bash
# Void Browser Container Entrypoint
# Starts Xvfb, VNC server, noVNC, and Chromium

set -e

# Parse resolution
WIDTH=$(echo $RESOLUTION | cut -d'x' -f1)
HEIGHT=$(echo $RESOLUTION | cut -d'x' -f2)
DEPTH=$(echo $RESOLUTION | cut -d'x' -f3)

echo "Starting Void Browser Container"
echo "Resolution: ${WIDTH}x${HEIGHT}x${DEPTH}"
echo "noVNC port: ${NOVNC_PORT}"

# Start Xvfb (virtual framebuffer)
Xvfb $DISPLAY -screen 0 ${RESOLUTION} &
sleep 1

# Start openbox window manager (minimal)
openbox &
sleep 0.5

# Set VNC password
mkdir -p ~/.vnc
x11vnc -storepasswd "$VNC_PASSWORD" ~/.vnc/passwd

# Start VNC server
x11vnc -display $DISPLAY -forever -shared -rfbauth ~/.vnc/passwd -rfbport $VNC_PORT -bg

# Start noVNC websocket proxy
websockify --web=/usr/share/novnc $NOVNC_PORT localhost:$VNC_PORT &

echo "noVNC ready at http://localhost:${NOVNC_PORT}/vnc.html"

# Launch Chromium with optional URL
CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage --disable-gpu --window-size=${WIDTH},${HEIGHT}"

if [ -n "$LAUNCH_URL" ]; then
    echo "Opening URL: $LAUNCH_URL"
    chromium $CHROME_FLAGS "$LAUNCH_URL" &
else
    chromium $CHROME_FLAGS &
fi

# Keep container running
wait
