# syntax=docker/dockerfile:1
FROM node:20-alpine as web

# Install OpenJDK for javac and basic certs/shell
RUN apk add --no-cache \
      openjdk17-jdk \
      ca-certificates \
      bash

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install production deps first (better cache); use npm ci when lockfile exists
COPY --chown=node:node package.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# Copy rest of the source
COPY --chown=node:node . .

# Ensure j2s helper is executable if present
RUN chmod +x j2s/j2s || true

ENV PORT=3000
EXPOSE 3000

# Ensure app directory is writable by non-root user at runtime
RUN chown -R node:node /usr/src/app

# Drop privileges
USER node

CMD ["npm", "start"]
