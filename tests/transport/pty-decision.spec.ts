import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { PROVIDER, USAGE_STATUS } from "../../src/domain/usage.js";
import { createClaudeProvider } from "../../src/providers/claude.js";
import { createPtyProcessTransport, createSafeProcessTransport, PROCESS_STATUS, type PtyModule, type SafeProcessTransport, type SpawnFunction } from "../../src/transport/process.js";
import { createUsageMeterTuiPlugin } from "../../src/tui.js";

describe("Claude pipe-vs-PTY decision", () => {
  const nativeIt = process.env.USAGE_METER_NATIVE_PTY === "1" ? it : it.skip;

  it("proves sanitized fixture-backed claude /usage output parses through SafeProcessTransport pipes", async () => {
    const fixture = await readFile(new URL("../fixtures/claude/usage-basic.txt", import.meta.url), "utf8");
    const run = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: fixture });
    const provider = createClaudeProvider({ run } satisfies SafeProcessTransport, () => 1, "linux");

    const snapshot = await provider.refresh();

    expect(snapshot.provider).toBe(PROVIDER.CLAUDE);
    expect(snapshot.status).toBe(USAGE_STATUS.AVAILABLE);
    expect(snapshot.windows).toEqual(expect.arrayContaining([{ label: "Session 5h", percentRemaining: 64, reset: "2h 10m" }]));
    expect(run).toHaveBeenCalledWith({ executable: "claude", args: ["/usage"], timeoutMs: 10_000 });
  });

  it("falls back for unparseable pipe output but not for pipe success", async () => {
    const fixture = await readFile(new URL("../fixtures/claude/usage-basic.txt", import.meta.url), "utf8");
    const run = vi.fn().mockResolvedValueOnce({ status: PROCESS_STATUS.SUCCESS, output: "TTY required" }).mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: fixture });
    const pty = { run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: fixture }) };
    const provider = createClaudeProvider({ run } satisfies SafeProcessTransport, () => 1, "linux", pty);
    expect((await provider.refresh()).status).toBe(USAGE_STATUS.AVAILABLE);
    expect(pty.run).toHaveBeenCalledOnce();
    expect((await provider.refresh()).status).toBe(USAGE_STATUS.AVAILABLE);
    expect(pty.run).toHaveBeenCalledOnce();
  });

  it("falls back after TTY-required stderr on a failed pipe but ignores unrelated failed stderr", async () => {
    const fixture = await readFile(new URL("../fixtures/claude/usage-basic.txt", import.meta.url), "utf8");
    const spawn = vi.fn((_executable, _args, options) => {
      queueMicrotask(() => options.onStderr("Error: interactive TTY required\u001b[31m\n"));
      queueMicrotask(() => options.onClose(1));
      return { kill: vi.fn() };
    }) satisfies SpawnFunction;
    const pipe = createSafeProcessTransport({ spawn, findExecutable: () => "/bin/claude", isExecutable: () => true, platform: "linux", path: "/bin" });
    const pty = { run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: fixture }) };

    expect((await createClaudeProvider(pipe, () => 1, "linux", pty).refresh()).status).toBe(USAGE_STATUS.AVAILABLE);
    expect(pty.run).toHaveBeenCalledOnce();

    spawn.mockImplementationOnce((_executable, _args, options) => {
      queueMicrotask(() => options.onStderr(`${"x".repeat(9_000)} interactive TTY required`));
      queueMicrotask(() => options.onClose(1));
      return { kill: vi.fn() };
    });
    expect((await createClaudeProvider(pipe, () => 1, "linux", pty).refresh()).status).toBe(USAGE_STATUS.UNAVAILABLE);
    expect(pty.run).toHaveBeenCalledOnce();
  });

  it("degrades safely when native PTY is missing and never falls back on Windows", async () => {
    const pipe = { run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "TTY required" }) };
    const pty = createPtyProcessTransport({ loadPty: vi.fn().mockRejectedValue(new Error("missing")), platform: "linux", path: "/bin" });
    expect((await createClaudeProvider(pipe, () => 1, "linux", pty).refresh()).status).toBe(USAGE_STATUS.UNAVAILABLE);
    expect((await createClaudeProvider(pipe, () => 1, "win32", pty).refresh()).status).toBe(USAGE_STATUS.UNAVAILABLE);
    expect(pipe.run).toHaveBeenCalledOnce();
  });

  it("keeps the production plugin default wired to a PTY transport factory", () => {
    const pty = { run: vi.fn() } satisfies SafeProcessTransport;
    const factory = vi.fn(() => pty);

    createUsageMeterTuiPlugin({ ptyTransportFactory: factory });

    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith({ platform: process.platform });
  });

  it("writes exactly /usage plus enter and cleans up on timeout and cancellation", async () => {
    vi.useFakeTimers();
    const kill = vi.fn(); const write = vi.fn();
    const module = { spawn: vi.fn(() => ({ kill, write, onData: vi.fn(() => ({ dispose: vi.fn() })), onExit: vi.fn(() => ({ dispose: vi.fn() })) })) } satisfies PtyModule;
    const pty = createPtyProcessTransport({ findExecutable: () => "/bin/claude", isExecutable: () => true, loadPty: async () => module, path: "/bin", platform: "linux" });
    const timed = pty.run({ executable: "claude", args: [], timeoutMs: 10 });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);
    expect(await timed).toEqual({ status: PROCESS_STATUS.TIMED_OUT, output: "" });
    expect(write).toHaveBeenCalledWith("/usage\r"); expect(kill).toHaveBeenCalledOnce();
    const controller = new AbortController(); const cancelled = pty.run({ executable: "claude", args: [], timeoutMs: 10, signal: controller.signal }); await Promise.resolve(); controller.abort();
    expect(await cancelled).toEqual({ status: PROCESS_STATUS.CANCELLED, output: "" });
    expect(kill).toHaveBeenCalledTimes(2); vi.useRealTimers();
  });

  it("declares node-pty optional without adding a transport path", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as Record<string, Record<string, string> | undefined>;

    expect(packageJson.optionalDependencies?.["node-pty"]).toBeDefined();
    await expect(readFile(new URL("../../src/transport/pty.ts", import.meta.url), "utf8")).rejects.toThrow();
  });

  nativeIt("exercises production PTY input, provider fallback, timeout, cancellation, and cleanup", async () => {
    const root = await mkdtemp(join(tmpdir(), "usage-meter-pty-"));
    const executable = join(root, "claude");
    const createScript = async (body: string) => {
      await writeFile(executable, `#!${process.execPath}\n${body}`);
      await chmod(executable, 0o755);
    };
    const pty = createPtyProcessTransport({ path: root, platform: process.platform });
    try {
      await createScript("process.stdin.once('data',d=>{if(d.toString().includes('/usage')){console.log('Current session 64% remaining · resets in 2h 10m');setTimeout(()=>process.exit(),20)}})");
      const pipe = { run: vi.fn().mockResolvedValue({ status: PROCESS_STATUS.SUCCESS, output: "TTY required" }) };
      const snapshot = await createClaudeProvider(pipe, () => 1, process.platform, pty).refresh();
      expect(snapshot.status).toBe(USAGE_STATUS.AVAILABLE);
      expect(snapshot.windows).toEqual([{ label: "Session 5h", percentRemaining: 64, reset: "2h 10m" }]);

      await createScript("process.stdin.resume()");
      expect(await pty.run({ executable: "claude", args: [], timeoutMs: 50 })).toEqual({ status: PROCESS_STATUS.TIMED_OUT, output: "" });
      const controller = new AbortController();
      const cancelled = pty.run({ executable: "claude", args: [], timeoutMs: 5_000, signal: controller.signal });
      setTimeout(() => controller.abort(), 50);
      expect(await cancelled).toEqual({ status: PROCESS_STATUS.CANCELLED, output: "" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
    await expect(readFile(executable)).rejects.toThrow();
  }, 10_000);
});
