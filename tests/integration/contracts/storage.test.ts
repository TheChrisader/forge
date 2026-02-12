import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { IStorageProvider } from "@forge/storage";

/**
 * Contract tests for IStorageProvider
 *
 * Any implementation of IStorageProvider must pass these tests.
 * Use this function to test your storage provider implementation.
 *
 * @example
 * ```typescript
 * import { testStorageProviderContract } from "./contracts/storage.test";
 * import { LocalStorageProvider } from "./providers/local";
 *
 * describe("LocalStorageProvider", () => {
 *   testStorageProviderContract(async () => {
 *     return new LocalStorageProvider({ basePath: "/tmp/test" });
 *   });
 * });
 * ```
 */
export function testStorageProviderContract(
  createProvider: () => Promise<IStorageProvider> | IStorageProvider,
  options?: {
    /** not all providers support signed urls */
    skipSignedUrls?: boolean;
  }
): void {
  describe("IStorageProvider Contract", () => {
    let provider: IStorageProvider;

    beforeAll(async () => {
      provider = await createProvider();
    });

    afterAll(async () => {
      try {
        const result = await provider.list({ prefix: "test-contract-" });
        if (result.items.length > 0) {
          await provider.deleteMany(result.items.map((item) => item.key));
        }
      } catch {
        // TODO: Log Exception
      }
    });

    describe("Upload and Download", () => {
      it("should upload and download a file", async () => {
        const key = "test-contract-upload-download.txt";
        const content = Buffer.from("Hello, World!");

        await provider.upload(key, content);

        const downloaded = await provider.download(key);

        expect(downloaded.toString()).toBe(content.toString());

        await provider.delete(key);
      });

      it("should upload string content", async () => {
        const key = "test-contract-string.txt";
        const content = "String content test";

        await provider.upload(key, content);

        const downloaded = await provider.download(key);

        expect(downloaded.toString()).toBe(content);

        await provider.delete(key);
      });

      it("should upload with content type", async () => {
        const key = "test-contract-content-type.json";
        const content = Buffer.from('{"test": true}');

        await provider.upload(key, content, {
          contentType: "application/json",
        });

        const metadata = await provider.getMetadata(key);

        expect(metadata.contentType).toBe("application/json");

        await provider.delete(key);
      });

      it("should upload with custom metadata", async () => {
        const key = "test-contract-custom-meta.txt";
        const content = Buffer.from("test");

        await provider.upload(key, content, {
          metadata: { "custom-key": "custom-value" },
        });

        const metadata = await provider.getMetadata(key);

        expect(metadata.custom).toBeDefined();
        expect(metadata.custom?.["custom-key"]).toBe("custom-value");

        await provider.delete(key);
      });
    });

    describe("Existence Check", () => {
      it("should return false for non-existent file", async () => {
        const exists = await provider.exists("test-contract-nonexistent.txt");

        expect(exists).toBe(false);
      });

      it("should return true for existing file", async () => {
        const key = "test-contract-exists.txt";

        await provider.upload(key, Buffer.from("test"));

        const exists = await provider.exists(key);

        expect(exists).toBe(true);

        await provider.delete(key);
      });
    });

    describe("Delete Operations", () => {
      it("should delete a single file", async () => {
        const key = "test-contract-delete.txt";

        await provider.upload(key, Buffer.from("test"));

        await provider.delete(key);

        const exists = await provider.exists(key);
        expect(exists).toBe(false);
      });

      it("should delete multiple files", async () => {
        const keys = [
          "test-contract-delete-many-1.txt",
          "test-contract-delete-many-2.txt",
          "test-contract-delete-many-3.txt",
        ];

        for (const key of keys) {
          await provider.upload(key, Buffer.from("test"));
        }

        await provider.deleteMany(keys);

        for (const key of keys) {
          const exists = await provider.exists(key);
          expect(exists).toBe(false);
        }
      });
    });

    describe("List Operations", () => {
      it("should list files with prefix", async () => {
        const prefix = "test-contract-list/";
        const keys = [`${prefix}file1.txt`, `${prefix}file2.txt`, `${prefix}file3.txt`];

        for (const key of keys) {
          await provider.upload(key, Buffer.from("test"));
        }

        const result = await provider.list({ prefix });

        expect(result.items.length).toBeGreaterThanOrEqual(3);
        expect(result.items.every((item) => item.key.startsWith(prefix))).toBe(true);

        await provider.deleteMany(keys);
      });

      it("should support pagination with maxKeys", async () => {
        const prefix = "test-contract-pagination/";
        const keys = Array.from({ length: 5 }, (_, i) => `${prefix}file${i}.txt`);

        for (const key of keys) {
          await provider.upload(key, Buffer.from("test"));
        }

        const result = await provider.list({ prefix, maxKeys: 2 });

        expect(result.items.length).toBeLessThanOrEqual(2);

        await provider.deleteMany(keys);
      });
    });

    describe("Metadata Operations", () => {
      it("should get file metadata", async () => {
        const key = "test-contract-metadata.txt";
        const content = Buffer.from("metadata test");

        await provider.upload(key, content);

        const metadata = await provider.getMetadata(key);

        expect(metadata.size).toBe(content.length);
        expect(metadata.lastModified).toBeInstanceOf(Date);

        await provider.delete(key);
      });

      it("should set custom metadata", async () => {
        const key = "test-contract-set-meta.txt";

        await provider.upload(key, Buffer.from("test"));

        await provider.setMetadata(key, { "new-key": "new-value" });

        const metadata = await provider.getMetadata(key);

        expect(metadata.custom).toBeDefined();
        expect(metadata.custom?.["new-key"]).toBe("new-value");

        await provider.delete(key);
      });
    });

    describe("Copy and Move Operations", () => {
      it("should copy a file", async () => {
        const sourceKey = "test-contract-copy-source.txt";
        const destKey = "test-contract-copy-dest.txt";
        const content = Buffer.from("copy test");

        await provider.upload(sourceKey, content);

        await provider.copy(sourceKey, destKey);

        const exists = await provider.exists(destKey);
        expect(exists).toBe(true);

        const downloaded = await provider.download(destKey);
        expect(downloaded.toString()).toBe(content.toString());

        await provider.deleteMany([sourceKey, destKey]);
      });

      it("should move a file", async () => {
        const sourceKey = "test-contract-move-source.txt";
        const destKey = "test-contract-move-dest.txt";
        const content = Buffer.from("move test");

        await provider.upload(sourceKey, content);

        await provider.move(sourceKey, destKey);

        const sourceExists = await provider.exists(sourceKey);
        expect(sourceExists).toBe(false);

        const destExists = await provider.exists(destKey);
        expect(destExists).toBe(true);

        const downloaded = await provider.download(destKey);
        expect(downloaded.toString()).toBe(content.toString());

        await provider.delete(destKey);
      });
    });

    if (!options?.skipSignedUrls) {
      describe("Signed URLs", () => {
        it("should generate a signed URL for download", async () => {
          const key = "test-contract-signed-url.txt";

          await provider.upload(key, Buffer.from("test"));

          const url = await provider.getSignedUrl(key, {
            expiresIn: 3600,
            operation: "get",
          });

          expect(url).toBeDefined();
          expect(typeof url).toBe("string");
          expect(url.length).toBeGreaterThan(0);

          await provider.delete(key);
        });

        it("should generate a signed URL for upload", async () => {
          const key = "test-contract-signed-upload.txt";

          const url = await provider.getSignedUrl(key, {
            expiresIn: 3600,
            operation: "put",
          });

          expect(url).toBeDefined();
          expect(typeof url).toBe("string");
          expect(url.length).toBeGreaterThan(0);
        });
      });
    }
  });
}

/**
 * Example contract test runner
 * Shows how to use the contract tests with a mock provider
 */
describe("Storage Provider Contract (Example)", () => {
  // This is an example of how to use the contract tests
  // In real usage, replace with your actual storage provider

  it("example usage placeholder", () => {
    // testStorageProviderContract(async () => {
    //   return new LocalStorageProvider({ basePath: "/tmp/test" });
    // });
    expect(true).toBe(true);
  });
});
