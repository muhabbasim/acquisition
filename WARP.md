# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Core workflows

### Node app (local, no Docker)

- Install dependencies:
  - `npm install`
- Run the API in watch mode:
  - `npm run dev`
  - Entry point: `src/index.js` → `src/server.js` → `src/app.js`.
- Run the API once (no watch):
  - `npm start`

### Linting & formatting

- Lint all JS using the local ESLint config (`eslint.config.js`):
  - `npm run lint`
- Auto-fix lint errors where possible:
  - `npm run lint:fix`
- Format the codebase with Prettier (`.prettierrc`):
  - `npm run format`
- Check formatting without writing changes:
  - `npm run format:check`

### Database & migrations (Drizzle + Neon)

- Drizzle is configured via `drizzle.config.js`:
  - Schema files: `src/models/*.js` (e.g., `src/models/user.model.js`).
  - Migrations directory: `drizzle/`.
  - Connection: `process.env.DATABASE_URL`.
- Generate migrations from schema changes:
  - `npm run db:generate`
- Apply the latest migrations to the database specified by `DATABASE_URL`:
  - `npm run db:migrate`
- Open Drizzle Studio (schema browser / query UI):
  - `npm run db:studio`

### Docker-based workflows

#### Dev stack with Neon Local

- Compose file: `docker-compose.dev.yml`.
- Services:
  - `neon-local`: Neon Local Postgres proxy.
  - `app`: Node API built from the `dev` stage in `Dockerfile`.
- Prereqs:
  - `.env.development` in the project root (see `README.md` for variables).
- Start dev environment (Neon Local + app):
  - `docker compose -f docker-compose.dev.yml up --build`
- Stop dev environment:
  - `docker compose -f docker-compose.dev.yml down`

#### Dev helper script

- Script: `scripts/dev.sh`.
- What it does:
  - Validates `.env.development` exists.
  - Ensures Docker is running.
  - Ensures `.neon_local/` exists and is in `.gitignore`.
  - Runs `npm run db:migrate`.
  - Tries a `psql` readiness check against `neon-local`.
  - Starts `docker-compose.dev.yml`.
- Run it from the repo root:
  - `npm run dev:docker`

#### Prod stack (containerized app pointing at Neon Cloud)

- Compose file: `docker-compose.prod.yml`.
- Service:
  - `app`: Node API built from the `prod` stage in `Dockerfile`.
- Prereqs:
  - `.env.production` in the project root with a Neon Cloud `DATABASE_URL` (see `README.md`).
- Typical usage on a server/VM:
  - `docker compose -f docker-compose.prod.yml up --build -d`
  - Tail logs: `docker compose -f docker-compose.prod.yml logs -f`
  - Tear down: `docker compose -f docker-compose.prod.yml down`

#### Prod helper script (note: currently dev-like)

- Script: `scripts/prod.sh`.
- Behavior today is mostly development-oriented:
  - References `.env.development` and `docker-compose.dev.yml`, and prints mixed dev/prod messaging.
- Treat this script as a convenience wrapper around the dev stack unless it is corrected to use `.env.production` and `docker-compose.prod.yml`.
- Run it from the repo root:
  - `npm run prod:docker`

### Environment configuration

- Development:
  - `.env.development` provides `DATABASE_URL` for Neon Local and credentials for the Neon Local proxy.
  - The dev compose file maps `DATABASE_URL` into the app container, defaulting to a Neon Local connection string if not set.
- Production:
  - `.env.production` provides `NODE_ENV=production`, `PORT`, and a Neon Cloud `DATABASE_URL`.
- All runtime code reads `process.env.DATABASE_URL` (see `src/config/database.js` and `drizzle.config.js`).

## High-level architecture

### Overview

- This is a small Node.js/Express HTTP API.
- Persistence is via Neon-hosted Postgres, accessed using the Neon HTTP driver (`@neondatabase/serverless`) and Drizzle ORM.
- The app is designed to run both locally (with Neon Local) and in production (against Neon Cloud) using Docker.

### Entrypoints & server wiring

- `src/index.js`
  - Loads environment variables via `dotenv/config` and imports `./server.js`.
- `src/server.js`
  - Creates the HTTP listener on `process.env.PORT || 3000` and calls `app.listen`.
- `src/app.js`
  - Creates the Express app and wires middleware, routes, and health endpoints.

### Middleware stack

- Security & parsing (in order in `src/app.js`):
  - `helmet()` — sets security-related HTTP headers.
  - `cors()` — enables cross-origin requests (currently wide-open).
  - `express.json()` / `express.urlencoded({ extended: true })` — body parsers.
  - `cookie-parser` — exposes signed/unsigned cookies on `req.cookies`.
- Logging:
  - `morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } })` — HTTP access logs are forwarded into the Winston logger configured in `src/config/logger.js`.
- Arcjet-based security middleware:
  - `securityMiddleware` from `src/middleware/security.middlewar.js` is applied globally via `app.use(securityMiddleware)`.

### Arcjet + rate limiting/security

