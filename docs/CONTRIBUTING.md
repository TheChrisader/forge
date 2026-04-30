# Contributing to Forge

## Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

## Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure all tests pass locally
4. Push your branch and create a PR
5. Wait for CI checks to pass
6. Address review feedback
7. Merge when approved

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes (dependencies, etc.)

### Examples

```
feat(docker): add container stats collection

Implement stats collection for monitoring container resource usage.

Closes #123
```

```
fix(database): resolve connection pool leak

The connection pool was not properly releasing connections,
causing the application to hang after extended use.

Fixes #456
```

## Code Style

- Run `pnpm lint` before committing
- Run `pnpm format` to auto-format code
- Follow TypeScript best practices
- Write tests for new features
- Update documentation

## Running Tests

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# All tests via turbo
pnpm test

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Specific package
pnpm --filter @forge/docker test
```

## Building

```bash
# Build all packages (includes postbuild step)
pnpm build

# Build specific package
pnpm --filter @forge/docker build

# Generate Prisma client (required before building)
pnpm db:generate
```

## Development Setup

```bash
# Install dependencies
pnpm install

# Start development services (Postgres, Redis)
pnpm docker:up

# Generate Prisma client
pnpm db:generate

# Build all packages
pnpm build

# Run database migrations
pnpm db:migrate
```

## Project Structure

```
apps/
  api/        REST API server
  cli/        CLI tool
  web/        Web dashboard
  workers/    Background job workers

packages/
  auth/             Authentication & authorization
  build/            Build system integration
  cache/            Redis caching layer
  certificate/      TLS certificate management
  core/             Shared core utilities
  database/         Prisma ORM layer
  deploy/           Deployment orchestration
  docker/           Docker engine integration
  git/              Git operations
  integrations/     Third-party integrations
  logger/           Structured logging
  observability/    Metrics, traces, logs collection
  proxy/            Reverse proxy management
  queue/            Job queue (Redis BullMQ)
  security/         Security utilities
  service-catalog/  Service registry
  storage/          File storage abstraction
  test-utils/       Shared test utilities
  types/            Shared TypeScript types
```

## Questions?

Open an issue or reach out to the maintainers!
