import { describe, expect, it, vi } from "vitest";

import { PROCESS_STATUS } from "../../src/transport/process.js";
import { createInteractivePtyTransport, type InteractivePtyProcess, type InteractivePtySpawn } from "../../src/transport/interactive-pty.js";

function harness() {
  let data: ((value: string) => void) | undefined;
  let exit: ((event: { exitCode: number }) => void) | undefined;
  const process: InteractivePtyProcess = {
    kill: vi.fn(), write: vi.fn(),
    onData: vi.fn((listener) => { data = listener; return { dispose: vi.fn() }; }),
    onExit: vi.fn((listener) => { exit = listener; return { dispose: vi.fn() }; }),
  };
  const spawn = vi.fn(() => process) satisfies InteractivePtySpawn;
  return { data: (value: string) => data?.(value), exit: (code = 0) => exit?.({ exitCode: code }), process, spawn };
}

function request(signal?: AbortSignal) {
  const base = {
    executable: "tool", args: ["--safe"] as const, command: "/usage", cols: 40, rows: 6,
    cwd: "/workspace", env: { HOME: "/home/test", EMPTY: undefined, TERM: "xterm-256color" },
    timeoutMs: 2_000, startupTimeoutMs: 200, stabilityMs: 300,
    ready: (screen: { readonly lines: readonly string[] }) => screen.lines.some((line) => line.includes("Ready")),
    complete: (screen: { readonly lines: readonly string[] }) => screen.lines.some((line) => line.includes("Result: 42%")),
  }; return signal === undefined ? base : { ...base, signal };
}

