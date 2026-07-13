import { describe, expect, it, vi } from "vitest";

import { PROVIDER, PROVIDER_LABEL, USAGE_STATUS, type UsageSnapshot } from "../../src/domain/usage.js";
import { createProviderGates } from "../../src/gates/provider-gates.js";
import { ACTIVITY_STATE, REFRESH_INTERVAL, createRefreshScheduler } from "../../src/scheduler/refresh.js";
import { createAdaptiveActivityController, type ActivityEventSource } from "../../src/state/activity.js";
import { createUsageCache } from "../../src/state/cache.js";

describe("Codex refresh scheduler", () => {
  it("starts, reschedules, and stops at 2m, 5m, 15m, and 30m cadences", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 1 });
    const scheduler = createRefreshScheduler([{ provider: PROVIDER.CODEX, refresh }], createUsageCache(), createProviderGates());
    scheduler.start(ACTIVITY_STATE.RECENT_INTERACTION);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.RECENT_INTERACTION);
    scheduler.reschedule(ACTIVITY_STATE.ACTIVE);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.ACTIVE);
    scheduler.reschedule(ACTIVITY_STATE.IDLE);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.IDLE);
    scheduler.reschedule(ACTIVITY_STATE.RESOURCE_CONSTRAINED);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.RESOURCE_CONSTRAINED);
    scheduler.stop();
    expect(refresh).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
  it("runs manual refresh once, caches fresh data, and discards a stale value after failure", async () => {
    const refresh = vi.fn().mockResolvedValueOnce({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 1 }).mockResolvedValueOnce({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 2 });
    const cache = createUsageCache();
    const scheduler = createRefreshScheduler([{ provider: PROVIDER.CODEX, refresh }], cache, createProviderGates());
    await scheduler.refreshNow();
    expect(cache.get(PROVIDER.CODEX)).toEqual({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 1 });
    await scheduler.refreshNow();
    expect(cache.get(PROVIDER.CODEX)).toBeUndefined();
  });
  it("does not overlap a scheduled Codex refresh with a manual refresh", async () => {
    let complete: ((value: UsageSnapshot) => void) | undefined;
    const refresh = vi.fn(() => new Promise<UsageSnapshot>((resolve) => { complete = resolve; }));
    const scheduler = createRefreshScheduler([{ provider: PROVIDER.CODEX, refresh }], createUsageCache(), createProviderGates());
    const scheduled = scheduler.refreshNow();
    await scheduler.refreshNow();
    complete?.({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 1 });
    await scheduled;
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("does not reschedule an in-flight refresh after stop", async () => {
    vi.useFakeTimers();
    let complete: ((value: UsageSnapshot) => void) | undefined;
    const refresh = vi.fn(() => new Promise<UsageSnapshot>((resolve) => { complete = resolve; }));
    const scheduler = createRefreshScheduler([{ provider: PROVIDER.CODEX, refresh }], createUsageCache(), createProviderGates());
    scheduler.start(ACTIVITY_STATE.ACTIVE);
    scheduler.start(ACTIVITY_STATE.ACTIVE);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.ACTIVE);
    scheduler.stop();
    scheduler.stop();
    scheduler.reschedule(ACTIVITY_STATE.RECENT_INTERACTION);
    complete?.({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 1 });
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.ACTIVE);
    expect(refresh).toHaveBeenCalledOnce();
    scheduler.dispose();
    scheduler.start(ACTIVITY_STATE.ACTIVE);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.ACTIVE);
    expect(refresh).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  it("gates rate-limited and failed providers until their backoff expires", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValueOnce({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 1, retryAfterMs: 60_000 }).mockResolvedValueOnce({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 2 });
    const scheduler = createRefreshScheduler([{ provider: PROVIDER.CODEX, refresh }], createUsageCache(), createProviderGates(), () => Date.now());
    await scheduler.refreshNow(); await scheduler.refreshNow(); await vi.advanceTimersByTimeAsync(60_000); await scheduler.refreshNow();
    expect(refresh).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
  it("uses actual activity events for recent, active, inactive, prolonged, and constrained cadence", async () => {
    vi.useFakeTimers();
    let interaction: (() => void) | undefined; let active: (() => void) | undefined; let inactive: (() => void) | undefined;
    const states: string[] = [];
    const source: ActivityEventSource = { onInteraction(listener) { interaction = listener; return () => { interaction = undefined; }; }, onActive(listener) { active = listener; return () => { active = undefined; }; }, onInactive(listener) { inactive = listener; return () => { inactive = undefined; }; }, isResourceConstrained: () => false };
    const controller = createAdaptiveActivityController({ reschedule: (state) => states.push(state) }, source);
    controller.start(); interaction?.(); await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.RECENT_INTERACTION); active?.(); inactive?.(); await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL.IDLE);
    expect(states).toEqual([ACTIVITY_STATE.INACTIVE, ACTIVITY_STATE.RECENT_INTERACTION, ACTIVITY_STATE.ACTIVE, ACTIVITY_STATE.ACTIVE, ACTIVITY_STATE.INACTIVE, ACTIVITY_STATE.PROLONGED_INACTIVITY]);
    controller.dispose(); vi.useRealTimers();
  });
  it("fans out usage.refresh to all providers and isolates partial failures", async () => {
    const cache = createUsageCache();
    const codex = vi.fn().mockResolvedValue({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 1 });
    const claude = vi.fn().mockResolvedValue({ provider: PROVIDER.CLAUDE, label: PROVIDER_LABEL[PROVIDER.CLAUDE], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 1 });
    const scheduler = createRefreshScheduler([
      { provider: PROVIDER.CODEX, refresh: codex },
      { provider: PROVIDER.CLAUDE, refresh: claude }
    ], cache, createProviderGates());

    await scheduler.refreshNow();

    expect(codex).toHaveBeenCalledOnce();
    expect(claude).toHaveBeenCalledOnce();
    expect(cache.get(PROVIDER.CODEX)?.windows).toEqual([{ label: "5h", percentRemaining: 42 }]);
    expect(cache.get(PROVIDER.CLAUDE)).toBeUndefined();
  });
  it("clears and publishes only the rejected provider while retaining other provider data", async () => {
    const cache = createUsageCache();
    const snapshots: UsageSnapshot[] = [];
    const codex = { provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 1 } as const;
    const claude = { provider: PROVIDER.CLAUDE, label: PROVIDER_LABEL[PROVIDER.CLAUDE], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "Session 5h", percentRemaining: 64 }], refreshedAt: 1 } as const;
    const claudeRefresh = vi.fn().mockResolvedValueOnce(claude).mockRejectedValueOnce(new Error("refresh rejected"));
    const scheduler = createRefreshScheduler([{ provider: PROVIDER.CODEX, refresh: vi.fn().mockResolvedValue(codex) }, { provider: PROVIDER.CLAUDE, refresh: claudeRefresh }], cache, createProviderGates(), () => 2, (snapshot) => snapshots.push(snapshot));

    await scheduler.refreshNow();
    await scheduler.refreshNow();

    expect(cache.get(PROVIDER.CODEX)).toEqual(codex);
    expect(cache.get(PROVIDER.CLAUDE)).toBeUndefined();
    expect(snapshots.at(-1)).toEqual({ provider: PROVIDER.CLAUDE, label: PROVIDER_LABEL[PROVIDER.CLAUDE], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 2 });
  });
});
