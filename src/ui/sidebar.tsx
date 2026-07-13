import {
  PROVIDER,
  PROVIDER_LABEL,
  PROVIDER_ORDER,
  USAGE_STATUS,
  orderUsageSnapshots,
  unavailableSnapshot,
  type Provider,
  type UsageDisplay,
  type UsageSnapshot
} from "../domain/usage.js";
import {
  renderSidebarSection,
  renderSnapshotRow,
  type SidebarProviderRow,
  type SidebarSection
} from "./sidebar-section.js";

export interface SidebarView {
  readonly expanded: boolean;
  readonly rows: readonly SidebarProviderRow[];
  readonly summary: string;
  readonly title: string;
}

export interface SidebarExpansionState {
  dispose(): void;
  expanded(): boolean;
  toggle(): void;
}

export function createSidebarExpansionState(): SidebarExpansionState {
  let value = true;
  return {
    dispose() {
      value = true;
    },
    expanded: () => value,
    toggle() {
      value = !value;
    }
  };
}

function providerSnapshot(provider: Provider, snapshots: readonly UsageSnapshot[]): UsageSnapshot {
  return snapshots.find((snapshot) => snapshot.provider === provider) ?? unavailableSnapshot(provider, 0);
}

export function renderProviderRow(snapshot: UsageSnapshot): SidebarProviderRow {
  return renderSnapshotRow(snapshot);
}

export function renderUsageSidebar(displays: readonly UsageDisplay[], expanded: boolean): SidebarView {
  const snapshots = orderUsageSnapshots(
    displays.filter((display): display is UsageSnapshot => display.status !== USAGE_STATUS.LOADING)
  );
  const complete = PROVIDER_ORDER.map((provider) => providerSnapshot(provider, snapshots));
  const rows = complete.map(renderProviderRow);
  const available = rows.filter((row) => row.status === USAGE_STATUS.AVAILABLE && row.windows.length > 0).length;

  return {
    expanded,
    rows,
    summary: available === 0 ? "Data unavailable" : `${available}/${PROVIDER_ORDER.length}`,
    title: "CLI Usage"
  };
}

function visibleWindowText(text: string, width?: number): string {
  if (width === undefined || text.length <= width) return text;
  const percent = text.match(/\s\d{1,3}%/)?.[0]?.trim();
  if (percent === undefined) return `${text.slice(0, Math.max(1, width - 1))}…`;
  const label = text.slice(0, text.indexOf(percent)).trimEnd();
  const maxLabel = Math.max(1, Math.min(9, width - percent.length - 3));
  return `${label.length > maxLabel ? `${label.slice(0, maxLabel)}…` : label} ${percent}`;
}

export function formatSidebarBody(view: SidebarView, width?: number): string {
  if (!view.expanded) return view.summary;
  return view.rows.map((row) => {
    if (row.windows.length === 0) return `${row.label}: ${row.summary}`;
    const windows = row.windows.map((window) => `  ${visibleWindowText(window.text, width)} ${window.bar} accessibleText: ${window.accessibleText}`);
    return [row.label, ...windows].join("\n");
  }).join("\n");
}

export function renderCodexSidebar(usage: UsageDisplay): SidebarSection {
  return renderSidebarSection(PROVIDER.CODEX, usage);
}

export function providerUnavailableSnapshots(now: () => number): UsageSnapshot[] {
  return PROVIDER_ORDER.map((provider) => ({
    provider,
    label: PROVIDER_LABEL[provider],
    status: USAGE_STATUS.UNAVAILABLE,
    windows: [],
    refreshedAt: now()
  }));
}
