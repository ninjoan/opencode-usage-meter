import { describe, expect, it, vi } from "vitest";

import plugin, {
  PLUGIN_CONTRACT,
  createUsageMeterTuiPlugin,
  renderUnavailableUsage
} from "../../src/tui.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { assertFixtureTextIsSafe } from "../support/fixture-policy.js";

interface RegisteredSidebarContent { readonly id: string; readonly slots: object; }

function createFakeTuiApi() {
  const registrations: RegisteredSidebarContent[] = [];
  const listeners = new Map<string, () => void>();
  const unsubscribes = Array.from({ length: 5 }, () => vi.fn());
  let unsubscribeIndex = 0;

  const api = {
    slots: {
      register(sidebar: unknown) { registrations.push(sidebar as RegisteredSidebarContent); return "usage-meter-slot"; }
    },
    event: { on(type: string, listener: () => void) { listeners.set(type, listener); return unsubscribes[unsubscribeIndex++]!; } },
    lifecycle: {
      signal: new AbortController().signal,
      onDispose(listener: () => void) { listeners.set("dispose", listener); return unsubscribes[unsubscribeIndex++]!; }
    }
  } as unknown as TuiPluginApi;

  return {
    api,
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

  it("registers one public sidebar plugin and cleans five subscriptions through idempotent lifecycle disposal", async () => {
    const fake = createFakeTuiApi();

    await plugin.tui(fake.api, undefined, {} as never);

    expect(fake.registrations).toHaveLength(1);
    expect(fake.registrations[0]?.slots).toHaveProperty("sidebar_content");
    fake.dispose();
    fake.dispose();
    for (const unsubscribe of fake.unsubscribes) expect(unsubscribe).toHaveBeenCalledOnce();
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
    expect(renderUnavailableUsage()).toEqual(["CLI Usage", "Data unavailable"]);
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
