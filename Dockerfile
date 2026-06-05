# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies) for building
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build both client (Vite) and server (esbuild)
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Create uploads directory and set permissions to the non-root 'node' user
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copy the built output from the builder stage (contains dist/ assets + server.cjs)
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/package.json ./package.json

# Expose the port the app runs on
EXPOSE 5000

# Use non-root user for security
USER node

# Start the application
CMD ["node", "dist/server.cjs"]
