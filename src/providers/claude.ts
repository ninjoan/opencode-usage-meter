import { PROVIDER, availableSnapshot, unavailableSnapshot, type UsageSnapshot } from "../domain/usage.js";
import { parseClaudeUsage } from "../parsers/claude/v1.js";
import { createPtyProcessTransport, PROCESS_STATUS, type ProcessResult, type SafeProcessTransport } from "../transport/process.js";
import { defaultDiagnosticSink, DIAGNOSTIC_STAGE, ERROR_CATEGORY, emitDiagnostic, type DiagnosticSink } from "../diagnostics/refresh.js";

export interface ClaudeProvider {
  refresh(signal?: AbortSignal): Promise<UsageSnapshot>;
}

function needsPty(result: ProcessResult, parsed: Awaited<ReturnType<typeof parseClaudeUsage>>): boolean {
  if (result.status !== PROCESS_STATUS.SUCCESS && result.status !== PROCESS_STATUS.FAILED) return false;
  return result.requiresTerminal === true || /(?:tty|terminal|interactive)/i.test(result.output) || (result.status === PROCESS_STATUS.SUCCESS && parsed === undefined);
}

export function createClaudeProvider(
  transport: SafeProcessTransport,
  now: () => number,
  platform: NodeJS.Platform = process.platform,
  pty: SafeProcessTransport = createPtyProcessTransport({ platform }),
  diagnostic: DiagnosticSink = defaultDiagnosticSink
): ClaudeProvider {
  return {
    async refresh(signal) {
      const refreshedAt = now();
      if (platform === "win32") return unavailableSnapshot(PROVIDER.CLAUDE, refreshedAt);
      const request = { executable: "claude", args: ["/usage"], timeoutMs: 10_000 } as const;
      const result = await transport.run(signal === undefined ? request : { ...request, signal });
      let parsed = result.status === PROCESS_STATUS.SUCCESS ? await parseClaudeUsage(result.output) : undefined;
      if (needsPty(result, parsed)) {
        emitDiagnostic(diagnostic, { provider: PROVIDER.CLAUDE, stage: DIAGNOSTIC_STAGE.RETRY, durationMs: Math.max(0, now() - refreshedAt), category: result.status === PROCESS_STATUS.SUCCESS ? ERROR_CATEGORY.MALFORMED : ERROR_CATEGORY.FAILED });
        const fallback = await pty.run(signal === undefined ? request : { ...request, signal });
        parsed = fallback.status === PROCESS_STATUS.SUCCESS ? await parseClaudeUsage(fallback.output) : undefined;
        if (parsed === undefined) emitDiagnostic(diagnostic, { provider: PROVIDER.CLAUDE, stage: DIAGNOSTIC_STAGE.PTY, durationMs: Math.max(0, now() - refreshedAt), category: fallback.status === PROCESS_STATUS.TIMED_OUT ? ERROR_CATEGORY.TIMEOUT : fallback.status === PROCESS_STATUS.SUCCESS ? ERROR_CATEGORY.MALFORMED : ERROR_CATEGORY.EXHAUSTED });
      }
      else if (parsed === undefined) emitDiagnostic(diagnostic, { provider: PROVIDER.CLAUDE, stage: result.status === PROCESS_STATUS.SUCCESS ? DIAGNOSTIC_STAGE.PARSE : DIAGNOSTIC_STAGE.PROBE, durationMs: Math.max(0, now() - refreshedAt), category: result.status === PROCESS_STATUS.TIMED_OUT ? ERROR_CATEGORY.TIMEOUT : result.status === PROCESS_STATUS.SUCCESS ? ERROR_CATEGORY.MALFORMED : ERROR_CATEGORY.FAILED });
      return parsed === undefined
        ? unavailableSnapshot(PROVIDER.CLAUDE, refreshedAt)
        : availableSnapshot(PROVIDER.CLAUDE, parsed.windows, refreshedAt);
    }
  };
}
