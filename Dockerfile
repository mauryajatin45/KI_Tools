# syntax = docker/dockerfile:1
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"
WORKDIR /app

# ---------- BUILD STAGE ----------
FROM base AS build

# Ensure build-stage installs dev dependencies
ENV NODE_ENV=development

# Install system packages required for native builds
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      build-essential node-gyp pkg-config python-is-python3 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install root dependencies (including dev deps so build scripts are available)
COPY package*.json ./
RUN npm ci --include=dev

# Install dashboard dependencies (ensure dashboard has vite in devDependencies)
COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm ci --include=dev

# Copy app source
COPY . .

# Build the project (this should run the dashboard build which invokes vite)
RUN npm run build

# Remove dev dependencies to keep final image small
RUN npm prune --omit=dev || npm prune --production

# ---------- PRODUCTION IMAGE ----------
FROM node:${NODE_VERSION}-slim AS prod

# Set production environment
ENV NODE_ENV=production
WORKDIR /app

# Copy built app from build stage
COPY --from=build /app /app

# Expose whatever port your app listens on
EXPOSE 3000

# Start the app (adjust if you use a different start script)
CMD ["node", "server.js"]