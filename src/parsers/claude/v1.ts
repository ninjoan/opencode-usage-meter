import type { ProviderUsageWindow } from "../../domain/usage.js";
import { sanitizeTerminalText } from "../terminal.js";

export interface ClaudeUsageFields {
  readonly windows: readonly ProviderUsageWindow[];
}

const PERCENT_REMAINING = /(\S+)%\s*remaining\b/i;
const RESET = /resets?(?:\s+in)?\s+([^·\n]+)/i;

function labelForClaudeLine(line: string): string | undefined {
  if (/weekly/i.test(line)) return "Weekly";
  if (/session|5h/i.test(line)) return "Session 5h";
  const model = line.match(/^\s*model\s+([^:]+):/i)?.[1]?.trim();
  return model === undefined || model === "" ? undefined : `Model ${model}`;
}

function parseWindow(line: string): ProviderUsageWindow | undefined {
  const label = labelForClaudeLine(line);
  const percentToken = line.match(PERCENT_REMAINING)?.[1];
  if (label === undefined || percentToken === undefined || !/^\d+$/.test(percentToken)) return undefined;
  const percent = Number(percentToken);
  if (percent < 0 || percent > 100) return undefined;
  const reset = line.match(RESET)?.[1]?.trim();
  return reset === undefined || reset === ""
    ? { label, percentRemaining: percent }
    : { label, percentRemaining: percent, reset };
}

export async function parseClaudeUsage(output: string): Promise<ClaudeUsageFields | undefined> {
  const windows = sanitizeTerminalText(output)
    .split(/\r?\n/)
    .map(parseWindow)
    .filter((window): window is ProviderUsageWindow => window !== undefined);

  return windows.length === 0 ? undefined : { windows };
}
