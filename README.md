# SHL Operations OS — first development milestone

Independent internal application. The existing `shl-global` website is untouched.

## Static GitHub Pages preview

The read-only visual demo is in [`docs/demo`](docs/demo) and is published from a separate, public static-only repository so this application repository can stay private. It does not run the Next.js app, authenticate users, connect to the API, or store records. It contains no sample customer or supplier data. The full application still requires its Docker services and database.

GitHub Pages sites are publicly accessible. See [the preview](https://niloy-datta.github.io/shl-operations-preview/) for the static interface demo.

## Run locally

1. Install Docker Desktop with Compose.
2. Copy `.env.example` to `.env`. Set distinct random database and admin passwords; set `SESSION_KEY` to 64 random hexadecimal characters. For example, `python -c "import secrets; print(secrets.token_hex(32))"` generates a session key. Do not commit `.env`.
3. Run `docker compose up --build` in this folder.
4. Open `http://localhost:3000` and sign in with the bootstrap admin credentials.

The PostgreSQL volume persists records between restarts. To rerun checks in an environment with Docker, run `docker compose run --rm api mvn test` only in a build image with Maven, or `cd apps/api && mvn test` with Java 25 and Maven installed. For the web, run `cd apps/web && npm install && npm run typecheck && npm run lint && npm run build`.

## Implemented scope (runtime verification pending)

- Admin sign in, encrypted HTTP only browser session, internal REST API authorization.
- PostgreSQL migrations, customer and supplier create/list/search, pagination, live dashboard totals.
- Responsive workspace and empty, loading, error states.
- No fabricated business metrics or sample records.

## Boundaries

This is a **local first milestone**, not a production release. The initial account is bootstrapped only if `staff_users` is empty; changing the environment password later does not rotate the database password. A privileged operator must manage account rotation directly until staff management is implemented. The API is private inside Compose, while only the web interface is exposed on loopback. The app uses a short lived encrypted credential session; later replace this with full staff identity management, individual access roles, MFA, audit events, and secure production deployment. Do not use real company data yet.

Current machine check: Node 24 and Java 21 are present; Java 25, Maven, Docker and package registry access were unavailable, so build/runtime validation was not possible here. See [architecture](docs/architecture.md) and [website integration](docs/website-integration.md).
