# Build stage
FROM node:24-bookworm as builder
WORKDIR /app
ENV npm_config_build_from_source=true
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Production stage
FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# SQLite DB persistence
VOLUME /app/data
ENV PORT=5000
ENV DB_PATH=/app/data/database.sqlite
EXPOSE 5000
CMD ["node", "dist/index.js"]
