import { describe, expect, it, vi } from "vitest";

vi.mock("@opentui/solid/jsx-runtime", () => ({
  jsx: (type: string, props: object) => ({ type, props }),
  jsxs: (type: string, props: object) => ({ type, props })
}));

import plugin, {
  PLUGIN_CONTRACT,
  createUsageMeterTuiPlugin,
  renderUnavailableUsage
} from "../../src/tui.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { PROCESS_STATUS } from "../../src/transport/process.js";
import { assertFixtureTextIsSafe } from "../support/fixture-policy.js";

interface RegisteredSidebarContent { readonly id: string; readonly slots: { readonly sidebar_content: () => unknown }; }
interface RegisteredCommand { readonly name: string; readonly run: () => Promise<void>; readonly title?: string; }

function createFakeTuiApi() {
  const registrations: RegisteredSidebarContent[] = [];
  const commands: RegisteredCommand[] = [];
  const listeners = new Map<string, () => void>();
  const unsubscribes = Array.from({ length: 6 }, () => vi.fn());
  let unsubscribeIndex = 0;

  const api = {
    slots: {
      register(sidebar: unknown) { registrations.push(sidebar as RegisteredSidebarContent); return "usage-meter-slot"; }
    },
    keymap: { registerLayer(layer: { commands: RegisteredCommand[] }) { commands.push(...layer.commands); return unsubscribes[unsubscribeIndex++]!; } },
    event: { on(type: string, listener: () => void) { listeners.set(type, listener); return unsubscribes[unsubscribeIndex++]!; } },
    lifecycle: {
      signal: new AbortController().signal,
      onDispose(listener: () => void) { listeners.set("dispose", listener); return unsubscribes[unsubscribeIndex++]!; }
    }
  } as unknown as TuiPluginApi;

  return {
    api,
    commands,
    registrations,
    dispose() { listeners.get("dispose")?.(); },
    unsubscribes
  };
}

describe("OpenCode TUI plugin load contract", () => {
  it("exports one plugin id with a tui registration hook", () => {
    expect(plugin.id).toBe("opencode-cli-usage-meter");
    expect(plugin.tui).toBeTypeOf("function");
    expect(PLUGIN_CONTRACT.SIDEBAR_SLOT).toBe("sidebar_content");
  });

  it("registers one public sidebar plugin and cleans six subscriptions through idempotent lifecycle disposal", async () => {
    const fake = createFakeTuiApi();

    await plugin.tui(fake.api, undefined, {} as never);

    expect(fake.registrations).toHaveLength(1);
    expect(fake.registrations[0]?.slots).toHaveProperty("sidebar_content");
    fake.dispose();
    fake.dispose();
    for (const unsubscribe of fake.unsubscribes) expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("refreshes provider display through the registered public manual action", async () => {
    let codexOutput = "5h usage: 42% remaining · resets in 1h\nWeekly usage: 77% remaining · resets Sunday";
    let claudeOutput = "Session 5h: 64% remaining · resets in 2h\nWeekly all models: 21% remaining\nModel Opus: 12% remaining";
    const run = vi.fn(({ executable }: { executable: string }) => Promise.resolve({ status: PROCESS_STATUS.SUCCESS, output: executable === "codex" ? codexOutput : claudeOutput }));
    const ptyRun = vi.fn().mockResolvedValue({ status: PROCESS_STATUS.UNAVAILABLE, output: "" });
    const fake = createFakeTuiApi();
    await createUsageMeterTuiPlugin({ platform: "linux", transport: { run }, ptyTransport: { run: ptyRun } }).tui(fake.api, undefined, {} as never);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect((fake.registrations[0]!.slots.sidebar_content() as { props: { children: readonly [{ props: object }, { props: { children: () => string } }] } }).props.children[1].props.children()).toContain("Weekly 77%"));
    await Promise.all(run.mock.results.map((result) => result.value));
    await Promise.resolve();
    codexOutput = "5h usage: 73% remaining · resets in 2h\nWeekly usage: 44% remaining";
    claudeOutput = "No quota";

    expect(fake.commands.map((command) => command.name)).toEqual(["usage.refresh", "usage.toggle"]);
    expect(fake.commands[0]).toMatchObject({ name: "usage.refresh", title: "Refresh CLI usage" });
    await fake.commands[0]!.run();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(4));

    const rendered = fake.registrations[0]!.slots.sidebar_content() as { props: { children: readonly [{ props: object }, { props: { children: () => string } }] } };
    expect(rendered.props.children[1].props.children()).toContain("Codex");
    expect(rendered.props.children[1].props.children()).toContain("5h 73% · Resets 2h");
    expect(rendered.props.children[1].props.children()).toContain("Weekly 44%");
    expect(rendered.props.children[1].props.children()).toContain("Claude: Data unavailable");
    await fake.commands[1]!.run();
    expect(rendered.props.children[1].props.children()).toBe("1/2");
    codexOutput = "malformed";
    await fake.commands[0]!.run();
    expect(rendered.props.children[1].props.children()).toBe("Data unavailable");
    expect(ptyRun).toHaveBeenCalledOnce();
    fake.dispose();
    fake.dispose();
  });

  it("diagnoses public slot registration failure without exposing provider output", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = {
      slots: { register: () => { throw new Error("provider secret output"); } }
    } as unknown as TuiPluginApi;

    await expect(plugin.tui(api, undefined, {} as never)).resolves.toBeUndefined();

    expect(diagnostic).toHaveBeenCalledWith("Usage meter sidebar registration failed");
    expect(diagnostic).not.toHaveBeenCalledWith(expect.stringContaining("secret"));
    expect(diagnostic).toHaveBeenCalledOnce();
  });

  it("keeps the unavailable sidebar renderer deterministic", () => {
    expect(renderUnavailableUsage()).toEqual(["CLI Usage", "Data unavailable"]);
  });

  it("replaces loading immediately on Windows without starting a process", async () => {
    const run = vi.fn();
    const windowsPlugin = createUsageMeterTuiPlugin({ platform: "win32", transport: { run } });
    const fake = createFakeTuiApi();
    await windowsPlugin.tui(fake.api, undefined, {} as never);
    await Promise.resolve();
    expect(fake.registrations).toHaveLength(1);
    const rendered = fake.registrations[0]!.slots.sidebar_content() as { props: { children: readonly [{ props: { children: string } }, { props: { children: () => string } }] } };
    expect(rendered.props.children[1].props.children()).toBe("Codex: Data unavailable\nClaude: Data unavailable");
    expect(run).not.toHaveBeenCalled();
    fake.dispose();
  });

  it("rejects credential-like fixture text before provider fixtures land", () => {
    expect(assertFixtureTextIsSafe("fixtures/codex/status.txt", "usage: 42%"))
      .toBe("usage: 42%");
    expect(() =>
      assertFixtureTextIsSafe("fixtures/claude/usage.txt", "session token=secret")
    ).toThrow("Unsafe fixture content");
  });
});
