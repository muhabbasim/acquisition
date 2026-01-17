# Acquisitions – Docker & Neon Setup

This project is containerized for both local development (using **Neon Local**) and production (using a **Neon Cloud** database).

The application is a Node.js/Express API located in `src/app.js` and started via `src/server.js`.

## Overview

- **Development**
  - `docker-compose.dev.yml`
  - Runs two services:
    - `neon-local`: Neon Local proxy in Docker, which creates **ephemeral branches** in your Neon project.
    - `app`: acquisitions Node.js API, connecting to Neon Local via `DATABASE_URL`.
  - Uses `.env.development` for both the app and Neon Local.

- **Production**
  - `docker-compose.prod.yml`
  - Runs a single service:
    - `app`: acquisitions Node.js API, connecting directly to your Neon Cloud database.
  - Uses `.env.production` for application secrets and the production `DATABASE_URL`.

## Files added

- `Dockerfile` – Builds a container image for the Node.js app.
- `docker-compose.dev.yml` – Local dev, app + Neon Local.
- `docker-compose.prod.yml` – Production, app only, using remote Neon Cloud DB.
- `.env.development` – Example local dev env vars (Neon Local + app).
- `.env.production` – Example production env vars (Neon Cloud + app).

> IMPORTANT: Do **not** commit real secrets (API keys, passwords, production DATABASE_URL) to version control. Replace the placeholders locally.

---

## 1. Dockerfile

The `Dockerfile` uses a **multi-stage** build with separate dev and prod stages.

```dockerfile
# Base stage: common setup
FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

# Development stage
FROM base AS dev
ENV NODE_ENV=development
RUN npm install
COPY . .

# Production stage
FROM base AS prod
ENV NODE_ENV=production
ENV PORT=3000
# Install only production dependencies
RUN npm install --omit=dev

# Copy application source (no dev tooling, tests, etc. if you later exclude them with .dockerignore)
COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
```

- Uses `node:20-alpine`.
- `dev` stage installs full dependencies for local development.
- `prod` stage installs only production dependencies and is used by the production compose file.
- `docker-compose.dev.yml` builds the `dev` stage; `docker-compose.prod.yml` builds the `prod` stage.

---

## 2. Local Development with Neon Local

### 2.1. Configure `.env.development`

Create (or edit) `.env.development` in the project root:

```bash
NODE_ENV=development
PORT=3000

# Local Neon connection (via Neon Local proxy service)
DATABASE_URL=postgres://neon:npg@neon-local:5432/acquisitions

# Neon Local configuration for ephemeral branches
NEON_API_KEY=your_neon_api_key_here
NEON_PROJECT_ID=your_neon_project_id_here
PARENT_BRANCH_ID=your_parent_branch_id_here
```

- `DATABASE_URL` points to **Neon Local** at service name `neon-local` on port `5432`.
- `NEON_API_KEY`, `NEON_PROJECT_ID` and `PARENT_BRANCH_ID` are used by the `neondatabase/neon_local` Docker image to:
  - Authenticate to your Neon account.
  - Use `PARENT_BRANCH_ID` as the source branch.
  - Automatically create a new **ephemeral** branch when the container starts and delete it when it stops.

### 2.2. docker-compose.dev.yml

`docker-compose.dev.yml` orchestrates the local dev environment:

```yaml
version: "3.9"

services:
  neon-local:
    image: neondatabase/neon_local:latest
    container_name: neon-local
    ports:
      - "5432:5432"
    env_file:
      - .env.development

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: dev
    container_name: acquisitions-app-dev
    depends_on:
      - neon-local
    env_file:
      - .env.development
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgres://neon:npg@neon-local:5432/acquisitions}
    command: ["node", "--watch", "src/server.js"]
    ports:
      - "3000:3000"
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules
```

Key points:

- **Neon Local service (`neon-local`)**
  - Uses the official `neondatabase/neon_local:latest` image.
  - Reads `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID` from `.env.development`.
  - Listens on port `5432` (mapped to your host’s `localhost:5432`).

- **App service (`app`)**
  - Built from the local `Dockerfile`.
  - Uses `.env.development` so `DATABASE_URL` points to Neon Local.
  - Default `DATABASE_URL` is `postgres://neon:npg@neon-local:5432/acquisitions` if not set.
  - Runs `node --watch src/server.js` for live-reload-style development.
  - Mounts the local source tree for quick iteration.

### 2.3. Starting the dev environment

From the project root:

```bash
# Build and start dev stack (app + Neon Local)
docker compose -f docker-compose.dev.yml up --build
```

- API available at: `http://localhost:3000`.
- Neon Local Postgres endpoint at: `postgres://neon:npg@localhost:5432/acquisitions`.

Stop the stack with:

```bash
docker compose -f docker-compose.dev.yml down
```

Stopping `neon-local` tears down the ephemeral branch for that dev session.

### 2.4. Using @neondatabase/serverless with Neon Local (Node.js)

If you use the Neon **serverless** driver (`@neondatabase/serverless`), configure it in development to talk to Neon Local.

Example:

```js
import { neon, neonConfig } from '@neondatabase/serverless'

// In Docker dev, "neon-local" is the service name
neonConfig.fetchEndpoint = 'http://neon-local:5432/sql'
neonConfig.useSecureWebSocket = false
neonConfig.poolQueryViaFetch = true

const sql = neon(process.env.DATABASE_URL)
```

- In dev, `process.env.DATABASE_URL` is the Neon Local URL.
- In production, it will be the Neon Cloud URL (see below), and you can omit the Neon Local-specific config.

---

## 3. Production with Neon Cloud Database

### 3.1. Configure `.env.production`

Create `.env.production` with your real production settings (do **not** commit real values):

```bash
NODE_ENV=production
PORT=3000

# Replace with the DATABASE_URL from your Neon project
DATABASE_URL=postgres://user:password@your-project-region.neon.tech/acquisitions
```

- `DATABASE_URL` should be copied from the Neon control panel for your production branch.
- No Neon Local variables are needed in production.

### 3.2. docker-compose.prod.yml

`docker-compose.prod.yml` runs only the app; the database is the managed Neon Cloud service.

```yaml
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: prod
    container_name: acquisitions-app-prod
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
    ports:
      - "3000:3000"
    restart: unless-stopped
```

- No `neon-local` service here.
- The app reads `DATABASE_URL` from `.env.production` and connects directly to Neon Cloud.

### 3.3. Starting the production stack (e.g., on a VM)

On a server/VM (with Docker installed):

1. Copy the project files (or build an image and pull it).
2. Create a **non-committed** `.env.production` with real Neon credentials.
3. Run:

```bash
# Build and start in production mode
docker compose -f docker-compose.prod.yml up --build -d
```

- API available at `http://<server-host>:3000`.
- Logs via:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Stop or redeploy with:

```bash
docker compose -f docker-compose.prod.yml down
```

---

## 4. Environment variable switching summary

- **Development**
  - Uses `.env.development`.
  - `DATABASE_URL=postgres://neon:npg@neon-local:5432/acquisitions` (Neon Local proxy, ephemeral branches).

- **Production**
  - Uses `.env.production`.
  - `DATABASE_URL=postgres://user:password@your-project-region.neon.tech/acquisitions` (real Neon Cloud database).

Your Node.js application should always read from `process.env.DATABASE_URL` and **never** hardcode connection strings. The Docker Compose file used (`docker-compose.dev.yml` vs `docker-compose.prod.yml`) controls which `.env.*` file is mounted, and therefore which database the app connects to.