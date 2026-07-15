import { PROVIDER, availableSnapshot, unavailableSnapshot, type UsageSnapshot } from "../domain/usage.js";
import { parseCodexStatus } from "../parsers/codex/v1.js";
import { PROCESS_STATUS, type SafeProcessTransport } from "../transport/process.js";
import { defaultDiagnosticSink, DIAGNOSTIC_STAGE, ERROR_CATEGORY, emitDiagnostic, type DiagnosticSink } from "../diagnostics/refresh.js";

export interface CodexProvider {
  refresh(signal?: AbortSignal): Promise<UsageSnapshot>;
}

export function createCodexProvider(
  transport: SafeProcessTransport,
  now: () => number,
  platform: NodeJS.Platform = process.platform,
  diagnostic: DiagnosticSink = defaultDiagnosticSink
): CodexProvider {
  return {
    async refresh(signal) {
      const refreshedAt = now();
      if (platform === "win32") return unavailableSnapshot(PROVIDER.CODEX, refreshedAt);
      const request = { executable: "codex", args: ["/status"], timeoutMs: 10_000 } as const;
      const result = await transport.run(signal === undefined ? request : { ...request, signal });
      const parsed = result.status === PROCESS_STATUS.SUCCESS ? parseCodexStatus(result.output) : undefined;
      if (parsed === undefined) emitDiagnostic(diagnostic, { provider: PROVIDER.CODEX, stage: result.status === PROCESS_STATUS.SUCCESS ? DIAGNOSTIC_STAGE.PARSE : DIAGNOSTIC_STAGE.PROBE, durationMs: Math.max(0, now() - refreshedAt), category: result.status === PROCESS_STATUS.TIMED_OUT ? ERROR_CATEGORY.TIMEOUT : result.status === PROCESS_STATUS.SUCCESS ? ERROR_CATEGORY.MALFORMED : ERROR_CATEGORY.FAILED });
      return parsed === undefined
        ? unavailableSnapshot(PROVIDER.CODEX, refreshedAt)
        : availableSnapshot(PROVIDER.CODEX, parsed.windows, refreshedAt);
    }
  };
}
