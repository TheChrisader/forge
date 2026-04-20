import type { BackupStrategy, BackupParams, RestoreParams, BackupResult } from "./types.js";

export class MeilisearchBackupStrategy implements BackupStrategy {
  readonly supported = true;

  async runBackup(params: BackupParams): Promise<BackupResult> {
    const { runtime, containerId } = params;

    const { stdout, wait } = await runtime.execStream(
      containerId,
      ["tar", "czf", "-", "-C", "/meili_data", "."],
      { attachStdout: true, attachStderr: true }
    );

    void wait.then(({ exitCode }) => {
      if (exitCode !== 0) {
        stdout.destroy(new Error(`tar exited with code ${exitCode}`));
      }
    });

    return {
      stream: stdout,
      extension: "tar.gz",
      metadata: { format: "tar-gzip", dataPath: "/meili_data" },
    };
  }

  async runRestore(params: RestoreParams): Promise<void> {
    const { runtime, containerId } = params;

    const base64Data = params.backupData.toString("base64");

    const writeResult = await runtime.exec(
      containerId,
      ["sh", "-c", `echo "${base64Data}" | base64 -d > /tmp/forge-restore.tar.gz`],
      { attachStdout: true, attachStderr: true }
    );

    if (writeResult.exitCode !== 0) {
      throw new Error(
        `Failed to write backup data to container (exit ${writeResult.exitCode}): ${writeResult.error ?? writeResult.output}`
      );
    }

    const restoreResult = await runtime.exec(
      containerId,
      ["tar", "xzf", "/tmp/forge-restore.tar.gz", "-C", "/meili_data"],
      { attachStdout: true, attachStderr: true }
    );

    await runtime.exec(containerId, ["rm", "-f", "/tmp/forge-restore.tar.gz"]).catch(() => {});

    if (restoreResult.exitCode !== 0) {
      throw new Error(
        `tar restore failed (exit ${restoreResult.exitCode}): ${restoreResult.error ?? restoreResult.output}`
      );
    }
  }
}
