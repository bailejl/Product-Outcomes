FROM mcr.microsoft.com/vscode/devcontainers/base:ubuntu-22.04

# Set shell with pipefail for better error handling
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install essential tools and Playwright dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  curl \
  wget \
  python3 \
  make \
  g++ \
  sudo \
  unzip \
  vim \
  # Playwright dependencies
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libatspi2.0-0 \
  libx11-6 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libxcb1 \
  libxss1 \
  libgtk-3-0 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  # Additional GStreamer and multimedia libraries
  libgstreamer1.0-0 \
  libgtk-4-1 \
  libgraphene-1.0-0 \
  libxslt1.1 \
  libwoff1 \
  libvpx7 \
  libevent-2.1-7 \
  libopus0 \
  libgstreamer-plugins-base1.0-0 \
  libgstreamermm-1.0-1 \
  libflite1 \
  libwebpdemux2 \
  libavif13 \
  libharfbuzz-icu0 \
  libwebpmux3 \
  libenchant-2-2 \
  libsecret-1-0 \
  libhyphen0 \
  libmanette-0.2-0 \
  libgles2-mesa \
  libx264-163 \
  # Clean up
  && rm -rf /var/lib/apt/lists/*

# Install Deno (required for claude-flow)
# Using a more robust installation method with proper error handling
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && export DENO_INSTALL="/usr/local" \
  && curl -fsSL https://deno.land/install.sh | sh -s v1.46.3 \
  || (echo "Deno installation failed, trying alternative method..." \
    && wget -qO- https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -O /tmp/deno.zip \
    && unzip -q /tmp/deno.zip -d /usr/local/bin/ \
    && rm /tmp/deno.zip) \
  && chmod +x /usr/local/bin/deno

# Install Node.js v24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /usr/share/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# Create node user and configure for development
# Check if group/user already exist and handle accordingly
RUN (getent group node || groupadd node) \
  && (id -u node &>/dev/null || useradd -g node -s /bin/bash -m node) \
  && echo node ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/node \
  && chmod 0440 /etc/sudoers.d/node

# Install global npm packages
# RUN npm install -g claude-flow@alpha @anthropic-ai/claude-code@latest

# Create directories for Playwright
RUN mkdir -p /home/node/.cache/ms-playwright \
  && chown -R node:node /home/node/.cache

# Switch to node user
USER node

# Set npm cache directory
ENV NPM_CONFIG_CACHE=/home/node/.npm

ENV GITHUB_OWNER=bailejl
ENV GITHUB_REPO=Product-Outcomes

# Set working directory
WORKDIR /workspace