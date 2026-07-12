import { describe, expect, it, vi } from "vitest";

import { PROVIDER, orderUsageSnapshots, type UsageSnapshot } from "../../src/domain/usage.js";
import { createCodexProvider } from "../../src/providers/codex.js";
import { PROCESS_STATUS, type SafeProcessTransport } from "../../src/transport/process.js";

describe("Codex provider", () => {
  it("invokes only codex /status and returns a normalized snapshot", async () => {
    const run = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "Usage: 42%\nResets in 1h" });
    const provider = createCodexProvider({ run } satisfies SafeProcessTransport, () => 1234, "linux");
    const snapshot = { provider: PROVIDER.CODEX, status: "available", percentage: 42, reset: "1h", refreshedAt: 1234 } satisfies UsageSnapshot;
    await expect(provider.refresh()).resolves.toEqual(snapshot);
    expect(orderUsageSnapshots([snapshot])).toEqual([snapshot]);
    expect(run).toHaveBeenCalledWith({ executable: "codex", args: ["/status"], timeoutMs: 10_000 });
  });
  it("returns unavailable immediately on Windows or malformed command output", async () => {
    const run = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "unknown" });
    const provider = createCodexProvider({ run } satisfies SafeProcessTransport, () => 1234, "win32");
    await expect(provider.refresh()).resolves.toEqual({ provider: PROVIDER.CODEX, status: "unavailable", refreshedAt: 1234 });
    expect(run).not.toHaveBeenCalled();
  });
});
