# Build stage
FROM node:24-bookworm-slim as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# SQLite DB persistence
VOLUME /app/data
ENV PORT=5000
ENV DB_PATH=/app/data/database.sqlite
EXPOSE 5000
CMD ["node", "dist/index.js"]
