# Stage 1: Build & Prune
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

RUN npm prune --production

# Stage 2: Production Base
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache vips

# Defensive security: execute as non-root user
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 3000

# Target 1: Web Ingress API
FROM runner AS web
CMD ["node", "dist/index.js"]

# Target 2: BullMQ Queue Consumers
FROM runner AS worker
CMD ["node", "dist/worker.js"]