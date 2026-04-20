import type { BackupStrategy, BackupParams, RestoreParams, BackupResult } from "./types.js";

export class RabbitMQBackupStrategy implements BackupStrategy {
  readonly supported = true;

  async runBackup(params: BackupParams): Promise<BackupResult> {
    const { runtime, containerId } = params;

    // Export definitions first (synchronous operation)
    const exportResult = await runtime.exec(
      containerId,
      ["rabbitmqctl", "export_definitions", "/tmp/rabbitmq-backup.json"],
      { attachStdout: true, attachStderr: true }
    );

    if (exportResult.exitCode !== 0) {
      throw new Error(
        `rabbitmqctl export failed (exit ${exportResult.exitCode}): ${exportResult.error ?? exportResult.output}`
      );
    }

    // Stream the exported file out
    const { stdout, wait } = await runtime.execStream(
      containerId,
      ["cat", "/tmp/rabbitmq-backup.json"],
      {
        attachStdout: true,
        attachStderr: true,
      }
    );

    // Clean up temp file inside container after streaming completes
    void wait.then(async ({ exitCode }) => {
      if (exitCode !== 0) {
        stdout.destroy(new Error(`cat exited with code ${exitCode}`));
      }
      await runtime.exec(containerId, ["rm", "-f", "/tmp/rabbitmq-backup.json"]).catch(() => {});
    });

    return {
      stream: stdout,
      extension: "json",
      metadata: { format: "definitions-only" },
    };
  }

  async runRestore(params: RestoreParams): Promise<void> {
    const { runtime, containerId } = params;

    const base64Data = params.backupData.toString("base64");

    const writeResult = await runtime.exec(
      containerId,
      ["sh", "-c", `echo "${base64Data}" | base64 -d > /tmp/rabbitmq-backup.json`],
      { attachStdout: true, attachStderr: true }
    );

    if (writeResult.exitCode !== 0) {
      throw new Error(
        `Failed to write backup data to container (exit ${writeResult.exitCode}): ${writeResult.error ?? writeResult.output}`
      );
    }

    const importResult = await runtime.exec(
      containerId,
      ["rabbitmqctl", "import_definitions", "/tmp/rabbitmq-backup.json"],
      { attachStdout: true, attachStderr: true }
    );

    await runtime.exec(containerId, ["rm", "-f", "/tmp/rabbitmq-backup.json"]).catch(() => {});

    if (importResult.exitCode !== 0) {
      throw new Error(
        `rabbitmqctl import failed (exit ${importResult.exitCode}): ${importResult.error ?? importResult.output}`
      );
    }
  }
}
