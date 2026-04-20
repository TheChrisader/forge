import type { BackupStrategy, BackupParams, RestoreParams, BackupResult } from "./types.js";

export class MongoDBBackupStrategy implements BackupStrategy {
  readonly supported = true;

  async runBackup(params: BackupParams): Promise<BackupResult> {
    const { runtime, containerId, service } = params;
    const username = service.connectionUsername ?? "root";
    const password = service.connectionPassword ?? "";
    const database = service.connectionDatabase ?? "";

    const args = ["mongodump", "--authenticationDatabase=admin", "-u", username];
    if (password) {
      args.push("-p", password);
    }
    if (database) {
      args.push("-d", database);
    }
    args.push("--archive", "--gzip");

    const { stdout, wait } = await runtime.execStream(containerId, args, {
      attachStdout: true,
      attachStderr: true,
    });

    void wait.then(({ exitCode }) => {
      if (exitCode !== 0) {
        stdout.destroy(new Error(`mongodump exited with code ${exitCode}`));
      }
    });

    return {
      stream: stdout,
      extension: "archive.gz",
      metadata: { database: database || "all", format: "archive-gzip" },
    };
  }

  async runRestore(params: RestoreParams): Promise<void> {
    const { runtime, containerId, service } = params;
    const username = service.connectionUsername ?? "root";
    const password = service.connectionPassword ?? "";
    const database = service.connectionDatabase ?? "";

    const base64Data = params.backupData.toString("base64");

    const writeResult = await runtime.exec(
      containerId,
      ["sh", "-c", `echo "${base64Data}" | base64 -d > /tmp/forge-restore.archive.gz`],
      { attachStdout: true, attachStderr: true }
    );

    if (writeResult.exitCode !== 0) {
      throw new Error(
        `Failed to write backup data to container (exit ${writeResult.exitCode}): ${writeResult.error ?? writeResult.output}`
      );
    }

    const args = ["mongorestore", "--authenticationDatabase=admin", "-u", username];
    if (password) {
      args.push("-p", password);
    }
    if (database) {
      args.push("-d", database);
    }
    args.push("--archive=/tmp/forge-restore.archive.gz", "--gzip", "--drop");

    const restoreResult = await runtime.exec(containerId, args, {
      attachStdout: true,
      attachStderr: true,
    });

    await runtime.exec(containerId, ["rm", "-f", "/tmp/forge-restore.archive.gz"]).catch(() => {});

    if (restoreResult.exitCode !== 0) {
      throw new Error(
        `mongorestore failed (exit ${restoreResult.exitCode}): ${restoreResult.error ?? restoreResult.output}`
      );
    }
  }
}
