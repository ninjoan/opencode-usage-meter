import { describe, expect, it, vi } from "vitest";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { SafeProcessTransport } from "../../src/transport/process.js";

vi.mock("@opentui/solid/jsx-runtime", () => ({
  jsx: (type: string, props: object) => ({ type, props }),
  jsxs: (type: string, props: object) => ({ type, props })
}));

const { createUsageMeterTuiPlugin } = await import("../../src/tui.js");

function createPublicApi() {
  const listeners = new Map<string, Array<() => void>>();
  const unsubscribes = Array.from({ length: 6 }, () => vi.fn());
  let unsubscribeIndex = 0;
  const register = vi.fn((slot: unknown) => { void slot; return "usage-meter-sidebar-slot"; });
  const api = { slots: { register }, keymap: { registerLayer: () => unsubscribes[unsubscribeIndex++]! }, event: { on: (type: string, listener: () => void) => { listeners.set(type, [...(listeners.get(type) ?? []), listener]); return unsubscribes[unsubscribeIndex++]!; } }, lifecycle: { signal: new AbortController().signal, onDispose: (listener: () => void) => { listeners.set("dispose", [...(listeners.get("dispose") ?? []), listener]); return unsubscribes[unsubscribeIndex++]!; } } } as unknown as TuiPluginApi;
  return { api, listeners, register, unsubscribes };
}

describe("usage meter lifecycle", () => {
  it("registers through public APIs, removes six subscriptions, and aborts an active probe exactly once", async () => {
    let receivedSignal: AbortSignal | undefined;
    const run = vi.fn(({ signal }: { signal?: AbortSignal }) => new Promise<{ status: "cancelled"; output: string }>((resolve) => { receivedSignal = signal; signal?.addEventListener("abort", () => resolve({ status: "cancelled", output: "" }), { once: true }); }));
    const fake = createPublicApi();
    const plugin = createUsageMeterTuiPlugin({ transport: { run } satisfies SafeProcessTransport, platform: "linux", now: () => 1 });
    await plugin.tui(fake.api, undefined, {} as never);
    fake.listeners.get("dispose")?.forEach((listener) => listener());
    fake.listeners.get("dispose")?.forEach((listener) => listener());
    await Promise.resolve(); await Promise.resolve();
    expect(fake.register).toHaveBeenCalledOnce();
    const registered = fake.register.mock.calls[0]?.[0] as { slots: { sidebar_content: () => { props: { children: readonly [{ props: object }, { props: { children: () => string } }] } } } };
    const sidebar = registered.slots.sidebar_content();
    expect(sidebar.props.children[1].props.children()).toBe("Data unavailable");
    expect(receivedSignal?.aborted).toBe(true);
    expect(fake.unsubscribes).toHaveLength(6);
    for (const unsubscribe of fake.unsubscribes) expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("does not start probes when public sidebar registration fails", async () => {
    const run = vi.fn();
    const plugin = createUsageMeterTuiPlugin({ transport: { run } satisfies SafeProcessTransport, platform: "linux" });
    const api = { slots: { register: () => { throw new Error("host failure"); } } } as unknown as TuiPluginApi;
    await expect(plugin.tui(api, undefined, {} as never)).resolves.toBeUndefined();
    expect(run).not.toHaveBeenCalled();
  });
});
