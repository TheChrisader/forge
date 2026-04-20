import type { BackupStrategy, BackupParams, RestoreParams, BackupResult } from "./types.js";

export class PostgreSQLBackupStrategy implements BackupStrategy {
  readonly supported = true;

  async runBackup(params: BackupParams): Promise<BackupResult> {
    const { runtime, containerId, service } = params;
    const username = service.connectionUsername ?? "postgres";
    const database = service.connectionDatabase ?? "postgres";

    const { stdout, wait } = await runtime.execStream(
      containerId,
      ["pg_dump", "-U", username, "-d", database, "--format=custom"],
      { attachStdout: true, attachStderr: true }
    );

    // Fire-and-forget: if exit code is non-zero, the handler will see the
    // stream end and can check. For now we reject on bad exit.
    void wait.then(({ exitCode }) => {
      if (exitCode !== 0) {
        stdout.destroy(new Error(`pg_dump exited with code ${exitCode}`));
      }
    });

    return {
      stream: stdout,
      extension: "dump",
      metadata: { database, format: "custom" },
    };
  }

  async runRestore(params: RestoreParams): Promise<void> {
    const { runtime, containerId, service } = params;
    const username = service.connectionUsername ?? "postgres";
    const database = service.connectionDatabase ?? "postgres";

    const base64Data = params.backupData.toString("base64");

    const writeResult = await runtime.exec(
      containerId,
      ["sh", "-c", `echo "${base64Data}" | base64 -d > /tmp/forge-restore.dump`],
      { attachStdout: true, attachStderr: true }
    );

    if (writeResult.exitCode !== 0) {
      throw new Error(
        `Failed to write backup data to container (exit ${writeResult.exitCode}): ${writeResult.error ?? writeResult.output}`
      );
    }

    const restoreResult = await runtime.exec(
      containerId,
      [
        "pg_restore",
        "-U",
        username,
        "-d",
        database,
        "--clean",
        "--if-exists",
        "/tmp/forge-restore.dump",
      ],
      { attachStdout: true, attachStderr: true }
    );

    await runtime.exec(containerId, ["rm", "-f", "/tmp/forge-restore.dump"]).catch(() => {});

    if (restoreResult.exitCode !== 0) {
      throw new Error(
        `pg_restore failed (exit ${restoreResult.exitCode}): ${restoreResult.error ?? restoreResult.output}`
      );
    }
  }
}
