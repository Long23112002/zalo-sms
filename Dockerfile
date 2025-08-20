# Multi-stage Dockerfile for Next.js app

FROM node:20-bullseye AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# If you prefer only prod deps, uncomment the next 3 lines and remove the copy from deps
# COPY package*.json ./
# RUN npm ci --omit=dev
# COPY --from=builder /app/.next ./.next

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json ./

EXPOSE 3000
CMD ["npm", "run", "start"]


