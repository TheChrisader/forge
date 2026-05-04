# Forge

A local-first application deployment platform. Build, deploy, and manage containerized applications on your own infrastructure.

**[Watch the demo](https://www.loom.com/share/7bed62dbc26945d5aa122e9b5f04cc0f)**

## Overview

Forge provides a complete deployment pipeline, from source code to running containers, with a web dashboard, REST API, and CLI. It manages builds, deployments, health monitoring, and observability for your applications, all running on local infrastructure with Docker.

## Features

- **Project Management** - Create and configure applications with Git integration, environment variables, and resource limits
- **Build System** - Multi-language build support (Node.js, Python, Go, Rust, static sites, Dockerfiles)
- **Deployment Strategies** - Rolling updates, blue-green, canary, and recreate deployments
- **Container Orchestration** - Full lifecycle management with health checks, log streaming, and resource monitoring
- **Real-time Dashboard** - Web UI for managing projects, deployments, containers, and system resources
- **Background Workers** - Distributed job processing for builds, deployments, monitoring, and scheduled tasks
- **Managed Services** - Provision and monitor Redis, PostgreSQL, and other service dependencies
- **Observability** - Metrics collection, time-series storage, and system health dashboards
- **Authentication** - JWT tokens and API keys with role-based access
- **Plugin System** - Extend Forge with custom hooks, commands, and API endpoints

## Architecture

```
forge/
├── apps/
│   ├── api/          # REST API server (Fastify)
│   ├── cli/          # Command-line interface
│   ├── web/          # Web dashboard (React + Vite)
│   └── workers/      # Background job processors
├── packages/
│   ├── core/         # DI container, config, errors
│   ├── types/        # Shared types and Zod schemas
│   ├── database/     # Prisma client (PostgreSQL)
│   ├── cache/        # Redis caching layer
│   ├── queue/        # BullMQ job queues
│   ├── docker/       # Container management
│   ├── storage/      # Storage abstraction
│   ├── build/        # Build strategies
│   ├── deploy/       # Deployment strategies
│   ├── certificate/  # SSL certificate management
│   └── observability/ # Metrics and tracing
└── tools/            # Scripts and development utilities
```

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 10.0.0
- **Docker** and Docker Compose
- Administrator/sudo access (for TLS certificate trust)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> && cd forge
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The defaults work out of the box with the provided docker-compose configuration. No edits needed for local development.

### 3. Start infrastructure

```bash
pnpm docker:up
```

This starts PostgreSQL (TimescaleDB) and Redis in Docker containers.

### 4. Generate TLS certificates

```bash
pnpm setup:certs
```

Creates a self-signed CA and domain certificate for `*.forge.localhost`. Requires administrator privileges on Windows (you'll get a UAC prompt) or sudo on macOS/Linux. The CA is automatically trusted by your system so deployed apps serve over HTTPS without browser warnings.

Options: `--skip-trust` to skip system trust, `--force` to regenerate existing certs, `--uninstall` to remove everything.

### 5. Set up the database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

This generates the Prisma client, runs migrations, and seeds roles, permissions, and the admin account. The default admin credentials are `admin@forge.local` / `forge_admin_password`. Change them in `apps/api/.env` before running the seed if desired.

### 6. Build and start

```bash
pnpm build
pnpm start
```

`pnpm build` compiles all packages. `pnpm start` runs the API server, web dashboard, and worker processes from the compiled output.

For development with hot reload across all packages, use `pnpm dev` instead.

| Service            | URL                          |
| ------------------ | ---------------------------- |
| Web dashboard      | `http://localhost:4001`      |
| API                | `http://localhost:4000`      |
| API docs (Swagger) | `http://localhost:4000/docs` |

## Tech Stack

| Layer             | Technology                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| Frontend          | React 19, TypeScript, Vite, TanStack Router & Query, Tailwind CSS, Radix UI |
| API               | Fastify, Zod validation, Pino logging                                       |
| Database          | PostgreSQL via TimescaleDB, Prisma ORM                                      |
| Cache & Queues    | Redis, BullMQ                                                               |
| Container Runtime | Docker via Dockerode                                                        |
| Build System      | Turborepo, pnpm workspaces                                                  |
| Testing           | Vitest, Testcontainers                                                      |

## Scripts

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm dev`         | Start all services with hot reload |
| `pnpm start`       | Start all services from built output |
| `pnpm build`       | Build all packages                     |
| `pnpm test`        | Run all tests                          |
| `pnpm test:watch`  | Run tests in watch mode                |
| `pnpm typecheck`   | Type check all packages                |
| `pnpm lint`        | Lint all packages                      |
| `pnpm lint:fix`    | Lint and auto-fix                      |
| `pnpm format`      | Format code with Prettier              |
| `pnpm docker:up`   | Start infrastructure containers        |
| `pnpm docker:down` | Stop infrastructure containers         |
| `pnpm db:generate` | Generate Prisma client                 |
| `pnpm db:migrate`  | Run database migrations                |
| `pnpm db:studio`   | Open Prisma Studio                     |
| `pnpm db:seed`     | Seed the database                      |
| `pnpm forge`       | Run the CLI                            |

## License

ISC
