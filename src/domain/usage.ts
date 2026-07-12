export const PROVIDER = { CODEX: "codex" } as const;
export type Provider = (typeof PROVIDER)[keyof typeof PROVIDER];
export const PROVIDER_ORDER = [PROVIDER.CODEX] as const;
export const USAGE_STATUS = { AVAILABLE: "available", LOADING: "loading", UNAVAILABLE: "unavailable" } as const;
export type UsageStatus = (typeof USAGE_STATUS)[keyof typeof USAGE_STATUS];
export interface UsageSnapshot { readonly provider: Provider; readonly status: UsageStatus; readonly percentage?: number; readonly reset?: string; readonly retryAfterMs?: number; readonly refreshedAt: number; }
export interface LoadingUsage { readonly status: (typeof USAGE_STATUS)["LOADING"]; }
export type UsageDisplay = UsageSnapshot | LoadingUsage;
export function orderUsageSnapshots(snapshots: readonly UsageSnapshot[]): UsageSnapshot[] { return snapshots.map((snapshot, index) => ({ snapshot, index })).sort((a, b) => PROVIDER_ORDER.indexOf(a.snapshot.provider) - PROVIDER_ORDER.indexOf(b.snapshot.provider) || a.index - b.index).map(({ snapshot }) => snapshot); }
