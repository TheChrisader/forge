# Forge

A local-first application deployment platform. Build, deploy, and manage containerized applications on your own infrastructure.

## Overview

Forge provides a complete deployment pipeline — from source code to running containers — with a web dashboard, REST API, and CLI. It manages builds, deployments, health monitoring, and observability for your applications, all running on local infrastructure with Docker.

## Features

- **Project Management** — Create and configure applications with Git integration, environment variables, and resource limits
- **Build System** — Multi-language build support (Node.js, Python, Go, Rust, static sites, Dockerfiles)
- **Deployment Strategies** — Rolling updates, blue-green, canary, and recreate deployments
- **Container Orchestration** — Full lifecycle management with health checks, log streaming, and resource monitoring
- **Real-time Dashboard** — Web UI for managing projects, deployments, containers, and system resources
- **Background Workers** — Distributed job processing for builds, deployments, monitoring, and scheduled tasks
- **Managed Services** — Provision and monitor Redis, PostgreSQL, and other service dependencies
- **Observability** — Metrics collection, time-series storage, and system health dashboards
- **Authentication** — JWT tokens and API keys with role-based access
- **Plugin System** — Extend Forge with custom hooks, commands, and API endpoints

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

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure

```bash
pnpm docker:up
```

This starts PostgreSQL (TimescaleDB) and Redis in Docker containers.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_PASSWORD` — Redis password (defaults to `forge_dev_password` from docker-compose)
- `JWT_SECRET` — A random string, at least 32 characters

### 4. Set up the database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Start development

```bash
pnpm dev
```

This starts the API server, web dashboard, and worker processes concurrently via Turborepo.

The web dashboard is available at `http://localhost:5173` and the API at `http://localhost:4000`. API documentation (Swagger) is available at `http://localhost:4000/docs`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TanStack Router & Query, Tailwind CSS, Radix UI |
| API | Fastify, Zod validation, Pino logging |
| Database | PostgreSQL via TimescaleDB, Prisma ORM |
| Cache & Queues | Redis, BullMQ |
| Container Runtime | Docker via Dockerode |
| Build System | Turborepo, pnpm workspaces |
| Testing | Vitest, Testcontainers |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | Type check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm lint:fix` | Lint and auto-fix |
| `pnpm format` | Format code with Prettier |
| `pnpm docker:up` | Start infrastructure containers |
| `pnpm docker:down` | Stop infrastructure containers |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed the database |
| `pnpm forge` | Run the CLI |

## License

ISC
