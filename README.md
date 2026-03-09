<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/singi-labs/.github/main/assets/sifa-logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/singi-labs/.github/main/assets/sifa-logo-light.svg">
  <img alt="Sifa Logo" src="https://raw.githubusercontent.com/singi-labs/.github/main/assets/sifa-logo-dark.svg" width="120">
</picture>

# Sifa API

**AT Protocol AppView backend for professional identity -- portable profiles, verifiable track records, no vendor lock-in.**

[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)]()
[![License: Source Available](https://img.shields.io/badge/License-Source--Available-blue)]()
[![CI](https://github.com/singi-labs/sifa-api/actions/workflows/ci.yml/badge.svg)](https://github.com/singi-labs/sifa-api/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-25%20LTS-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)](https://www.typescriptlang.org/)

</div>

---

## Overview

The AppView backend for the Sifa professional network. Handles AT Protocol OAuth authentication, professional profile aggregation via Jetstream, endorsement workflows, and professional graph queries. Reads profile data from users' PDS instances and aggregates it into a searchable professional directory.

---

## Tech Stack

| Component  | Technology                                          |
| ---------- | --------------------------------------------------- |
| Runtime    | Node.js 25 / TypeScript (strict mode)               |
| Framework  | Fastify 5                                           |
| Protocol   | @atproto/api, @atproto/oauth-client-node, Jetstream |
| Database   | PostgreSQL 17 (Drizzle ORM, Drizzle Kit migrations) |
| Cache      | Valkey 8 (via ioredis)                              |
| Validation | Zod                                                 |
| Testing    | Vitest                                              |
| Logging    | Pino (structured)                                   |

---

## Quick Start

**Prerequisites:** Node.js 25+, npm, Docker + Docker Compose, AT Protocol PDS access (Bluesky or self-hosted).

```bash
git clone https://github.com/singi-labs/sifa-api.git
cd sifa-api
npm ci

# Start PostgreSQL + Valkey
npm run services:up

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run database migrations
npm run db:migrate

# Run development server
npm run dev
```

---

## Development

```bash
npm test           # Run all tests
npm run build      # Compile TypeScript
npm run lint       # ESLint
npm run typecheck  # TypeScript strict mode check
npm run format     # Format with Prettier
```

See [CONTRIBUTING.md](https://github.com/singi-labs/.github/blob/main/CONTRIBUTING.md) for branching strategy, commit format, and code review process.

**Key standards:**

- TypeScript strict mode (no `any`, no `@ts-ignore`)
- All endpoints validate input with Zod schemas
- Conventional commits enforced (`type(scope): description`)

---

## Related Repositories

| Repository                                                     | Description                              | License          |
| -------------------------------------------------------------- | ---------------------------------------- | ---------------- |
| [sifa-web](https://github.com/singi-labs/sifa-web)             | Frontend (Next.js, React, TailwindCSS)   | Source-available |
| [sifa-lexicons](https://github.com/singi-labs/sifa-lexicons)   | AT Protocol professional profile schemas | MIT              |
| [sifa-deploy](https://github.com/singi-labs/sifa-deploy)       | Docker Compose + Caddy deployment config | Source-available |
| [sifa-workspace](https://github.com/singi-labs/sifa-workspace) | Project coordination and issue tracking  | Source-available |

---

## Community

- **Website:** [sifa.id](https://sifa.id)
- **Discussions:** [GitHub Discussions](https://github.com/orgs/singi-labs/discussions)
- **Issues:** [Report bugs](https://github.com/singi-labs/sifa-api/issues)

---

## License

**Source-available** -- Public repository, proprietary license. Lexicon schemas and import tools are MIT-licensed.

See [LICENSE](LICENSE) for full terms.

---

Made with ♥ in 🇪🇺 by [Singi Labs](https://singi.dev)
