export interface CodexStatusFields { readonly percentage: number; readonly reset?: string; }
const PERCENTAGE = /usage:\s*(100|[1-9]?\d)%/i; const RESET = /resets?\s+([^\n]*)/i;
const TERMINAL_CONTROL = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)|\u001b\[[0-?]*[ -/]*[@-~]|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
export function parseCodexStatus(output: string): CodexStatusFields | undefined { const sanitized = output.replace(TERMINAL_CONTROL, ""); const percentage = sanitized.match(PERCENTAGE)?.[1]; if (percentage === undefined) return undefined; const reset = sanitized.match(RESET)?.[1]?.replace(/^in(?:\s+|$)/i, "").trim(); return reset === undefined || reset === "" ? { percentage: Number(percentage) } : { percentage: Number(percentage), reset }; }
