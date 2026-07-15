import type { Provider } from "../domain/usage.js";

export const DIAGNOSTIC_STAGE = { PARSE: "parse", PROBE: "probe", PTY: "pty", RETRY: "retry" } as const;
export const ERROR_CATEGORY = { EXHAUSTED: "exhausted", FAILED: "failed", MALFORMED: "malformed", TIMEOUT: "timeout" } as const;
export type DiagnosticStage = (typeof DIAGNOSTIC_STAGE)[keyof typeof DIAGNOSTIC_STAGE];
export type ErrorCategory = (typeof ERROR_CATEGORY)[keyof typeof ERROR_CATEGORY];
export interface RefreshDiagnostic { readonly provider: Provider; readonly stage: DiagnosticStage; readonly durationMs: number; readonly category: ErrorCategory; }
export type DiagnosticSink = (diagnostic: RefreshDiagnostic) => void;
export const defaultDiagnosticSink: DiagnosticSink = (diagnostic) => console.error(JSON.stringify({ event: "usage_meter_refresh_failure", ...diagnostic }));
export function emitDiagnostic(sink: DiagnosticSink, diagnostic: RefreshDiagnostic): void {
  try { sink(diagnostic); } catch {}
}
