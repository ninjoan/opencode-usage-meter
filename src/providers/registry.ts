import { providerOrder, type ProviderAdapter, type ProviderRegistry } from "../domain/usage.js";

export function createProviderRegistry(adapters: readonly ProviderAdapter[]): ProviderRegistry {
  return {
    adapters: adapters
      .map((adapter, index) => ({ adapter, index }))
      .sort(
        (a, b) =>
          providerOrder(a.adapter.provider) - providerOrder(b.adapter.provider) ||
          a.adapter.order - b.adapter.order ||
          a.index - b.index
      )
      .map(({ adapter }) => adapter)
  };
}