describe("interactive PTY screen transport", () => {
  it("passes only the caller cwd and sanitized env to spawn", () => {
    const h = harness(); void createInteractivePtyTransport({ spawn: h.spawn, findExecutable: () => "/safe/tool", isExecutable: () => true, path: "/safe" }).run(request());
    expect(h.spawn).toHaveBeenCalledWith("/safe/tool", ["--safe"], { cols: 40, rows: 6, cwd: "/workspace", env: { HOME: "/home/test", TERM: "xterm-256color" }, name: "xterm" });
  });

  it("rejects an empty cwd before spawn", async () => {
    const h = harness(); await expect(createInteractivePtyTransport({ spawn: h.spawn }).run({ ...request(), cwd: "" })).resolves.toEqual({ status: PROCESS_STATUS.UNAVAILABLE, output: "" });
    expect(h.spawn).not.toHaveBeenCalled();
  });

  it("closes an abort racing with listener registration", async () => {
    const controller = new AbortController(); const h = harness();
    const add = controller.signal.addEventListener.bind(controller.signal);
    controller.signal.addEventListener = ((...args: Parameters<typeof add>) => { add(...args); controller.abort(); }) as typeof add;
    await expect(createInteractivePtyTransport({ spawn: h.spawn, findExecutable: () => "/safe/tool", isExecutable: () => true }).run(request(controller.signal))).resolves.toEqual({ status: PROCESS_STATUS.CANCELLED, output: "" });
    expect(h.process.kill).toHaveBeenCalledOnce();
  });

  it.each(["ready", "complete", "write"] as const)("contains throwing %s processing", async (failure) => {
    vi.useFakeTimers(); const h = harness(); const input = request();
    if (failure === "ready") input.ready = () => { throw new Error("secret"); };
    if (failure === "complete") input.complete = () => { throw new Error("secret"); };
    if (failure === "write") h.process.write = vi.fn(() => { throw new Error("secret"); });
    const result = createInteractivePtyTransport({ spawn: h.spawn, findExecutable: () => "/safe/tool", isExecutable: () => true }).run(input);
    h.data("Ready"); await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toEqual({ status: PROCESS_STATUS.FAILED, output: "" }); expect(h.process.kill).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("reconstructs ANSI repaints, waits for readiness, writes command+CR once, and captures stable screen before exit", async () => {
    vi.useFakeTimers(); const h = harness();
    const transport = createInteractivePtyTransport({ spawn: h.spawn, findExecutable: () => "/safe/tool", isExecutable: () => true, path: "/safe" });
    const result = transport.run(request());
    h.data("Loading"); await vi.advanceTimersByTimeAsync(0); expect(h.process.write).not.toHaveBeenCalled();
    h.data("\rReady  "); await vi.advanceTimersByTimeAsync(0); expect(h.process.write).toHaveBeenCalledExactlyOnceWith("/usage\r");
    h.data("\rResult: 4%"); await vi.advanceTimersByTimeAsync(299); expect(h.process.kill).not.toHaveBeenCalled();
    h.data("\u001b[2K\rResult: 42%"); await vi.advanceTimersByTimeAsync(299); expect(h.process.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({ status: PROCESS_STATUS.SUCCESS, output: expect.stringContaining("Result: 42%") });
    expect(h.process.write).toHaveBeenCalledWith("\u001b"); expect(h.process.write).toHaveBeenCalledWith("\u0003");
    vi.useRealTimers();
  });

  it.each([
    ["startup", 200, PROCESS_STATUS.TIMED_OUT],
    ["result", 2_000, PROCESS_STATUS.TIMED_OUT],
  ] as const)("handles %s timeout without exposing partial output", async (phase, elapsed, status) => {
    vi.useFakeTimers(); const h = harness();
    const result = createInteractivePtyTransport({ spawn: h.spawn, findExecutable: () => "/safe/tool", isExecutable: () => true }).run(request());
    if (phase === "result") { h.data("Ready"); await vi.runAllTicks(); h.data("partial secret"); }
    await vi.advanceTimersByTimeAsync(elapsed);
    await expect(result).resolves.toEqual({ status, output: "" }); expect(h.process.kill).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("cancels before spawn and after command, and ignores late callbacks", async () => {
    const before = new AbortController(); before.abort(); const unused = harness();
    await expect(createInteractivePtyTransport({ spawn: unused.spawn }).run(request(before.signal))).resolves.toEqual({ status: PROCESS_STATUS.CANCELLED, output: "" });
    expect(unused.spawn).not.toHaveBeenCalled();
    const after = new AbortController(); const h = harness();
    const result = createInteractivePtyTransport({ spawn: h.spawn, findExecutable: () => "/safe/tool", isExecutable: () => true }).run(request(after.signal));
    h.data("Ready"); await vi.waitFor(() => expect(h.process.write).toHaveBeenCalledWith("/usage\r")); after.abort();
    await expect(result).resolves.toEqual({ status: PROCESS_STATUS.CANCELLED, output: "" });
    h.data("Result: 42%"); h.exit(); expect(h.process.kill).toHaveBeenCalledOnce();
  });

  it("fails safely on overflow or exit and disposes duplicate callbacks exactly once", async () => {
    for (const event of ["overflow", "exit"] as const) {
      const h = harness(); const disposals: Array<{ dispose(): void }> = [];
      h.process.onData = vi.fn((listener) => { disposals.push({ dispose: vi.fn() }); const original = h.data; void original; queueMicrotask(() => listener(event === "overflow" ? "x".repeat(65_537) : "Ready")); return disposals[0]!; });
      h.process.onExit = vi.fn((listener) => { disposals.push({ dispose: vi.fn() }); if (event === "exit") queueMicrotask(() => { listener({ exitCode: 1 }); listener({ exitCode: 0 }); }); return disposals[1]!; });
      const result = createInteractivePtyTransport({ spawn: h.spawn, findExecutable: () => "/safe/tool", isExecutable: () => true }).run(request());
      await expect(result).resolves.toEqual({ status: PROCESS_STATUS.FAILED, output: "" });
      expect(disposals.every((item) => vi.mocked(item.dispose).mock.calls.length === 1)).toBe(true); expect(h.process.kill).toHaveBeenCalledOnce();
    }
  });
});
