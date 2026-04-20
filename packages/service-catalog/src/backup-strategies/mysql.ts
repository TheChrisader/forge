import type { BackupStrategy, BackupParams, RestoreParams, BackupResult } from "./types.js";

export class MySQLBackupStrategy implements BackupStrategy {
  readonly supported = true;

  async runBackup(params: BackupParams): Promise<BackupResult> {
    const { runtime, containerId, service } = params;
    const password = service.connectionPassword ?? "";
    const database = service.connectionDatabase ?? "";

    const args = ["mysqldump", "-u", "root"];
    if (password) {
      args.push(`-p${password}`);
    }
    args.push("--single-transaction", "--routines", "--triggers");
    if (database) {
      args.push(database);
    }

    const { stdout, wait } = await runtime.execStream(containerId, args, {
      attachStdout: true,
      attachStderr: true,
    });

    void wait.then(({ exitCode }) => {
      if (exitCode !== 0) {
        stdout.destroy(new Error(`mysqldump exited with code ${exitCode}`));
      }
    });

    return {
      stream: stdout,
      extension: "sql",
      metadata: { database: database || "all" },
    };
  }

  async runRestore(params: RestoreParams): Promise<void> {
    const { runtime, containerId, service } = params;
    const password = service.connectionPassword ?? "";
    const database = service.connectionDatabase ?? "";

    if (!database) {
      throw new Error("Cannot restore MySQL backup: no target database specified");
    }

    const base64Data = params.backupData.toString("base64");

    const writeResult = await runtime.exec(
      containerId,
      ["sh", "-c", `echo "${base64Data}" | base64 -d > /tmp/forge-restore.sql`],
      { attachStdout: true, attachStderr: true }
    );

    if (writeResult.exitCode !== 0) {
      throw new Error(
        `Failed to write backup data to container (exit ${writeResult.exitCode}): ${writeResult.error ?? writeResult.output}`
      );
    }

    const args = ["mysql", "-u", "root"];
    if (password) {
      args.push(`-p${password}`);
    }
    args.push(database);

    const restoreResult = await runtime.exec(
      containerId,
      ["sh", "-c", `cat /tmp/forge-restore.sql | ${args.join(" ")}`],
      { attachStdout: true, attachStderr: true }
    );

    await runtime.exec(containerId, ["rm", "-f", "/tmp/forge-restore.sql"]).catch(() => {});

    if (restoreResult.exitCode !== 0) {
      throw new Error(
        `mysql restore failed (exit ${restoreResult.exitCode}): ${restoreResult.error ?? restoreResult.output}`
      );
    }
  }
}
