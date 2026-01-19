# --------------------
# Base stage
# --------------------
  FROM node:20-alpine AS base
  WORKDIR /usr/src/app
  COPY package*.json ./
  
  # --------------------
  # Development stage
  # --------------------
  FROM base AS dev
  ENV NODE_ENV=development
  RUN npm install
  COPY . .
  CMD ["npm", "run", "dev"]
  
  # --------------------
  # Production stage
  # --------------------
  FROM node:20-alpine AS prod
  
  WORKDIR /usr/src/app
  ENV NODE_ENV=production
  ENV PORT=3000
  
  # Copy only package files first (better caching)
  COPY package*.json ./
  
  # Install only prod dependencies
  RUN npm ci --omit=dev
  
  # Copy source code
  COPY . .
  
  # Create non-root user
  RUN addgroup -g 1001 app && adduser -S app -G app -u 1001
  USER app
  
  EXPOSE 3000
  CMD ["npm", "start"]