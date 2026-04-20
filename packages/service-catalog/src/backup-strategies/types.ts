import type { IContainerRuntime } from "@forge/docker";

export interface BackupResult {
  /** Raw binary backup data stream from the container */
  stream: NodeJS.ReadableStream;
  /** File extension for the backup (e.g., "sql", "archive", "rdb") */
  extension: string;
  /** Engine-specific metadata (collection name, database, etc.) */
  metadata?: Record<string, unknown>;
}

export interface BackupStrategy {
  /** Whether this engine supports backup at all */
  readonly supported: boolean;

  /**
   * Execute the backup inside the container and return the raw backup data.
   * Implementation MUST use docker exec and return the backup output as a Buffer.
   */
  runBackup(params: BackupParams): Promise<BackupResult>;

  /**
   * Restore data from a backup into the running container.
   * Implementation MUST pipe backup data into the restore command via docker exec.
   */
  runRestore(params: RestoreParams): Promise<void>;
}

export interface BackupParams {
  runtime: IContainerRuntime;
  containerId: string;
  service: {
    id: string;
    engine: string;
    connectionUsername: string | null;
    connectionPassword: string | null;
    connectionDatabase: string | null;
    connectionPort: number | null;
  };
  backupId: string;
}

export interface RestoreParams extends BackupParams {
  backupData: Buffer;
  backupMetadata?: Record<string, unknown>;
}
