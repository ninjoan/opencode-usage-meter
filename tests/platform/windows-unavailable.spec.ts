import { describe, expect, it, vi } from "vitest";

import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { SafeProcessTransport } from "../../src/transport/process.js";

vi.mock("@opentui/solid/jsx-runtime", () => ({
  jsx: (type: string, props: object) => ({ type, props }),
  jsxs: (type: string, props: object) => ({ type, props })
}));

const { createUsageMeterTuiPlugin } = await import("../../src/tui.js");

function createApi() {
  const registrations: Array<{ readonly slots: { readonly sidebar_content: () => { readonly props: { readonly children: readonly unknown[] } } } }> = [];
  const api = {
    slots: { register: (slot: never) => { registrations.push(slot); return "slot-id"; } },
    keymap: { registerLayer: () => vi.fn() },
    event: { on: () => vi.fn() },
    lifecycle: { signal: new AbortController().signal, onDispose: () => vi.fn() }
  } as unknown as TuiPluginApi;
  return { api, registrations };
}

describe("Windows unsupported runtime", () => {
  it("renders unavailable for every provider without executing commands", async () => {
    const run = vi.fn();
    const fake = createApi();

    await createUsageMeterTuiPlugin({ platform: "win32", transport: { run } satisfies SafeProcessTransport }).tui(fake.api, undefined, {} as never);
    await Promise.resolve();

    const sidebar = fake.registrations[0]?.slots.sidebar_content() as { readonly props: { readonly children: readonly [{ readonly props: object }, { readonly props: { readonly children: () => string } }] } };
    expect(sidebar.props.children[1].props.children()).toBe("Codex: Data unavailable\nClaude: Data unavailable");
    expect(run).not.toHaveBeenCalled();
  });
});
