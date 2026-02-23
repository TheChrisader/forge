/**
 * Local storage provider
 * Implements IStorageProvider for local filesystem storage
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  IStorageProvider,
  StorageMetadata,
  UploadOptions,
  DownloadOptions,
  ListOptions,
  ListResult,
} from "../interfaces/provider.js";

/**
 * LocalStorageProvider implements file storage on the local filesystem
 * Path traversal protection is built-in to prevent unauthorized file access
 */
export class LocalStorageProvider implements IStorageProvider {
  constructor(private readonly basePath: string) {
    // Ensure base directory exists
    fs.mkdir(basePath, { recursive: true }).catch(() => {
      // Ignore errors - directory may already exist
    });
  }

  /**
   * Get the full path for a given key, with path traversal protection
   */
  private getFullPath(key: string): string {
    // Check for suspicious patterns that look like escaped path traversal attempts
    // Patterns like "...." or multiple ".." sequences are often used to bypass filters
    if (/\.{3,}/.test(key)) {
      throw new Error(`Path traversal detected: key "${key}" contains suspicious path components`);
    }

    // Normalize the path first (this resolves things like ./subdir/../file.txt)
    const normalized = path.normalize(key);

    // Build the full path
    const fullPath = path.join(this.basePath, normalized);

    // Ensure the resolved path is still within basePath
    const resolvedBase = path.resolve(this.basePath);
    const resolvedFull = path.resolve(fullPath);

    if (!resolvedFull.startsWith(resolvedBase)) {
      throw new Error(`Path traversal detected: key "${key}" attempts to escape base directory`);
    }

    return resolvedFull;
  }

  /**
   * Normalize a key for consistent storage and return
   * Removes redundant path components while preserving the logical path
   */
  private normalizeKey(key: string): string {
    // Check for suspicious patterns that look like escaped path traversal attempts
    if (/\.{3,}/.test(key)) {
      throw new Error(`Path traversal detected: key "${key}" contains suspicious path components`);
    }

    // Normalize the path (resolves . and .. segments)
    const normalized = path.normalize(key);

    // Verify the normalized path doesn't escape
    const fullPath = path.join(this.basePath, normalized);
    const resolvedBase = path.resolve(this.basePath);
    const resolvedFull = path.resolve(fullPath);

    if (!resolvedFull.startsWith(resolvedBase)) {
      throw new Error(`Path traversal detected: key "${key}" attempts to escape base directory`);
    }

    // Convert back to forward slashes for consistent storage
    return normalized.replace(/\\/g, "/");
  }

  async upload(
    key: string,
    data: Buffer | string,
    options?: UploadOptions
  ): Promise<{ key: string; etag?: string }> {
    const normalizedKey = this.normalizeKey(key);
    const fullPath = this.getFullPath(normalizedKey);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await fs.writeFile(fullPath, buffer);

    // Store metadata if provided
    if (options?.metadata) {
      await this.setMetadata(normalizedKey, options.metadata);
    }

    // Generate a simple etag from file size and mtime
    const stats = await fs.stat(fullPath);
    const etag = `${stats.size}-${stats.mtime.getTime()}`;

    return { key: normalizedKey, etag };
  }

  async uploadStream(
    key: string,
    stream: NodeJS.ReadableStream,
    options?: UploadOptions
  ): Promise<{ key: string; etag?: string }> {
    const normalizedKey = this.normalizeKey(key);
    const fullPath = this.getFullPath(normalizedKey);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });

    const { createWriteStream } = await import("node:fs");
    const writeStream = createWriteStream(fullPath);

    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on("error", reject);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Store metadata if provided
    if (options?.metadata) {
      await this.setMetadata(normalizedKey, options.metadata);
    }

    const stats = await fs.stat(fullPath);
    const etag = `${stats.size}-${stats.mtime.getTime()}`;

    return { key: normalizedKey, etag };
  }

  async download(key: string, options?: DownloadOptions): Promise<Buffer> {
    const fullPath = this.getFullPath(key);

    if (options?.range) {
      // Handle range requests for partial content
      const { start, end } = options.range;
      const stats = await fs.stat(fullPath);
      const endPos = end ?? stats.size - 1;
      const buffer = Buffer.alloc(endPos - start + 1);
      const handle = await fs.open(fullPath, "r");
      await handle.read(buffer, 0, endPos - start + 1, start);
      await handle.close();
      return buffer;
    }

    return fs.readFile(fullPath);
  }

  async downloadStream(key: string, options?: DownloadOptions): Promise<NodeJS.ReadableStream> {
    const fullPath = this.getFullPath(key);
    const { createReadStream } = await import("node:fs");

    if (options?.range) {
      const { start, end } = options.range;
      return createReadStream(fullPath, { start, end });
    }

    return createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    await fs.unlink(fullPath);
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.getFullPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const prefix = options?.prefix ?? "";
    const searchPath = this.getFullPath(prefix);

    // Use a recursive function to walk the directory structure
    // This is more reliable than fs.readdir with recursive: true on Windows
    async function walkDirectory(dirPath: string, baseDir: string): Promise<string[]> {
      const files: string[] = [];
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          // Recursively walk subdirectories
          const subFiles = await walkDirectory(fullPath, baseDir);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }

      return files;
    }

    const filePaths = await walkDirectory(searchPath, searchPath);
    const items = [];

    for (const filePath of filePaths) {
      const relativePath = path.relative(this.basePath, filePath);
      const stats = await fs.stat(filePath);

      items.push({
        key: relativePath.replace(/\\/g, "/"), // Normalize path separators for Windows
        size: stats.size,
        lastModified: stats.mtime,
        etag: `${stats.size}-${stats.mtime.getTime()}`,
      });
    }

    return {
      items,
      isTruncated: false,
    };
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    const fullPath = this.getFullPath(key);
    const stats = await fs.stat(fullPath);

    // Check if there's a contentType in stored metadata
    let contentType = "application/octet-stream";
    try {
      const metadataPath = this.getFullPath(`${key}.metadata`);
      const metadataContent = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent) as Record<string, unknown>;
      if (typeof metadata.contentType === "string") {
        contentType = metadata.contentType;
      }
    } catch {
      // No metadata file, use default
    }

    return {
      size: stats.size,
      lastModified: stats.mtime,
      contentType,
    };
  }

  async setMetadata(key: string, metadata: Record<string, string>): Promise<void> {
    // Local storage doesn't support custom metadata natively
    // Store in a sidecar file instead
    const metadataPath = this.getFullPath(`${key}.metadata`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async getSignedUrl(
    key: string,
    options?: { expiresIn?: number; operation?: "get" | "put" }
  ): Promise<string> {
    // Local storage doesn't support signed URLs with expiration
    // Return a file:// URL - in production, this would be behind an HTTP server
    // Note: options.expiresIn is not supported for local file URLs
    // The operation is included as a query parameter for documentation
    const fullPath = this.getFullPath(key);
    const operation = options?.operation ?? "get";
    return Promise.resolve(`file://${fullPath}?operation=${operation}`);
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    const sourcePath = this.getFullPath(sourceKey);
    const destPath = this.getFullPath(destinationKey);
    const destDir = path.dirname(destPath);

    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(sourcePath, destPath);
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
  }
}
