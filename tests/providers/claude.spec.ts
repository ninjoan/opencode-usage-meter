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
  it("diagnoses PTY retry and exhaustion without command output", async () => {
    const diagnostic = vi.fn();
    const failed = { run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.FAILED, output: "token=secret", requiresTerminal: true }) } satisfies SafeProcessTransport;
    const provider = createClaudeProvider(failed, () => 10, "linux", failed, diagnostic);
    await provider.refresh();
    expect(diagnostic).toHaveBeenCalledTimes(2);
    expect(diagnostic).toHaveBeenLastCalledWith({ provider: PROVIDER.CLAUDE, stage: "pty", durationMs: 0, category: "exhausted" });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("secret");
  });
  it("runs PTY fallback when the diagnostic sink throws", async () => {
    const fallback = { run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: await usageFixture() }) } satisfies SafeProcessTransport;
    const provider = createClaudeProvider({ run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.FAILED, output: "TTY required", requiresTerminal: true }) } satisfies SafeProcessTransport, () => 4321, "linux", fallback, () => { throw new Error("sink failed"); });

    await expect(provider.refresh()).resolves.toEqual(expect.objectContaining({ provider: PROVIDER.CLAUDE, status: USAGE_STATUS.AVAILABLE }));
    expect(fallback.run).toHaveBeenCalledOnce();
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
