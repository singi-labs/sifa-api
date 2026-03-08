# Sifa API -- AppView Backend

<!-- Auto-generated from sifa-workspace. To propose changes, edit the source:
     https://github.com/singi-labs/sifa-workspace -->

Source-available | Part of [github.com/singi-labs](https://github.com/singi-labs)

The AppView backend for Sifa -- a decentralized professional identity and career network on the AT Protocol. Subscribes to AT Protocol Jetstream, indexes `id.sifa.*` records in PostgreSQL, and exposes a REST API for professional profiles, endorsements, search, and reputation.

## Tech Stack

| Component  | Technology                                                      |
| ---------- | --------------------------------------------------------------- |
| Runtime    | Node.js 25 / TypeScript (strict)                                |
| Framework  | Fastify 5                                                       |
| Protocol   | @atproto/api, @atproto/oauth-client-node, Jetstream (WebSocket) |
| Database   | PostgreSQL 17 (Drizzle ORM, Drizzle Kit migrations)             |
| Cache      | Valkey 8                                                        |
| Testing    | Vitest + Supertest                                              |
| Logging    | Pino (structured)                                               |
| Monitoring | GlitchTip (Sentry SDK-compatible)                               |
| Security   | Helmet + Zod + DOMPurify + rate limiting                        |

## What This Repo Does

- Subscribes to AT Protocol Jetstream, filtering for `id.sifa.*` collections
- Indexes professional profile records (positions, skills, education, endorsements) in PostgreSQL
- Exposes REST API routes: `/api/profile/*`, `/api/search/*`, `/api/endorsement/*`, `/api/import/*`
- Handles AT Protocol OAuth 2.1 authentication (PKCE, DPoP, PAR)
- Queries Barazo AppView for per-community reputation data (cached in Valkey)
- Validates all Jetstream records before indexing (Zod)
- Validates all API input (Zod), sanitizes all output (DOMPurify)
- Publishes Trust & Safety labels as AT Protocol labels (sybil detection, anti-abuse)

## API-Specific Standards

- Every API endpoint validates input with a Zod schema
- Every Jetstream record validated before indexing
- DOMPurify sanitization on all user-generated content output
- Helmet + CSP + HSTS + rate limiting on all endpoints
- GlitchTip error monitoring from first deployment
- No raw SQL -- Drizzle ORM with parameterized queries only
- LinkedIn import data is untrusted -- mapper must validate and sanitize every CSV field
- AT Protocol service layer wraps all interactions with user PDS instances and the Barazo AppView
- Health checks: `GET /api/health` (process), `GET /api/health/ready` (dependencies)

---

## Project-Wide Standards

### About Sifa

Decentralized professional identity and career network built on the [AT Protocol](https://atproto.com/). Portable profiles, verifiable track record from real community contributions, no vendor lock-in.

- **Organization:** [github.com/singi-labs](https://github.com/singi-labs)
- **License:** Source-available (sifa-api, sifa-web) / MIT (sifa-lexicons)

### Coding Standards

1. **Test-Driven Development** -- write tests before implementation (Vitest).
2. **Strict TypeScript** -- `strict: true`, no `any`, no `@ts-ignore`.
3. **Conventional commits** -- `type(scope): description`.
4. **CI must pass** -- lint, typecheck, tests, security scan on every PR.
5. **Input validation** -- Zod schemas on all API inputs and Jetstream records.
6. **Output sanitization** -- DOMPurify on all user-generated content.
7. **No raw SQL** -- Drizzle ORM with parameterized queries only.
8. **Structured logging** -- Pino logger, never `console.log`.
9. **Pin exact versions** -- no `^` or `~` in package.json.
10. **Named exports** -- prefer named exports over default exports.

### Git Workflow

All changes go through Pull Requests -- never commit directly to `main`. Branch naming: `type/short-description` (e.g., `feat/endorsement-api`, `fix/import-validation`).

### AT Protocol Context

- Users own their data (stored on their Personal Data Server)
- The AppView (sifa-api) indexes data from the AT Protocol Jetstream
- Lexicons (`id.sifa.*`) define the professional profile data schema
- Identity is portable via DIDs -- no vendor lock-in
- All record types are validated against lexicon schemas
- Sifa reuses `forum.barazo.*` lexicons for timeline posts and `community.lexicon.*` for location/calendar
