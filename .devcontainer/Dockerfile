FROM node:20-bookworm-slim

# Install essential tools and Playwright dependencies
RUN apt-get update && apt-get install -y \
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
RUN curl -fsSL https://deno.land/install.sh | sh \
  && mv /root/.deno/bin/deno /usr/local/bin/deno \
  && chmod +x /usr/local/bin/deno

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /usr/share/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install gh -y \
  && rm -rf /var/lib/apt/lists/*

# Configure the existing node user for development
RUN usermod -s /bin/bash node \
  && echo node ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/node \
  && chmod 0440 /etc/sudoers.d/node

# Install global npm packages
RUN npm install -g npm@latest ruv-swarm@latest @anthropic-ai/claude-code

RUN mkdir /usr/local/lib/node_modules/ruv-swarm/data \
  && chown -R node:node /usr/local/lib/node_modules/ruv-swarm/data

# Create directories for Playwright
RUN mkdir -p /home/node/.cache/ms-playwright \
  && chown -R node:node /home/node/.cache

# Switch to node user
USER node

# Set npm cache directory
ENV NPM_CONFIG_CACHE=/home/node/.npm

ENV GITHUB_OWNER=bailejl
ENV GITHUB_REPO=Product-Outcomes

ENV CLAUDE_SWARM_ID="swarm-$(date +%s)"

RUN alias swarm-status="/github status"
RUN alias swarm-tasks="/github tasks"
RUN alias swarm-claim="/github claim"
RUN alias swarm-update="/github update"

# Pre-install Playwright browsers as the node user
RUN npx playwright install chromium firefox webkit

# Set the default shell to bash
SHELL ["/bin/bash", "-c"]

# Set working directory
WORKDIR /workspace