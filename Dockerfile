FROM node:18-alpine

WORKDIR /app

# Install build dependencies for native modules (bcrypt requires Python and build tools)
# These are build-time dependencies only, not runtime Python code
# Update package index first, with retry logic for network issues
RUN apk update || (sleep 10 && apk update) && \
    apk add --no-cache python3 make g++ || \
    (sleep 10 && apk update && apk add --no-cache python3 make g++)

# Copy package files
COPY src/frontend/package.json ./package.json

# Install dependencies
# For production: use --omit=dev
# For testing: install all dependencies including dev
ARG NODE_ENV=production
RUN if [ "$NODE_ENV" = "test" ]; then npm install; else npm install --omit=dev; fi

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/backend/server.js"]

