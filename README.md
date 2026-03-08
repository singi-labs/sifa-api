# Sifa API

AppView backend for Sifa, a professional identity network on the AT Protocol.

## Tech Stack

| Technology  | Version | Purpose                         |
| ----------- | ------- | ------------------------------- |
| Fastify     | 5       | HTTP framework                  |
| PostgreSQL  | 17      | Primary database                |
| Drizzle ORM | 0.45    | Database queries and migrations |
| Valkey      | 8       | Caching and OAuth state         |
| TypeScript  | 5.9     | Language                        |
| Vitest      | 4       | Testing                         |

## Quick Start

### Prerequisites

- Node.js 25+
- PostgreSQL 17
- Valkey 8 (optional for local dev)

### Setup

```sh
git clone https://github.com/singi-labs/sifa-api.git
cd sifa-api
npm ci
```

Copy `.env.example` to `.env` and fill in the required values:

```sh
cp .env.example .env
```

Start development services (PostgreSQL and Valkey via Docker):

```sh
npm run services:up
```

Run database migrations:

```sh
npm run db:migrate
```

Start the development server:

```sh
npm run dev
```

## Available Scripts

| Script              | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start development server with hot reload |
| `npm run build`     | Compile TypeScript to JavaScript         |
| `npm test`          | Run test suite                           |
| `npm run lint`      | Run ESLint                               |
| `npm run typecheck` | Run TypeScript type checking             |
| `npm run format`    | Format code with Prettier                |

## License

Source-available. See [LICENSE](./LICENSE) for details.

---

[sifa.id](https://sifa.id)
