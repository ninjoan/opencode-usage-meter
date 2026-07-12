import type { Provider, UsageSnapshot } from "../domain/usage.js";
export interface UsageCache { clear(provider: Provider): void; get(provider: Provider): UsageSnapshot | undefined; set(snapshot: UsageSnapshot): void; }
export function createUsageCache(): UsageCache { const values = new Map<Provider, UsageSnapshot>(); return { clear: (provider) => values.delete(provider), get: (provider) => values.get(provider), set: (snapshot) => values.set(snapshot.provider, snapshot) }; }
