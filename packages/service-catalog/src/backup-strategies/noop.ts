import type { BackupStrategy, BackupParams, RestoreParams, BackupResult } from "./types.js";

export class NoOpBackupStrategy implements BackupStrategy {
  readonly supported = false;
  private readonly engineName: string;

  constructor(engineName: string) {
    this.engineName = engineName;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async runBackup(_params: BackupParams): Promise<BackupResult> {
    throw new Error(`Engine "${this.engineName}" does not support backup (no persistent data)`);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async runRestore(_params: RestoreParams): Promise<void> {
    throw new Error(`Engine "${this.engineName}" does not support restore (no persistent data)`);
  }
}
