# Hello World App Dockerfile
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build all projects
RUN npx nx run-many --target=build --all

# Production stage
FROM node:24-alpine AS production

# Set working directory
WORKDIR /app

# Copy built applications
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Expose ports
EXPOSE 3333 4200

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/api/health || exit 1

# Start API server
CMD ["node", "dist/api/main.js"]