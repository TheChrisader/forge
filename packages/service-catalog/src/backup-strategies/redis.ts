import type { BackupStrategy, BackupParams, RestoreParams, BackupResult } from "./types.js";

export class RedisBackupStrategy implements BackupStrategy {
  readonly supported = true;

  async runBackup(params: BackupParams): Promise<BackupResult> {
    const { runtime, containerId, service } = params;
    const password = service.connectionPassword ?? "";

    const cliArgs = ["redis-cli"];
    if (password) {
      cliArgs.push("-a", password);
    }

    // Trigger SAVE to ensure dump.rdb exists (must complete before streaming)
    const saveResult = await runtime.exec(containerId, [...cliArgs, "SAVE"], {
      attachStdout: true,
      attachStderr: true,
    });

    if (saveResult.exitCode !== 0) {
      throw new Error(
        `redis-cli SAVE failed (exit ${saveResult.exitCode}): ${saveResult.error ?? saveResult.output}`
      );
    }

    // Stream the RDB file out as binary
    const { stdout, wait } = await runtime.execStream(containerId, ["cat", "/data/dump.rdb"], {
      attachStdout: true,
      attachStderr: true,
    });

    void wait.then(({ exitCode }) => {
      if (exitCode !== 0) {
        stdout.destroy(new Error(`cat dump.rdb exited with code ${exitCode}`));
      }
    });

    return {
      stream: stdout,
      extension: "rdb",
      metadata: { format: "rdb" },
    };
  }

  async runRestore(params: RestoreParams): Promise<void> {
    const { runtime, containerId } = params;

    const base64Data = params.backupData.toString("base64");

    const writeResult = await runtime.exec(
      containerId,
      ["sh", "-c", `echo "${base64Data}" | base64 -d > /data/dump.rdb`],
      { attachStdout: true, attachStderr: true }
    );

    if (writeResult.exitCode !== 0) {
      throw new Error(
        `Failed to write RDB data to container (exit ${writeResult.exitCode}): ${writeResult.error ?? writeResult.output}`
      );
    }

    await runtime.stop(containerId, { timeout: 10 });
    await runtime.start(containerId);
  }
}
