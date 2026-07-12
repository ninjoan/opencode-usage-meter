import { PROVIDER_LABEL, USAGE_STATUS, clampPercentRemaining, type Provider, type ProviderUsageWindow, type UsageDisplay, type UsageSnapshot } from "../domain/usage.js";
export type SidebarSection = readonly [string, string];
export interface SidebarWindowRow { readonly accessibleText: string; readonly bar: string; readonly label: string; readonly percentRemaining: number; readonly text: string; }
export interface SidebarProviderRow { readonly label: string; readonly provider: Provider; readonly status: string; readonly summary: string; readonly windows: readonly SidebarWindowRow[]; }
const BAR_WIDTH = 10;
function progressBar(percentRemaining: number): string { const filled = Math.round(clampPercentRemaining(percentRemaining) / 10); return "█".repeat(filled).padEnd(BAR_WIDTH, "░"); }
function text(window: ProviderUsageWindow, withLabel: boolean): string { const percent = clampPercentRemaining(window.percentRemaining); return `${withLabel ? `${window.label} ` : ""}${percent}%${window.reset === undefined ? "" : ` · Resets ${window.reset}`}`; }
export function renderWindowRow(providerLabel: string, window: ProviderUsageWindow): SidebarWindowRow {
  const percent = clampPercentRemaining(window.percentRemaining);
  return { accessibleText: `${providerLabel} ${window.label} ${percent}% remaining${window.reset === undefined ? "" : `, resets ${window.reset}`}`, bar: progressBar(percent), label: window.label, percentRemaining: percent, text: text(window, true) };
}
export function renderSnapshotRow(snapshot: UsageSnapshot): SidebarProviderRow {
  if (snapshot.status !== USAGE_STATUS.AVAILABLE || snapshot.windows.length === 0) {
    return { label: snapshot.label, provider: snapshot.provider, status: snapshot.status, summary: "Data unavailable", windows: [] };
  }
  return { label: snapshot.label, provider: snapshot.provider, status: snapshot.status, summary: text(snapshot.windows[0]!, false), windows: snapshot.windows.map((window) => renderWindowRow(snapshot.label, window)) };
}
export function renderSidebarSection(provider: Provider, usage: UsageDisplay): SidebarSection {
  const label = PROVIDER_LABEL[provider];
  if (usage.status === USAGE_STATUS.LOADING) return [label, "Loading…"];
  return [label, renderSnapshotRow(usage).summary];
}
