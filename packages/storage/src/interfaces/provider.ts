/**
 * Storage provider interface
 * Allows pluggable storage backends (local, S3, Garage, GCS, Azure, etc.)
 */

export interface StorageMetadata {
  size: number;
  contentType?: string;
  lastModified: Date;
  etag?: string;
  custom?: Record<string, string>;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: "private" | "public-read" | "public-read-write";
}

export interface DownloadOptions {
  range?: {
    start: number;
    end?: number;
  };
}

export interface ListOptions {
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListResult {
  items: Array<{
    key: string;
    size: number;
    lastModified: Date;
    etag?: string;
  }>;
  prefixes?: string[];
  continuationToken?: string;
  isTruncated: boolean;
}

export interface IStorageProvider {
  /**
   * Upload a file from buffer
   */
  upload(
    key: string,
    data: Buffer | string,
    options?: UploadOptions
  ): Promise<{ key: string; etag?: string }>;

  uploadStream(
    key: string,
    stream: NodeJS.ReadableStream,
    options?: UploadOptions
  ): Promise<{ key: string; etag?: string }>;

  /**
   * Download a file to buffer
   */
  download(key: string, options?: DownloadOptions): Promise<Buffer>;

  downloadStream(key: string, options?: DownloadOptions): Promise<NodeJS.ReadableStream>;

  delete(key: string): Promise<void>;

  deleteMany(keys: string[]): Promise<void>;

  exists(key: string): Promise<boolean>;

  list(options?: ListOptions): Promise<ListResult>;

  getMetadata(key: string): Promise<StorageMetadata>;

  setMetadata(key: string, metadata: Record<string, string>): Promise<void>;

  getSignedUrl(
    key: string,
    options?: {
      /**
       * Expiry time in seconds
       */
      expiresIn?: number;
      operation?: "get" | "put";
    }
  ): Promise<string>;

  copy(sourceKey: string, destinationKey: string): Promise<void>;

  move(sourceKey: string, destinationKey: string): Promise<void>;
}

export interface IStorageProviderFactory {
  create(config: StorageProviderConfig): IStorageProvider;
}

export type StorageProviderType = "local" | "s3" | "garage" | "gcs" | "azure";

export interface StorageProviderConfig {
  type: StorageProviderType;
  local?: {
    basePath: string;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
  };
  garage?: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
  gcs?: {
    projectId: string;
    bucket: string;
    keyFilename?: string;
  };
  azure?: {
    accountName: string;
    accountKey: string;
    containerName: string;
  };
}