- Core configuration in `src/config/arcjet.js`:
  - Initializes a single Arcjet client (`aj`) with:
    - `shield({ mode: 'LIVE' })` to block common attack patterns.
    - `detectBot` rule with selected allowed categories.
    - A base `slidingWindow` rule (5 requests / 2s) as a default guard.
- Request-level middleware in `src/middleware/security.middlewar.js`:
  - Derives a role from `req.user?.role` (defaults to `guest`).
  - Establishes role-based rate limits via an additional `slidingWindow` rule:
    - `admin`: 20 req/min.
    - `user`: 10 req/min.
    - `guest`: 5 req/min.
  - Uses `aj.withRule(...)` to attach per-role rate-limiting.
  - Calls `client.protect(req)` and inspects the decision:
    - Bot traffic → 403 with a bot-specific message.
    - Shield-detected malicious traffic → 403 with a security policy message.
    - Rate-limit violations → 403 with a role-specific message.
  - Logs all denials via the shared `logger` with IP, user agent and path.

### Logging

- Configured in `src/config/logger.js` using Winston.
- Characteristics:
  - Default level is `process.env.LOG_LEVEL || 'info'`.
  - File transports write to `logs/error.log` and `logs/combined.log`.
  - In non-production environments, adds a colorized console transport.
- All higher-level modules (controllers/services/middleware) import this singleton logger.
- HTTP access logs from Morgan are routed through this same logger.

### Database access layer

- Connection config: `src/config/database.js`.
  - Creates a Neon SQL client using `neon(process.env.DATABASE_URL)`.
  - Wraps it with Drizzle via `drizzle(sql)` and exports `db` and `sql`.
- Schema:
  - `src/models/user.model.js` defines the `users` table (id, name, email, password, role, created_at, updated_at) using `drizzle-orm/pg-core`.
  - Drizzle migrations emitted from this schema live under `drizzle/` (e.g., `drizzle/0000_*.sql`).
- Consumers:
  - `src/services/auth.service.js` and `src/services/users.services.js` import `db` and the `users` table to perform queries.

### Request lifecycle & domain layers

#### Auth flow

- Routes: `src/routes/auth.routes.js` mounted at `/api/auth` in `src/app.js`.
  - `POST /api/auth/sign-up` → `signUp` controller.
  - `POST /api/auth/sign-in` → `signIn` controller.
  - `POST /api/auth/sign-out` → `signOut` controller.
- Controllers: `src/controllers/auth.controller.js`.
  - Validation:
    - Uses Zod schemas from `src/validations/autn.validation.js` (`signupSchema`, `signInSchema`).
    - On failure, returns `400` with a human-readable message aggregated by `formatValidationError` from `src/utils/format.js`.
  - User creation/authentication:
    - Delegated to `createUser` / `authenticateUser` in `src/services/auth.service.js`.
  - JWT handling:
    - Uses `jwtToken` from `src/utils/jwt.js` to sign tokens with `process.env.JWT_SECRET` and a `1d` expiry.
    - On success, sets a secure HTTP-only `token` cookie via `cookies.set` from `src/utils/cookies.js`.
  - Logging:
    - Logs successes and failures with contextual information.
- Services: `src/services/auth.service.js`.
  - Password management via `bcrypt` with a cost factor of 10.
  - User lookup & insert via Drizzle:
    - `authenticateUser` selects by `email` and compares passwords.
    - `createUser` checks for existing user by email, hashes the password, and inserts a new row returning a subset of columns.

#### User resource flow

- Routes: `src/routes/users.routes.js` mounted at `/api/users`.
  - `GET /api/users/get-users` → fetch all users.
  - `GET /api/users/:id` → fetch a single user.
  - `PUT /api/users/:id` → update user.
  - `DELETE /api/users/:id` → delete user.
- Controllers: `src/controllers/users.controller.js`.
  - Responsible for:
    - Parsing `id` from `req.params`.
    - Calling the appropriate service method.
    - Returning resource-centric JSON payloads and 404s where applicable.
- Services: `src/services/users.services.js`.
  - Encapsulate all direct Drizzle calls for `users`:
    - `getAllUsers`, `getUserById`, `updateUserById`, `deleteUserById`.
  - Always return shaped objects with only public fields (no password).

### Utility modules

- `src/utils/cookies.js` — shared cookie options and helpers for setting/clearing/getting cookies.
- `src/utils/format.js` — formats Zod validation errors to human-readable strings.
- `src/utils/jwt.js` — wraps `jsonwebtoken` sign/verify with logging and a fixed expiry.
- `src/validations/autn.validation.js` — Zod schemas for signup / signin payloads.

### Health and diagnostics

- Implemented in `src/app.js`:
  - `GET /` — simple plaintext greeting.
  - `GET /health` — JSON health check: `{ status, timestamp, uptime }`.
  - `GET /api` — simple JSON message indicating the API is running.

## Testing

- Test runner: Jest, configured via `jest.config.mjs`.
- Run the full test suite: `npm test`.
- Run a single test file: `npm test -- path/to/your.test.js`.
- Filter tests by name pattern: `npm test -- --testNamePattern="partial name"`.
- Jest is configured for coverage by default (output in `coverage/`).
