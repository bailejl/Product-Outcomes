FROM node:20-bookworm-slim

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

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /usr/share/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# Configure the existing node user for development
RUN usermod -s /bin/bash node \
  && echo node ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/node \
  && chmod 0440 /etc/sudoers.d/node

# Install global npm packages
RUN npm install -g claude-flow@2.0.0-alpha.38 @anthropic-ai/claude-code@1.0.43

# Create directories for Playwright
RUN mkdir -p /home/node/.cache/ms-playwright \
  && chown -R node:node /home/node/.cache

# Switch to node user
USER node

# Set npm cache directory
ENV NPM_CONFIG_CACHE=/home/node/.npm

ENV GITHUB_OWNER=bailejl
ENV GITHUB_REPO=Product-Outcomes

# Set up aliases and environment info in profile
RUN alias swarm-status="/github status" \
  && alias swarm-tasks="/github tasks" \
  && alias swarm-claim="/github claim" \
  && alias swarm-update="/github update" \
  && echo "echo GITHUB_OWNER: \$(echo \$GITHUB_OWNER)" >> ~/.profile \
  && echo "echo GITHUB_REPO: \$(echo \$GITHUB_REPO)" >> ~/.profile \
  && echo "echo CLAUDE_SWARM_ID: \$(echo \$CLAUDE_SWARM_ID)" >> ~/.profile

# Pre-install Playwright browsers as the node user
RUN npx playwright install chromium firefox webkit

# ENV CLAUDE_SWARM_ID="swarm-$(date +%s)"
ENV CLAUDE_SWARM_ID="product-outcomes-swarm-01"

# Set working directory
WORKDIR /workspace