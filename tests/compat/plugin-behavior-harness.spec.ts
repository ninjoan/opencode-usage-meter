import { describe, expect, it, vi } from "vitest";

import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { PROCESS_STATUS, type SafeProcessTransport } from "../../src/transport/process.js";

vi.mock("@opentui/solid/jsx-runtime", () => ({
  jsx: (type: string, props: object) => ({ type, props }),
  jsxs: (type: string, props: object) => ({ type, props })
}));

const { createUsageMeterTuiPlugin } = await import("../../src/tui.js");

interface RegisteredCommand { readonly name: string; readonly run: () => Promise<void>; readonly title?: string; }
interface RegisteredSidebar { readonly slots: { readonly sidebar_content: () => { readonly props: { readonly children: readonly [{ readonly props: object }, { readonly props: { readonly children: () => string } }] } } }; }

function createHarness() {
  const registrations: RegisteredSidebar[] = [];
  const commands: RegisteredCommand[] = [];
  const listeners = new Map<string, () => void>();
  const unsubscribes = Array.from({ length: 6 }, () => vi.fn());
  let index = 0;
  const api = { slots: { register(sidebar: unknown) { registrations.push(sidebar as RegisteredSidebar); return "slot"; } }, keymap: { registerLayer(layer: { commands: RegisteredCommand[] }) { commands.push(...layer.commands); return unsubscribes[index++]!; } }, event: { on(type: string, listener: () => void) { listeners.set(type, listener); return unsubscribes[index++]!; } }, lifecycle: { signal: new AbortController().signal, onDispose(listener: () => void) { listeners.set("dispose", listener); return unsubscribes[index++]!; } } } as unknown as TuiPluginApi;
  return { api, commands, dispose: () => listeners.get("dispose")?.(), registrations, unsubscribes };
}

describe("in-process plugin behavior harness", () => {
  it("drives source TUI registration, refresh, toggle, partial failure, and disposal with fake Codex/Claude transport", async () => {
    const claudeOutput = "Session 5h: 64% remaining · resets in 2h\nWeekly all models: 21% remaining\nModel Opus: 12% remaining";
    let rejectClaude = false;
    const run = vi.fn(({ executable, args }: { readonly executable: string; readonly args: readonly string[] }) => rejectClaude && executable === "claude" ? Promise.reject(new Error("Claude refresh rejected")) : Promise.resolve({ status: PROCESS_STATUS.SUCCESS, output: executable === "codex" ? "5h usage: 42% remaining · resets in 1h\nWeekly usage: 77% remaining · resets Sunday" : claudeOutput, args }));
    const ptyRun = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.UNAVAILABLE, output: "" });
    const realPtyFactory = vi.fn(() => { throw new Error("real PTY factory must not run in the harness"); });
    const harness = createHarness();

    await createUsageMeterTuiPlugin({ platform: "linux", transport: { run } satisfies SafeProcessTransport, ptyTransport: { run: ptyRun }, ptyTransportFactory: realPtyFactory, now: () => 1 }).tui(harness.api, undefined, {} as never);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));

    const rendered = harness.registrations[0]!.slots.sidebar_content();
    await vi.waitFor(() => expect(rendered.props.children[1].props.children()).toContain("Weekly 77% · Resets Sunday"));
    expect(rendered.props.children[1].props.children()).toContain("Model Opus 12%");
    expect(rendered.props.children[1].props.children()).toContain("Claude Model Opus 12% remaining");
    expect(run.mock.calls.map(([request]) => [request.executable, request.args])).toEqual([["codex", ["/status"]], ["claude", ["/usage"]]]);

    rejectClaude = true;
    await harness.commands.find((command) => command.name === "usage.refresh")!.run();
    expect(rendered.props.children[1].props.children()).toContain("Claude: Data unavailable");
    expect(rendered.props.children[1].props.children()).toContain("Weekly 77% · Resets Sunday");
    rejectClaude = false;

    await harness.commands.find((command) => command.name === "usage.toggle")!.run();
    expect(rendered.props.children[1].props.children()).toBe("1/2");
    await harness.commands.find((command) => command.name === "usage.toggle")!.run();
    expect(rendered.props.children[1].props.children()).toContain("Claude: Data unavailable");
    expect(rendered.props.children[1].props.children()).toContain("Weekly 77% · Resets Sunday");
    expect(ptyRun).not.toHaveBeenCalled();
    expect(realPtyFactory).not.toHaveBeenCalled();

    harness.dispose();
    harness.dispose();
    expect(rendered.props.children[1].props.children()).toBe("Data unavailable");
    for (const unsubscribe of harness.unsubscribes) expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
