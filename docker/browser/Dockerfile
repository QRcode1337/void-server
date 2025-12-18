# Void Browser Container
# Minimal Chromium + noVNC for browser authentication in Docker
# Serves noVNC over HTTP (no SSL) for easy iframe embedding

FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    openbox \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash browser && \
    mkdir -p /home/browser/.config/chromium && \
    chown -R browser:browser /home/browser

# Copy entrypoint script and fix line endings
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod 755 /entrypoint.sh

# Environment defaults
ENV DISPLAY=:99 \
    RESOLUTION=1280x800x24 \
    VNC_PASSWORD=voidserver \
    NOVNC_PORT=6080 \
    VNC_PORT=5900

# Expose noVNC HTTP port
EXPOSE 6080

# Run as non-root user
USER browser
WORKDIR /home/browser

ENTRYPOINT ["/entrypoint.sh"]
