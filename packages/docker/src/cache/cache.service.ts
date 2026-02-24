import type { PrismaClient } from "@forge/database";
import { createHash } from "node:crypto";
import * as tar from "tar-fs";
import * as fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface CacheConfig {
  strategy: "always" | "on-change" | "never";
  maxAgeDays: number;
  maxSizeGB: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  strategy: "on-change",
  maxAgeDays: 7,
  maxSizeGB: 10,
} as const;

export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  averageAgeDays: number;
  oldestEntry?: Date;
}

export class BuildCacheService {
  private readonly cacheDir: string;

  constructor(
    private readonly db: PrismaClient,
    cacheDir?: string
  ) {
    this.cacheDir = cacheDir ?? path.join(os.tmpdir(), "forge-build-cache");
  }

  /**
   * Computes a hash key from package.json dependencies for caching
   */
  async computeDependencyKey(projectPath: string): Promise<string> {
    const packageJsonPath = path.join(projectPath, "package.json");

    try {
      const content = await fs.readFile(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        engines?: { node?: string };
      };

      const hash = createHash("sha256");
      hash.update(
        JSON.stringify({
          dependencies: pkg.dependencies ?? {},
          devDependencies: pkg.devDependencies ?? {},
          // Include Node version if specified
          nodeVersion: pkg.engines?.node ?? "18",
        })
      );

      return hash.digest("hex");
    } catch {
      // No package.json - return empty hash
      return "";
    }
  }

  /**
   * Checks if a cached artifact exists for the given key
   */
  async getCachedArtifact(projectId: string, key: string): Promise<string | null> {
    const cached = await this.db.buildCache.findUnique({
      where: {
        projectId_key: { projectId, key },
      },
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      await this.deleteCacheEntry(cached.id);
      return null;
    }

    // Update last used time
    await this.db.buildCache.update({
      where: { id: cached.id },
      data: { lastUsedAt: new Date() },
    });

    // Check if file exists
    try {
      await fs.access(cached.path);
      return cached.path;
    } catch {
      // File missing - invalidate cache
      await this.deleteCacheEntry(cached.id);
      return null;
    }
  }

  /**
   * Stores a cached artifact (e.g., node_modules directory)
   */
  async storeArtifact(
    projectId: string,
    key: string,
    sourcePath: string,
    maxAgeDays: number = DEFAULT_CACHE_CONFIG.maxAgeDays
  ): Promise<void> {
    // Ensure cache directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Create tarball
    const filename = `${projectId}_${key.slice(0, 16)}.tar.gz`;
    const tarballPath = path.join(this.cacheDir, filename);

    await new Promise<void>((resolve, reject) => {
      const pack = tar.pack(sourcePath);
      const output = createWriteStream(tarballPath);
      pack.pipe(output);
      output.on("finish", resolve);
      output.on("error", reject);
      pack.on("error", reject);
    });

    // Get file size
    const stats = await fs.stat(tarballPath);

    // Store in database
    const expiresAt = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000);

    await this.db.buildCache.upsert({
      where: {
        projectId_key: { projectId, key },
      },
      create: {
        projectId,
        key,
        path: tarballPath,
        size: BigInt(stats.size),
        expiresAt,
      },
      update: {
        path: tarballPath,
        size: BigInt(stats.size),
        expiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Extracts a cached artifact to a destination path
   */
  async extractArtifact(tarballPath: string, destPath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const extract = tar.extract(destPath);
      const input = createReadStream(tarballPath);
      input.pipe(extract);
      extract.on("finish", resolve);
      input.on("error", reject);
      extract.on("error", reject);
    });
  }

  /**
   * Prunes old/unused cache entries
   */
  async pruneCache(
    projectId: string,
    maxAgeDays: number = DEFAULT_CACHE_CONFIG.maxAgeDays
  ): Promise<{
    deleted: number;
    freedBytes: number;
  }> {
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

    const oldEntries = await this.db.buildCache.findMany({
      where: {
        projectId,
        lastUsedAt: { lt: cutoffDate },
      },
    });

    let freedBytes = 0;

    for (const entry of oldEntries) {
      // Delete file
      try {
        await fs.unlink(entry.path);
        freedBytes += Number(entry.size);
      } catch {
        // File already gone
      }

      // Delete database record
      await this.db.buildCache.delete({ where: { id: entry.id } });
    }

    return {
      deleted: oldEntries.length,
      freedBytes,
    };
  }

  /**
   * Clears all cache entries for a project
   */
  async clearCache(projectId: string): Promise<{ deleted: number; freedBytes: number }> {
    const entries = await this.db.buildCache.findMany({
      where: { projectId },
    });

    let freedBytes = 0;

    for (const entry of entries) {
      try {
        await fs.unlink(entry.path);
        freedBytes += Number(entry.size);
      } catch {
        // File already gone
      }

      await this.db.buildCache.delete({ where: { id: entry.id } });
    }

    return {
      deleted: entries.length,
      freedBytes,
    };
  }

  /**
   * Gets cache statistics for a project
   */
  async getCacheStats(projectId: string): Promise<CacheStats> {
    const entries = await this.db.buildCache.findMany({
      where: { projectId, deletedAt: null },
    });

    const totalSize = entries.reduce((sum, e) => sum + Number(e.size), 0);

    let avgAge = 0;
    let oldestEntry: Date | undefined;

    if (entries.length > 0) {
      const now = Date.now();
      const totalAge = entries.reduce((sum, e) => sum + (now - e.createdAt.getTime()), 0);
      avgAge = Math.round(totalAge / entries.length / (1000 * 60 * 60 * 24));

      const oldest = entries.reduce((oldest, e) => (e.createdAt < oldest.createdAt ? e : oldest));
      oldestEntry = oldest.createdAt;
    }

    return {
      totalEntries: entries.length,
      totalSizeBytes: totalSize,
      averageAgeDays: avgAge,
      oldestEntry,
    };
  }

  /**
   * Gets cache config from Project.config, with defaults
   */
  getCacheConfig(projectConfig: Record<string, unknown>): CacheConfig {
    const buildCache = projectConfig.buildCache as CacheConfig | undefined;

    return {
      strategy: buildCache?.strategy ?? DEFAULT_CACHE_CONFIG.strategy,
      maxAgeDays: buildCache?.maxAgeDays ?? DEFAULT_CACHE_CONFIG.maxAgeDays,
      maxSizeGB: buildCache?.maxSizeGB ?? DEFAULT_CACHE_CONFIG.maxSizeGB,
    };
  }

  private async deleteCacheEntry(id: string): Promise<void> {
    const entry = await this.db.buildCache.findUnique({ where: { id } });
    if (!entry) return;

    try {
      await fs.unlink(entry.path);
    } catch {
      // File already gone
    }

    await this.db.buildCache.delete({ where: { id } });
  }
}
