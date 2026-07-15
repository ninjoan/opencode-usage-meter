import { describe, expect, it, vi } from "vitest";

import { PROVIDER, PROVIDER_LABEL, USAGE_STATUS, orderUsageSnapshots, type UsageSnapshot } from "../../src/domain/usage.js";
import { createCodexProvider } from "../../src/providers/codex.js";
import { PROCESS_STATUS, type SafeProcessTransport } from "../../src/transport/process.js";

describe("Codex provider", () => {
  it("invokes only codex /status and returns a normalized snapshot", async () => {
    const run = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "Codex status\n5h usage: 42% remaining · resets in 1h\nWeekly usage: 77% remaining · resets Sunday" });
    const provider = createCodexProvider({ run } satisfies SafeProcessTransport, () => 1234, "linux");
    const snapshot = {
      provider: PROVIDER.CODEX,
      label: PROVIDER_LABEL[PROVIDER.CODEX],
      status: USAGE_STATUS.AVAILABLE,
      windows: [
        { label: "5h", percentRemaining: 42, reset: "1h" },
        { label: "Weekly", percentRemaining: 77, reset: "Sunday" }
      ],
      refreshedAt: 1234
    } satisfies UsageSnapshot;
    await expect(provider.refresh()).resolves.toEqual(snapshot);
    expect(orderUsageSnapshots([snapshot])).toEqual([snapshot]);
    expect(run).toHaveBeenCalledWith({ executable: "codex", args: ["/status"], timeoutMs: 10_000 });
  });
  it("returns unavailable immediately on Windows or malformed command output", async () => {
    const run = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "unknown" });
    const provider = createCodexProvider({ run } satisfies SafeProcessTransport, () => 1234, "win32");
    await expect(provider.refresh()).resolves.toEqual({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 1234 });
    expect(run).not.toHaveBeenCalled();
  });
  it("emits sanitized structured parse diagnostics", async () => {
    const diagnostic = vi.fn();
    const provider = createCodexProvider({ run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "token=secret /home/user/key" }) } satisfies SafeProcessTransport, (() => { let value = 5; return () => value += 5; })(), "linux", diagnostic);
    await provider.refresh();
    expect(diagnostic).toHaveBeenCalledWith({ provider: PROVIDER.CODEX, stage: "parse", durationMs: 5, category: "malformed" });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toMatch(/secret|\/home\/user/);
  });
  it("returns unavailable when the diagnostic sink throws", async () => {
    const provider = createCodexProvider({ run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "unknown" }) } satisfies SafeProcessTransport, () => 1234, "linux", () => { throw new Error("sink failed"); });
    await expect(provider.refresh()).resolves.toEqual({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 1234 });
  });
});
