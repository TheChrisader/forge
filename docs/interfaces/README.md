# Forge Interface Definitions

This document describes all the interfaces that define contracts between different parts of the Forge platform.

## Infrastructure Interfaces

### IContainerRuntime

Container runtime abstraction for Docker, Podman, etc.

**Location:** `packages/docker/src/interfaces/runtime.ts`

**Purpose:** Abstract away the container runtime implementation

**Methods:**

- `create()` - Create a container
- `start()` - Start a container
- `stop()` - Stop a container
- `remove()` - Remove a container
- `exec()` - Execute command in container
- `logs()` - Stream container logs
- `stats()` - Get container stats

### IStorageProvider

Storage backend abstraction for local, S3, Garage, GCS, Azure, etc.

**Location:** `packages/storage/src/interfaces/provider.ts`

**Purpose:** Abstract file storage operations

**Methods:**

- `upload()` - Upload file
- `download()` - Download file
- `delete()` - Delete file
- `list()` - List files
- `getMetadata()` - Get file metadata
- `getSignedUrl()` - Generate pre-signed URL

### IReverseProxy

Reverse proxy abstraction for Traefik, Caddy, Nginx, etc.

**Location:** `packages/proxy/src/interfaces/proxy.ts`

**Purpose:** Abstract reverse proxy configuration

**Methods:**

- `addRoute()` - Add a route
- `removeRoute()` - Remove a route
- `addCertificate()` - Add SSL certificate
- `reload()` - Reload configuration

## Build & Deploy Interfaces

### IBuildStrategy

Build strategy for different frameworks/languages.

**Location:** `packages/build/src/interfaces/strategy.ts`

**Purpose:** Pluggable build strategies (Node.js, Python, Go, etc.)

**Methods:**

- `detect()` - Detect if strategy can handle project
- `build()` - Build the project
- `getDefaultConfig()` - Get default configuration

### IDeploymentStrategy

Deployment strategy (rolling, blue-green, canary, etc.)

**Location:** `packages/deploy/src/interfaces/strategy.ts`

**Purpose:** Pluggable deployment strategies

**Methods:**

- `execute()` - Execute deployment
- `rollback()` - Rollback deployment
- `getStatus()` - Get deployment status

## Service Layer Interfaces

### IProjectService

Business logic for project management.

**Location:** `packages/core/src/services/interfaces.ts`

**Methods:**

- `create()` - Create project
- `update()` - Update project
- `delete()` - Delete project
- `deploy()` - Deploy project
- `rollback()` - Rollback deployment

### IDeploymentService

Business logic for deployment management.

### IContainerService

Business logic for container management.

### ILogService

Business logic for log querying.

### IMetricsService

Business logic for metrics collection.

### ISecretService

Business logic for secret management.

## Integration Interfaces

### INotificationProvider

Notification backend (Slack, Discord, Email, Webhook).

**Location:** `packages/integrations/src/interfaces/notification.ts`

**Methods:**

- `send()` - Send notification
- `test()` - Test configuration

## Plugin System

### IPlugin

Plugin interface for extending Forge.

**Location:** `packages/core/src/plugins/interfaces.ts`

**Hooks:**

- `onLoad()` - Plugin initialization
- `beforeDeploy()` - Before deployment
- `afterDeploy()` - After deployment
- `beforeBuild()` - Before build
- `afterBuild()` - After build

## Usage Examples

### Implementing IStorageProvider

```typescript
import { IStorageProvider } from "@forge/storage";

export class S3StorageProvider implements IStorageProvider {
  async upload(key: string, data: Buffer): Promise<{ key: string }> {
    // Implementation
  }

  async download(key: string): Promise<Buffer> {
    // Implementation
  }

  // ... other methods
}
```

### Using Service Container

```typescript
import { ServiceContainer, SERVICE_KEY_STRINGS } from "@forge/core";
import { S3StorageProvider } from "./providers/s3";

const container = new ServiceContainer();

container.singleton(SERVICE_KEY_STRINGS.STORAGE, () => {
  return new S3StorageProvider(config);
});

// Later, resolve the service
const storage = await container.resolve<IStorageProvider>(SERVICE_KEY_STRINGS.STORAGE);
await storage.upload("file.txt", buffer);
```

## Interface Guidelines

### 1. Keep Interfaces Focused

Each interface should have a single, well-defined responsibility.

### 2. Use Async by Default

Most operations should be async to allow for I/O operations.

### 3. Return Results, Not Void

Return meaningful results that can be inspected and logged.

### 4. Include Metadata

Include metadata like IDs, timestamps in results.

### 5. Validate Input

Interfaces should include validation methods.

### 6. Document Thoroughly

Use JSDoc comments to document all methods.

## Testing Interfaces

All interfaces should have:

- Mock implementations for testing
- Integration tests with real implementations
- Contract tests to verify implementations

Example mock:

```typescript
export class MockStorageProvider implements IStorageProvider {
  private files = new Map<string, Buffer>();

  async upload(key: string, data: Buffer): Promise<{ key: string }> {
    this.files.set(key, data);
    return { key };
  }

  // ... other methods
}
```
