import { describe, expect, it, vi } from "vitest";

import { PROCESS_STATUS, createSafeProcessTransport, type SpawnFunction } from "../../src/transport/process.js";

function createSpawn(output: string): SpawnFunction {
  return (_executable, _args, options) => {
    queueMicrotask(() => options.onData(output));
    queueMicrotask(() => options.onClose(0));
    return { kill: vi.fn(), pid: 123 };
  };
}

describe("safe process transport", () => {
  it("passes readonly arguments without a shell and exposes only the minimal environment", async () => {
    const spawn = vi.fn(createSpawn("usage: 42%"));
    const transport = createSafeProcessTransport({ spawn, findExecutable: () => "/safe/bin/codex", isExecutable: () => true, platform: "linux", path: "/safe/bin" });
    const result = await transport.run({ executable: "codex", args: ["/status", "; rm -rf /"] as const, timeoutMs: 100 });
    expect(result).toEqual({ status: PROCESS_STATUS.SUCCESS, output: "usage: 42%" });
    expect(spawn).toHaveBeenCalledWith("/safe/bin/codex", ["/status", "; rm -rf /"], expect.objectContaining({ shell: false, env: { PATH: "/safe/bin" } }));
  });

  it("rejects relative overrides and Windows without starting a child process", async () => {
    const spawn = vi.fn(createSpawn("should not run"));
    const transport = createSafeProcessTransport({ spawn, findExecutable: () => undefined, platform: "win32", path: "/safe/bin" });
    await expect(transport.run({ executable: "./codex", args: ["/status"], timeoutMs: 100 })).resolves.toEqual({ status: PROCESS_STATUS.UNAVAILABLE, output: "" });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("requires a verified regular executable and does not spawn for a pre-aborted signal", async () => {
    const spawn = vi.fn(createSpawn("should not run"));
    const controller = new AbortController();
    controller.abort();
    const transport = createSafeProcessTransport({ spawn, findExecutable: () => "/safe/bin/codex", isExecutable: () => false, platform: "linux", path: "/safe/bin" });
    await expect(transport.run({ executable: "codex", args: ["/status"], signal: controller.signal, timeoutMs: 100 })).resolves.toEqual({ status: PROCESS_STATUS.CANCELLED, output: "" });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("fails soft after a synchronous spawn error and releases its single-flight reservation", async () => {
    const spawn = vi.fn().mockImplementationOnce(() => { throw new Error("spawn failed"); }).mockImplementationOnce(createSpawn("usage: 42%"));
    const transport = createSafeProcessTransport({ spawn, findExecutable: () => "/safe/bin/codex", isExecutable: () => true, platform: "linux", path: "/safe/bin" });
    await expect(transport.run({ executable: "codex", args: ["/status"], timeoutMs: 100 })).resolves.toEqual({ status: PROCESS_STATUS.FAILED, output: "" });
    await expect(transport.run({ executable: "codex", args: ["/status"], timeoutMs: 100 })).resolves.toEqual({ status: PROCESS_STATUS.SUCCESS, output: "usage: 42%" });
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it("cancels a hanging child through its POSIX group, terminates output over the cap, and prevents overlap", async () => {
    const kill = vi.fn();
    const killGroup = vi.fn();
    const spawn = vi.fn((_executable, _args, options) => {
      return { kill, killGroup, pid: 456 };
    }) satisfies SpawnFunction;
    const transport = createSafeProcessTransport({ spawn, findExecutable: () => "/safe/bin/codex", isExecutable: () => true, platform: "darwin", path: "/safe/bin" });
    const controller = new AbortController();
    const first = transport.run({ executable: "codex", args: ["/status"], signal: controller.signal, timeoutMs: 100 });
    const second = await transport.run({ executable: "codex", args: ["/status"], timeoutMs: 5 });
    controller.abort();
    expect(second).toEqual({ status: PROCESS_STATUS.BUSY, output: "" });
    await expect(first).resolves.toEqual({ status: PROCESS_STATUS.CANCELLED, output: "" });
    expect(killGroup).toHaveBeenCalledOnce();

    const capped = createSafeProcessTransport({ spawn: (_executable, _args, options) => { options.onData("x".repeat(70_000)); return { kill, pid: 1 }; }, findExecutable: () => "/safe/bin/codex", isExecutable: () => true, platform: "linux", path: "/safe/bin" });
    await expect(capped.run({ executable: "codex", args: ["/status"], timeoutMs: 100 })).resolves.toEqual({ status: PROCESS_STATUS.FAILED, output: "" });
    expect(kill).toHaveBeenCalledTimes(2);
  });

  it("keeps synchronous UTF-8 cap overflow single-flight until the assigned child is killed", async () => {
    const kill = vi.fn();
    let close: (() => void) | undefined;
    const spawn = vi.fn((_executable, _args, options) => {
      options.onData("€".repeat(22_000));
      close = () => options.onClose(0);
      return { kill, pid: 789 };
    }) satisfies SpawnFunction;
    const transport = createSafeProcessTransport({ spawn, findExecutable: () => "/safe/bin/codex", isExecutable: () => true, platform: "linux" });

    const first = transport.run({ executable: "codex", args: ["/status"], timeoutMs: 100 });
    await expect(transport.run({ executable: "codex", args: ["/status"], timeoutMs: 100 })).resolves.toEqual({ status: PROCESS_STATUS.BUSY, output: "" });
    expect(kill).toHaveBeenCalledOnce();
    close?.();
    await expect(first).resolves.toEqual({ status: PROCESS_STATUS.FAILED, output: "" });
  });

  it("settles asynchronous UTF-8 cap overflow once before admitting the next probe", async () => {
    const kill = vi.fn();
    let emit: (() => void) | undefined;
    const spawn = vi.fn((_executable, _args, options) => {
      emit = () => { options.onData("€".repeat(22_000)); options.onData("duplicate"); options.onClose(0); };
      return { kill, pid: 789 };
    }) satisfies SpawnFunction;
    const transport = createSafeProcessTransport({ spawn, findExecutable: () => "/safe/bin/codex", isExecutable: () => true, platform: "linux" });
    const first = transport.run({ executable: "codex", args: ["/status"], timeoutMs: 100 });
    queueMicrotask(() => emit?.());
    await expect(transport.run({ executable: "codex", args: ["/status"], timeoutMs: 100 })).resolves.toEqual({ status: PROCESS_STATUS.BUSY, output: "" });
    await expect(first).resolves.toEqual({ status: PROCESS_STATUS.FAILED, output: "" });
    expect(kill).toHaveBeenCalledOnce();
    void transport.run({ executable: "codex", args: ["/status"], timeoutMs: 100 });
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it("times out with cleanup, empty output, and releases single-flight", async () => {
    vi.useFakeTimers();
    const kill = vi.fn();
    const killGroup = vi.fn();
    const spawn = vi.fn(() => ({ kill, killGroup, pid: 456 })) satisfies SpawnFunction;
    const transport = createSafeProcessTransport({ spawn, findExecutable: () => "/safe/bin/codex", isExecutable: () => true, platform: "linux" });
    const first = transport.run({ executable: "codex", args: ["/status"], timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    await expect(first).resolves.toEqual({ status: PROCESS_STATUS.TIMED_OUT, output: "" });
    expect(killGroup).toHaveBeenCalledOnce();
    expect(kill).toHaveBeenCalledOnce();
    void transport.run({ executable: "codex", args: ["/status"], timeoutMs: 50 });
    expect(spawn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
