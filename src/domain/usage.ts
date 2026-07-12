export const PROVIDER = { CODEX: "codex", CLAUDE: "claude" } as const;
export type Provider = (typeof PROVIDER)[keyof typeof PROVIDER];
export const PROVIDER_LABEL = { [PROVIDER.CODEX]: "Codex", [PROVIDER.CLAUDE]: "Claude" } as const satisfies Record<Provider, string>;
export const PROVIDER_ORDER = [PROVIDER.CODEX, PROVIDER.CLAUDE] as const;
export const USAGE_STATUS = { AVAILABLE: "available", LOADING: "loading", UNAVAILABLE: "unavailable" } as const;
export type UsageStatus = (typeof USAGE_STATUS)[keyof typeof USAGE_STATUS];
export interface ProviderUsageWindow { readonly label: string; readonly percentRemaining: number; readonly reset?: string; }
export interface UsageSnapshot { readonly provider: Provider; readonly label: string; readonly status: UsageStatus; readonly windows: readonly ProviderUsageWindow[]; readonly providerStatus?: string; readonly retryAfterMs?: number; readonly refreshedAt: number; }
export interface LoadingUsage { readonly status: (typeof USAGE_STATUS)["LOADING"]; }
export type UsageDisplay = UsageSnapshot | LoadingUsage;
export interface ProviderAdapter { readonly provider: Provider; readonly label: string; readonly order: number; refresh(signal: AbortSignal): Promise<UsageSnapshot>; }
export interface ProviderRegistry { readonly adapters: readonly ProviderAdapter[]; }
export function providerOrder(provider: Provider): number { const index = PROVIDER_ORDER.indexOf(provider); return index === -1 ? PROVIDER_ORDER.length : index; }
export function clampPercentRemaining(percentRemaining: number): number { return Math.min(100, Math.max(0, Math.round(percentRemaining))); }
export function orderUsageSnapshots(snapshots: readonly UsageSnapshot[]): UsageSnapshot[] { return snapshots.map((snapshot, index) => ({ snapshot, index })).sort((a, b) => providerOrder(a.snapshot.provider) - providerOrder(b.snapshot.provider) || a.index - b.index).map(({ snapshot }) => snapshot); }
export function unavailableSnapshot(provider: Provider, refreshedAt: number, retryAfterMs?: number): UsageSnapshot { const base = { provider, label: PROVIDER_LABEL[provider], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt } satisfies UsageSnapshot; return retryAfterMs === undefined ? base : { ...base, retryAfterMs }; }
export function availableSnapshot(provider: Provider, windows: readonly ProviderUsageWindow[], refreshedAt: number, providerStatus?: string): UsageSnapshot { const base = { provider, label: PROVIDER_LABEL[provider], status: USAGE_STATUS.AVAILABLE, windows, refreshedAt } satisfies UsageSnapshot; return providerStatus === undefined ? base : { ...base, providerStatus }; }
