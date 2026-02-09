# Forge CLI

Command-line interface for the Forge platform.

## Installation

### Local Development

```bash
pnpm --filter @forge/cli build
pnpm forge --help
```

### Global Installation

```bash
./tools/scripts/install-cli.sh
forge --help
```

Or manually:

```bash
cd apps/cli
npm link
```

## Usage

### Configuration

```bash
# View current config
forge config get

# Set API URL
forge config set-url http://localhost:3000

# Set API key
forge config set-key your-api-key-here

# Set default project
forge config set-project abc123
```

### Projects

```bash
# List all projects
forge projects list

# List with pagination
forge projects list --page 1 --limit 50

# Create a project (interactive)
forge projects create

# Create with flags
forge projects create --name my-app --type nodejs

# Create without interactive mode
forge projects create --name my-app --type nodejs --no-interactive

# Get project details
forge projects get abc123

# Delete project (with confirmation)
forge projects delete abc123

# Delete project without confirmation
forge projects delete abc123 --force
```

### Deployment

```bash
# Deploy default project
forge deploy

# Deploy specific project
forge deploy abc123

# Deploy with version
forge deploy abc123 --version v1.2.3

# Deploy with strategy
forge deploy abc123 --strategy blue-green
```

### Logs

```bash
# View logs for default project
forge logs

# View logs for specific project
forge logs abc123

# Follow logs (live tail)
forge logs --follow

# Last 50 lines
forge logs --lines 50

# Filter by level
forge logs --level error
```

## Project Types

When creating a project, you can specify one of the following types:

- `nodejs` - Node.js applications
- `python` - Python applications
- `go` - Go applications
- `rust` - Rust applications
- `static` - Static sites
- `docker` - Docker containers

## Environment Variables

The CLI respects the following environment variables (they override config file settings):

- `FORGE_API_URL` - Override API URL
- `FORGE_API_KEY` - API authentication key

## Configuration File

The CLI stores its configuration in `~/.forge/config.json`:

```json
{
  "apiUrl": "http://localhost:3000",
  "apiKey": "your-api-key",
  "defaultProject": "abc123"
}
```

## Development

```bash
# Build the CLI
pnpm --filter @forge/cli build

# Watch mode for development
pnpm --filter @forge/cli dev

# Run the CLI
pnpm forge --help

# Type check
pnpm --filter @forge/cli typecheck

# Lint
pnpm --filter @forge/cli lint
```

## Commands Reference

### Global Options

- `-v, --verbose` - Enable verbose output
- `-h, --help` - Display help
- `-V, --version` - Display version number

### Config Commands

- `forge config get` - Show current configuration
- `forge config set-url <url>` - Set API URL
- `forge config set-key <key>` - Set API key
- `forge config set-project <id>` - Set default project

### Project Commands

- `forge projects list` - List all projects
- `forge projects create` - Create a new project
- `forge projects get <id>` - Get project details
- `forge projects delete <id>` - Delete a project

### Other Commands

- `forge deploy [project-id]` - Deploy a project
- `forge logs [project-id]` - View project logs
