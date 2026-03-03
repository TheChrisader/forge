# Forge Nixpacks Builder
# A Docker image with nixpacks pre-installed for building OCI-compliant images
# Uses host Docker daemon via mounted socket, so only Docker CLI is needed

FROM debian:bookworm-slim

# Install Docker CLI, curl, and ca-certificates
RUN apt-get update && apt-get install -y \
    docker.io \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install nixpacks using the official installation script
RUN curl -sSL https://nixpacks.com/install.sh | bash

# Add nixpacks to PATH
ENV PATH="/root/.local/bin:${PATH}"

# Verify installations
RUN docker --version && nixpacks --version

WORKDIR /app

# Default command for interactive use - overridden by nixpacks strategy
# sleep infinity keeps container alive for exec/shell access
CMD ["sleep", "infinity"]
