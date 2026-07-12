import type { ProviderUsageWindow } from "../../domain/usage.js";
import { sanitizeTerminalText } from "../terminal.js";

export interface CodexStatusFields {
  readonly windows: readonly ProviderUsageWindow[];
}

const PERCENT = /(100|[1-9]?\d)%/;
const RESET = /resets?(?:\s+in)?\s+([^·\n]+)/i;

function labelForLine(line: string): string | undefined {
  if (/weekly/i.test(line)) return "Weekly";
  if (/5h|5-hour|usage/i.test(line)) return "5h";
  return undefined;
}

function resetForLine(line: string, fallback?: string): string | undefined {
  const reset = line.match(RESET)?.[1]?.trim() ?? fallback;
  return reset === undefined || reset === "" || /^in$/i.test(reset) ? undefined : reset;
}

function windowFromLine(line: string, fallbackReset?: string): ProviderUsageWindow | undefined {
  const percent = line.match(PERCENT)?.[1];
  const label = labelForLine(line);
  if (percent === undefined || label === undefined) return undefined;
  const reset = resetForLine(line, fallbackReset);
  return reset === undefined
    ? { label, percentRemaining: Number(percent) }
    : { label, percentRemaining: Number(percent), reset };
}

export function parseCodexStatus(output: string): CodexStatusFields | undefined {
  const sanitized = sanitizeTerminalText(output);
  const rawFallbackReset = sanitized.match(RESET)?.[1]?.trim();
  const fallbackReset = rawFallbackReset === undefined || /^in$/i.test(rawFallbackReset) ? undefined : rawFallbackReset;
  const windows = sanitized
    .split(/\r?\n/)
    .map((line) => windowFromLine(line, fallbackReset))
    .filter((window): window is ProviderUsageWindow => window !== undefined)
    .filter((window, index, all) => all.findIndex((candidate) => candidate.label === window.label) === index);

  return windows.length === 0 ? undefined : { windows };
}
