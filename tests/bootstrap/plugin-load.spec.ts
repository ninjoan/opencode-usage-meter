import { describe, expect, it, vi } from "vitest";

import plugin, {
  PLUGIN_CONTRACT,
  renderUnavailableUsage,
  type SidebarContent,
  type TuiApi
} from "../../src/tui.js";
import { assertFixtureTextIsSafe } from "../support/fixture-policy.js";

interface RegisteredSidebarContent {
  readonly slot: string;
  readonly render: () => SidebarContent;
}

function createFakeTuiApi() {
  const registrations: RegisteredSidebarContent[] = [];
  let disposeCount = 0;

  const api = {
    slots: {
      register(slot, render) {
        registrations.push({ slot, render });
        return {
          dispose() {
            disposeCount += 1;
          }
        };
      }
    }
  } satisfies TuiApi;

  return {
    api,
    registrations,
    getDisposeCount() {
      return disposeCount;
    }
  };
}

describe("OpenCode TUI plugin load contract", () => {
  it("exports one plugin id with a tui registration hook", () => {
    expect(plugin.id).toBe("opencode-cli-usage-meter");
    expect(plugin.tui).toBeTypeOf("function");
    expect(PLUGIN_CONTRACT.SIDEBAR_SLOT).toBe("sidebar_content");
  });

  it("registers only sidebar_content and renders the fail-soft copy", () => {
    const fake = createFakeTuiApi();

    const registration = plugin.tui(fake.api);

    expect(fake.registrations).toHaveLength(1);
    expect(fake.registrations[0]?.slot).toBe("sidebar_content");
    expect(fake.registrations[0]?.render()).toEqual([
      "CLI Usage",
      "Data unavailable"
    ]);

    registration.dispose();
    expect(fake.getDisposeCount()).toBe(1);
  });

  it("diagnoses registration failure without throwing or leaking disposal", () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = {
      slots: { register: () => { throw new Error("provider secret output"); } }
    } satisfies TuiApi;

    const registration = plugin.tui(api);

    expect(diagnostic).toHaveBeenCalledWith("Usage meter sidebar registration failed");
    expect(diagnostic).not.toHaveBeenCalledWith(expect.stringContaining("secret"));
    expect(() => registration.dispose()).not.toThrow();
    expect(diagnostic).toHaveBeenCalledOnce();
  });

  it("keeps the unavailable sidebar renderer deterministic", () => {
    expect(renderUnavailableUsage()).toEqual(["CLI Usage", "Data unavailable"]);
  });

  it("rejects credential-like fixture text before provider fixtures land", () => {
    expect(assertFixtureTextIsSafe("fixtures/codex/status.txt", "usage: 42%"))
      .toBe("usage: 42%");
    expect(() =>
      assertFixtureTextIsSafe("fixtures/claude/usage.txt", "session token=secret")
    ).toThrow("Unsafe fixture content");
  });
});
