/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { createSidebarExpansionState } from "../../src/ui/sidebar.js";

describe("sidebar expansion state", () => {
  it("defaults expanded, toggles in session memory, and clears on disposal", () => {
    const state = createSidebarExpansionState();

    expect(state.expanded()).toBe(true);
    state.toggle();
    expect(state.expanded()).toBe(false);
    state.toggle();
    expect(state.expanded()).toBe(true);
    state.dispose();
    expect(state.expanded()).toBe(true);
  });
});
