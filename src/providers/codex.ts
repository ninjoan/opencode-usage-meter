import { PROVIDER, availableSnapshot, unavailableSnapshot, type UsageSnapshot } from "../domain/usage.js";
import { parseCodexStatus } from "../parsers/codex/v1.js";
import { PROCESS_STATUS, type SafeProcessTransport } from "../transport/process.js";

export interface CodexProvider {
  refresh(signal?: AbortSignal): Promise<UsageSnapshot>;
}

export function createCodexProvider(
  transport: SafeProcessTransport,
  now: () => number,
  platform: NodeJS.Platform = process.platform
): CodexProvider {
  return {
    async refresh(signal) {
      const refreshedAt = now();
      if (platform === "win32") return unavailableSnapshot(PROVIDER.CODEX, refreshedAt);
      const request = { executable: "codex", args: ["/status"], timeoutMs: 10_000 } as const;
      const result = await transport.run(signal === undefined ? request : { ...request, signal });
      const parsed = result.status === PROCESS_STATUS.SUCCESS ? parseCodexStatus(result.output) : undefined;
      return parsed === undefined
        ? unavailableSnapshot(PROVIDER.CODEX, refreshedAt)
        : availableSnapshot(PROVIDER.CODEX, parsed.windows, refreshedAt);
    }
  };
}
