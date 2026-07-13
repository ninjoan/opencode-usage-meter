import type { ProviderUsageWindow } from "../../domain/usage.js";
import { sanitizeTerminalText } from "../terminal.js";

export interface CodexStatusFields {
  readonly windows: readonly ProviderUsageWindow[];
}

const PERCENT = /(-?\d+(?:\.\d+)?)%/;
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
  const token = line.match(PERCENT)?.[1];
  const label = labelForLine(line);
  if (token === undefined || label === undefined) return undefined;
  const percent = Number(token);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return undefined;
  const reset = resetForLine(line, fallbackReset);
  return reset === undefined
    ? { label, percentRemaining: percent }
    : { label, percentRemaining: percent, reset };
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
