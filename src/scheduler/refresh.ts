import { USAGE_STATUS, unavailableSnapshot, type Provider, type UsageSnapshot } from "../domain/usage.js";
import type { ProviderGates } from "../gates/provider-gates.js";
import type { UsageCache } from "../state/cache.js";
import { defaultDiagnosticSink, DIAGNOSTIC_STAGE, ERROR_CATEGORY, emitDiagnostic, type DiagnosticSink } from "../diagnostics/refresh.js";
export const REFRESH_INTERVAL = { ACTIVE: 5 * 60_000, IDLE: 15 * 60_000, RECENT_INTERACTION: 2 * 60_000, RESOURCE_CONSTRAINED: 30 * 60_000 } as const;
export const ACTIVITY_STATE = { ACTIVE: "active", IDLE: "idle", INACTIVE: "inactive", PROLONGED_INACTIVITY: "prolonged_inactivity", RECENT_INTERACTION: "recent_interaction", RESOURCE_CONSTRAINED: "resource_constrained" } as const;
export type ActivityState = (typeof ACTIVITY_STATE)[keyof typeof ACTIVITY_STATE];
export interface RefreshProvider { readonly provider: Provider; refresh(signal: AbortSignal): Promise<UsageSnapshot>; }
export interface RefreshScheduler { dispose(): void; refreshNow(): Promise<void>; reschedule(activity: ActivityState): void; start(activity: ActivityState): void; stop(): void; }
function interval(activity: ActivityState): number { return activity === ACTIVITY_STATE.RECENT_INTERACTION ? REFRESH_INTERVAL.RECENT_INTERACTION : activity === ACTIVITY_STATE.ACTIVE ? REFRESH_INTERVAL.ACTIVE : activity === ACTIVITY_STATE.INACTIVE || activity === ACTIVITY_STATE.IDLE ? REFRESH_INTERVAL.IDLE : REFRESH_INTERVAL.RESOURCE_CONSTRAINED; }
export function createRefreshScheduler(
  providers: readonly RefreshProvider[],
  cache: UsageCache,
  gates: ProviderGates,
  now: () => number = () => Date.now(),
  onSnapshot?: (snapshot: UsageSnapshot) => void,
  diagnostic: DiagnosticSink = defaultDiagnosticSink
): RefreshScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controllers = new Map<Provider, AbortController>();
  let activity: ActivityState = ACTIVITY_STATE.INACTIVE;
  let running = false;
  let disposed = false;
  const emitSnapshot = (value: UsageSnapshot) => {
    try { onSnapshot?.(value); } catch {}
  };

  const refreshProvider = async (provider: RefreshProvider) => {
    if (disposed || !gates.tryOpen(provider.provider, now())) return;
    const controller = new AbortController();
    controllers.set(provider.provider, controller);
    const startedAt = now();
    try {
      const value = await provider.refresh(controller.signal);
      if (disposed || controllers.get(provider.provider) !== controller) return;
      if (value.status === USAGE_STATUS.AVAILABLE && value.windows.length > 0) {
        cache.set(value);
        gates.reset(provider.provider);
      } else {
        cache.clear(provider.provider);
        gates.recordFailure(provider.provider, now(), value.retryAfterMs);
      }
      emitSnapshot(value);
    } catch {
      if (disposed || controllers.get(provider.provider) !== controller) return;
      emitDiagnostic(diagnostic, { provider: provider.provider, stage: DIAGNOSTIC_STAGE.PROBE, durationMs: Math.max(0, now() - startedAt), category: ERROR_CATEGORY.FAILED });
      cache.clear(provider.provider);
      gates.recordFailure(provider.provider, now());
      emitSnapshot(unavailableSnapshot(provider.provider, now()));
    } finally {
      if (controllers.get(provider.provider) === controller) {
        gates.close(provider.provider);
        controllers.delete(provider.provider);
      }
    }
  };

  const refreshNow = async () => {
    await Promise.all(providers.map(refreshProvider));
  };

  const schedule = () => {
    if (disposed || !running) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = undefined;
      try { await refreshNow(); }
      finally { schedule(); }
    }, interval(activity));
  };

  return {
    refreshNow,
    start(next) {
      if (disposed) return;
      activity = next;
      running = true;
      schedule();
    },
    reschedule(next) {
      activity = next;
      schedule();
    },
    stop() {
      running = false;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      this.stop();
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    }
  };
}
