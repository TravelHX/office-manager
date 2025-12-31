FROM node:18-alpine

WORKDIR /app

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

