/**
 * LocalStorageProvider tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { LocalStorageProvider } from "../providers/local.provider.js";

describe("LocalStorageProvider", () => {
  let provider: LocalStorageProvider;
  let tempDir: string;
  let testFiles: string[] = [];

  beforeEach(() => {
    // Create a unique temp directory for each test
    const uniqueId = Math.random().toString(36).substring(7);
    tempDir = path.join(os.tmpdir(), `forge-storage-test-${uniqueId}`);
    provider = new LocalStorageProvider(tempDir);
    testFiles = [];
  });

  afterEach(async () => {
    // Clean up test files
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore
      }
    }
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("upload", () => {
    it("should upload a buffer and return key with etag", async () => {
      const data = Buffer.from("Hello, World!");
      const result = await provider.upload("test.txt", data);

      expect(result.key).toBe("test.txt");
      expect(result.etag).toBeDefined();
      expect(typeof result.etag).toBe("string");
    });

    it("should upload a string and return key with etag", async () => {
      const data = "Hello, World!";
      const result = await provider.upload("test.txt", data);

      expect(result.key).toBe("test.txt");
      expect(result.etag).toBeDefined();
    });

    it("should upload to nested path creating parent directories", async () => {
      const data = Buffer.from("nested file");
      const result = await provider.upload("level1/level2/test.txt", data);

      expect(result.key).toBe("level1/level2/test.txt");

      // Verify file exists
      const fullPath = path.join(tempDir, "level1/level2/test.txt");
      const exists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("download", () => {
    it("should download previously uploaded file", async () => {
      const originalData = Buffer.from("Hello, World!");
      await provider.upload("test.txt", originalData);

      const downloadedData = await provider.download("test.txt");

      expect(downloadedData).toEqual(originalData);
    });

    it("should handle range requests", async () => {
      const originalData = Buffer.from("Hello, World!");
      await provider.upload("test.txt", originalData);

      const partialData = await provider.download("test.txt", {
        range: { start: 0, end: 4 },
      });

      expect(partialData).toEqual(Buffer.from("Hello"));
    });
  });

  describe("exists", () => {
    it("should return true for existing file", async () => {
      await provider.upload("test.txt", "data");

      const exists = await provider.exists("test.txt");

      expect(exists).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      const exists = await provider.exists("nonexistent.txt");

      expect(exists).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete existing file", async () => {
      await provider.upload("test.txt", "data");
      expect(await provider.exists("test.txt")).toBe(true);

      await provider.delete("test.txt");

      expect(await provider.exists("test.txt")).toBe(false);
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple files", async () => {
      await provider.upload("file1.txt", "data1");
      await provider.upload("file2.txt", "data2");
      await provider.upload("file3.txt", "data3");

      await provider.deleteMany(["file1.txt", "file2.txt"]);

      expect(await provider.exists("file1.txt")).toBe(false);
      expect(await provider.exists("file2.txt")).toBe(false);
      expect(await provider.exists("file3.txt")).toBe(true);
    });
  });

  describe("list", () => {
    it("should return empty list for empty directory", async () => {
      const result = await provider.list();

      expect(result.items).toEqual([]);
      expect(result.isTruncated).toBe(false);
    });

    it("should list all files", async () => {
      await provider.upload("file1.txt", "data1");
      await provider.upload("file2.txt", "data2");
      await provider.upload("subdir/file3.txt", "data3");

      const result = await provider.list();

      expect(result.items).toHaveLength(3);
      expect(result.items.map((i) => i.key)).toContain("file1.txt");
      expect(result.items.map((i) => i.key)).toContain("file2.txt");
      expect(result.items.map((i) => i.key)).toContain("subdir/file3.txt");
    });

    it("should list files with metadata", async () => {
      await provider.upload("test.txt", "data");

      const result = await provider.list();
      const item = result.items.find((i) => i.key === "test.txt");

      expect(item).toBeDefined();
      expect(item?.size).toBe(4);
      expect(item?.lastModified).toBeInstanceOf(Date);
      expect(item?.etag).toBeDefined();
    });

    it("should list files with prefix", async () => {
      await provider.upload("dir1/file1.txt", "data1");
      await provider.upload("dir1/file2.txt", "data2");
      await provider.upload("dir2/file3.txt", "data3");

      const result = await provider.list({ prefix: "dir1/" });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((i) => i.key.startsWith("dir1/"))).toBe(true);
    });
  });

  describe("getMetadata", () => {
    it("should return file metadata", async () => {
      await provider.upload("test.txt", "data");

      const metadata = await provider.getMetadata("test.txt");

      expect(metadata.size).toBe(4);
      expect(metadata.lastModified).toBeInstanceOf(Date);
      expect(metadata.contentType).toBe("application/octet-stream");
    });
  });

  describe("copy", () => {
    it("should copy file to new location", async () => {
      await provider.upload("source.txt", "data");

      await provider.copy("source.txt", "dest.txt");

      expect(await provider.exists("source.txt")).toBe(true);
      expect(await provider.exists("dest.txt")).toBe(true);

      const sourceData = await provider.download("source.txt");
      const destData = await provider.download("dest.txt");
      expect(sourceData).toEqual(destData);
    });
  });

  describe("move", () => {
    it("should move file to new location", async () => {
      await provider.upload("source.txt", "data");

      await provider.move("source.txt", "dest.txt");

      expect(await provider.exists("source.txt")).toBe(false);
      expect(await provider.exists("dest.txt")).toBe(true);

      const data = await provider.download("dest.txt");
      expect(data).toEqual(Buffer.from("data"));
    });
  });

  describe("uploadStream", () => {
    it("should upload from a readable stream", async () => {
      const { Readable } = await import("node:stream");
      const data = "Stream data";
      const stream = Readable.from([data]);

      const result = await provider.uploadStream("stream.txt", stream);

      expect(result.key).toBe("stream.txt");
      expect(result.etag).toBeDefined();

      const downloaded = await provider.download("stream.txt");
      expect(downloaded.toString()).toBe(data);
    });
  });

  describe("path traversal protection", () => {
    it("should prevent path traversal attacks", async () => {
      await expect(provider.upload("../../etc/passwd", "data")).rejects.toThrow(/path traversal/i);
    });

    it("should normalize paths", async () => {
      // This should work because normalization resolves it within basePath
      const result = await provider.upload("./subdir/../test.txt", "data");

      expect(result.key).toBe("test.txt");
    });

    it("should prevent escaped path traversal", async () => {
      await expect(provider.upload("....//....//etc/passwd", "data")).rejects.toThrow(
        /path traversal/i
      );
    });
  });

  describe("setMetadata", () => {
    it("should store metadata in sidecar file", async () => {
      await provider.upload("test.txt", "data");
      await provider.setMetadata("test.txt", { author: "test", version: "1.0" });

      // Check that metadata file exists
      const metadataPath = path.join(tempDir, "test.txt.metadata");
      const exists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(content);
      expect(metadata).toEqual({ author: "test", version: "1.0" });
    });
  });

  describe("getSignedUrl", () => {
    it("should return file:// URL", async () => {
      const url = await provider.getSignedUrl("test.txt");

      expect(url).toMatch(/^file:\/\//);
      expect(url).toContain("test.txt");
    });
  });

  describe("downloadStream", () => {
    it("should return a readable stream", async () => {
      await provider.upload("test.txt", "data");

      const stream = await provider.downloadStream("test.txt");

      expect(stream).toBeDefined();
      // Stream should have pipe method
      expect(typeof stream.pipe).toBe("function");
    });
  });
});
