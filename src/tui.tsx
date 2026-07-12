export const PLUGIN_CONTRACT = {
  REFRESH_COMMAND: "usage.refresh",
  REFRESH_TITLE: "Refresh CLI usage",
  TOGGLE_COMMAND: "usage.toggle",
  TOGGLE_TITLE: "Toggle CLI usage",
  ID: "opencode-cli-usage-meter",
  SIDEBAR_SLOT: "sidebar_content",
  TITLE: "CLI Usage",
  UNAVAILABLE_COPY: "Data unavailable"
} as const;

import { createSignal, type JSX } from "solid-js";
import { jsx, jsxs } from "@opentui/solid/jsx-runtime";
import type { TuiPluginApi, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import { PROVIDER, PROVIDER_LABEL, orderUsageSnapshots, type Provider, type ProviderAdapter, type UsageSnapshot } from "./domain/usage.js";
import { createProviderGates } from "./gates/provider-gates.js";
import { createClaudeProvider } from "./providers/claude.js";
import { createCodexProvider } from "./providers/codex.js";
import { createProviderRegistry } from "./providers/registry.js";
import { createRefreshScheduler } from "./scheduler/refresh.js";
import { createAdaptiveActivityController, type ActivityEventSource } from "./state/activity.js";
import { createUsageCache } from "./state/cache.js";
import { createPtyProcessTransport, createSafeProcessTransport, type PtyTransportDependencies, type SafeProcessTransport } from "./transport/process.js";
import { createSidebarExpansionState, formatSidebarBody, providerUnavailableSnapshots, renderUsageSidebar } from "./ui/sidebar.js";

export type PluginId = (typeof PLUGIN_CONTRACT)["ID"];
export type SidebarSlot = (typeof PLUGIN_CONTRACT)["SIDEBAR_SLOT"];
export type SidebarContent = readonly [string, string];
export interface UsageMeterDependencies { readonly activitySource?: ActivityEventSource; readonly now?: () => number; readonly platform?: NodeJS.Platform; readonly ptyTransport?: SafeProcessTransport; readonly ptyTransportFactory?: (dependencies: PtyTransportDependencies) => SafeProcessTransport; readonly transport?: SafeProcessTransport; }

export function renderUnavailableUsage(): SidebarContent {
  return [PLUGIN_CONTRACT.TITLE, PLUGIN_CONTRACT.UNAVAILABLE_COPY];
}

function activitySource(api: TuiPluginApi): ActivityEventSource { return { onInteraction(listener) { const a = api.event.on("session.next.prompted", listener); const b = api.event.on("session.next.prompt.admitted", listener); return () => { a(); b(); }; }, onActive(listener) { return api.event.on("session.status", (event) => { if (event.properties.status.type === "busy") listener(); }); }, onInactive(listener) { const a = api.event.on("session.status", (event) => { if (event.properties.status.type === "idle") listener(); }); const b = api.event.on("session.idle", listener); return () => { a(); b(); }; }, isResourceConstrained: () => false }; }

function updateSnapshot(snapshots: readonly UsageSnapshot[], snapshot: UsageSnapshot): UsageSnapshot[] {
  return orderUsageSnapshots([...snapshots.filter((candidate) => candidate.provider !== snapshot.provider), snapshot]);
}

function renderSidebar(snapshots: () => readonly UsageSnapshot[], expanded: () => boolean, disposed: () => boolean): JSX.Element {
  const view = () => renderUsageSidebar(disposed() ? [] : snapshots(), expanded());
  const body = () => {
    if (disposed()) return PLUGIN_CONTRACT.UNAVAILABLE_COPY;
    const current = view();
    return formatSidebarBody(current);
  };
  return jsxs("box", { flexDirection: "column", children: [jsx("text", { children: PLUGIN_CONTRACT.TITLE }), jsx("text", { children: body })] });
}

export function createUsageMeterTuiPlugin(dependencies: UsageMeterDependencies = {}): TuiPluginModule { const now = dependencies.now ?? (() => Date.now()); const platform = dependencies.platform ?? process.platform; const transport = dependencies.transport ?? createSafeProcessTransport({ platform }); const ptyTransport = dependencies.ptyTransport ?? (dependencies.ptyTransportFactory ?? createPtyProcessTransport)({ platform }); return { id: PLUGIN_CONTRACT.ID, async tui(api) { const [snapshots, setSnapshots] = createSignal<readonly UsageSnapshot[]>(providerUnavailableSnapshots(now)); const [disposed, setDisposed] = createSignal(false); const expansion = createSidebarExpansionState(); const codexProvider = createCodexProvider(transport, now, platform); const claudeProvider = createClaudeProvider(transport, now, platform, ptyTransport); const adapter = (provider: Provider, refresh: (signal?: AbortSignal) => Promise<UsageSnapshot>, order: number): ProviderAdapter => ({ provider, label: PROVIDER_LABEL[provider], order, refresh }); const registry = createProviderRegistry([adapter(PROVIDER.CODEX, (signal) => codexProvider.refresh(signal), 10), adapter(PROVIDER.CLAUDE, (signal) => claudeProvider.refresh(signal), 20)]); const scheduler = createRefreshScheduler(registry.adapters, createUsageCache(), createProviderGates(), now, (value) => setSnapshots((current) => updateSnapshot(current, value))); try { const sidebar: TuiSlotPlugin = { slots: { sidebar_content: () => renderSidebar(snapshots, expansion.expanded, disposed) } }; api.slots.register(sidebar); } catch { console.error("Usage meter sidebar registration failed"); return; } const unregisterCommand = api.keymap.registerLayer({ commands: [{ name: PLUGIN_CONTRACT.REFRESH_COMMAND, title: PLUGIN_CONTRACT.REFRESH_TITLE, run: () => scheduler.refreshNow() }, { name: PLUGIN_CONTRACT.TOGGLE_COMMAND, title: PLUGIN_CONTRACT.TOGGLE_TITLE, run: async () => { expansion.toggle(); } }] }); const activity = createAdaptiveActivityController(scheduler, dependencies.activitySource ?? activitySource(api)); activity.start(); void scheduler.refreshNow(); let closed = false; const dispose = () => { if (closed) return; closed = true; unregisterCommand(); activity.dispose(); scheduler.dispose(); expansion.dispose(); setDisposed(true); setSnapshots(providerUnavailableSnapshots(now)); }; api.lifecycle.onDispose(dispose); api.lifecycle.signal.addEventListener("abort", dispose, { once: true }); } }; }
const plugin = createUsageMeterTuiPlugin();

export default plugin;
