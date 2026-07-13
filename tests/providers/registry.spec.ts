import { describe, expect, it, vi } from "vitest";

import { PROVIDER, PROVIDER_LABEL, USAGE_STATUS, type Provider, type ProviderAdapter } from "../../src/domain/usage.js";
import { createProviderRegistry } from "../../src/providers/registry.js";

function adapter(provider: Provider, order: number, refresh = vi.fn()) {
  return { provider, label: PROVIDER_LABEL[provider], order, refresh } satisfies ProviderAdapter;
}

describe("usage provider registry", () => {
  it("orders explicit adapters as Codex, Claude, then future adapters", () => {
    const codex = adapter(PROVIDER.CODEX, 10);
    const claude = adapter(PROVIDER.CLAUDE, 20);

    const registry = createProviderRegistry([claude, codex]);

    expect(registry.adapters.map((item) => item.provider)).toEqual([PROVIDER.CODEX, PROVIDER.CLAUDE]);
    expect(registry.adapters.map((item) => item.label)).toEqual(["Codex", "Claude"]);
  });

  it("does not infer supported quota providers from host OpenCode provider names", async () => {
    const codex = adapter(PROVIDER.CODEX, 10, vi.fn(async () => ({ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 42 }], refreshedAt: 1 })));

    const registry = createProviderRegistry([codex]);

    await expect(registry.adapters[0]?.refresh(new AbortController().signal)).resolves.toMatchObject({ provider: PROVIDER.CODEX });
    expect(registry.adapters).toHaveLength(1);
    expect(registry.adapters.some((adapter) => adapter.provider === PROVIDER.CLAUDE)).toBe(false);
  });
});
