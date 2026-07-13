import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { PROVIDER, PROVIDER_LABEL, USAGE_STATUS } from "../../src/domain/usage.js";
import { createClaudeProvider } from "../../src/providers/claude.js";
import { PROCESS_STATUS, type SafeProcessTransport } from "../../src/transport/process.js";

async function usageFixture(): Promise<string> {
  return readFile(new URL("../fixtures/claude/usage-basic.txt", import.meta.url), "utf8");
}

describe("Claude provider", () => {
  it("invokes only official claude /usage through safe transport", async () => {
    const run = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: await usageFixture() });
    const provider = createClaudeProvider({ run } satisfies SafeProcessTransport, () => 4321, "linux");

    await expect(provider.refresh()).resolves.toEqual({
      provider: PROVIDER.CLAUDE,
      label: PROVIDER_LABEL[PROVIDER.CLAUDE],
      status: USAGE_STATUS.AVAILABLE,
      windows: [
        { label: "Session 5h", percentRemaining: 64, reset: "2h 10m" },
        { label: "Weekly", percentRemaining: 21, reset: "Monday 09:00" }
      ],
      refreshedAt: 4321
    });
    expect(run).toHaveBeenCalledWith({ executable: "claude", args: ["/usage"], timeoutMs: 10_000 });
  });

  it("returns unavailable on Windows or malformed output without executing shortcuts", async () => {
    const run = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "No quota" });
    const provider = createClaudeProvider({ run } satisfies SafeProcessTransport, () => 4321, "win32");

    await expect(provider.refresh()).resolves.toEqual({
      provider: PROVIDER.CLAUDE,
      label: PROVIDER_LABEL[PROVIDER.CLAUDE],
      status: USAGE_STATUS.UNAVAILABLE,
      windows: [],
      refreshedAt: 4321
    });
    expect(run).not.toHaveBeenCalled();
  });
});
