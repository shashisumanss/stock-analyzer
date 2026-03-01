# Stage 1: Build the React Application
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build the Production Server Environment
FROM node:20-alpine AS backend-server
WORKDIR /app

# Install Python & libraries needed for yfinance
RUN apk add --no-cache python3 py3-pip g++ make \
    && pip3 install --no-cache-dir --break-system-packages yfinance pandas numpy

# Copy backend node config and install prod dependencies
COPY package*.json ./
RUN npm install --production

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Copy specific backend files (excluding frontend source code)
COPY server.js valuation.js fetch_data.py ./

# Expose port (Cloud Run defaults to PORT 8080 or sets the PORT env var)
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Start Express server instead of dev scripts
CMD ["node", "server.js"]
