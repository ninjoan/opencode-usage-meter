export const PLUGIN_CONTRACT = {
  REFRESH_COMMAND: "usage.refresh",
  REFRESH_TITLE: "Refresh CLI usage",
  ID: "opencode-cli-usage-meter",
  SIDEBAR_SLOT: "sidebar_content",
  TITLE: "CLI Usage",
  UNAVAILABLE_COPY: "Data unavailable"
} as const;

import { createSignal, type JSX } from "solid-js";
import { jsx, jsxs } from "@opentui/solid/jsx-runtime";
import type { TuiPluginApi, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import { PROVIDER, USAGE_STATUS, type UsageDisplay } from "./domain/usage.js";
import { createProviderGates } from "./gates/provider-gates.js";
import { createCodexProvider } from "./providers/codex.js";
import { createRefreshScheduler } from "./scheduler/refresh.js";
import { createAdaptiveActivityController, type ActivityEventSource } from "./state/activity.js";
import { createUsageCache } from "./state/cache.js";
import { createSafeProcessTransport, type SafeProcessTransport } from "./transport/process.js";
import { renderCodexSidebar } from "./ui/sidebar.js";

export type PluginId = (typeof PLUGIN_CONTRACT)["ID"];
export type SidebarSlot = (typeof PLUGIN_CONTRACT)["SIDEBAR_SLOT"];
export type SidebarContent = readonly [string, string];
export interface UsageMeterDependencies { readonly activitySource?: ActivityEventSource; readonly now?: () => number; readonly platform?: NodeJS.Platform; readonly transport?: SafeProcessTransport; }

export function renderUnavailableUsage(): SidebarContent {
  return [PLUGIN_CONTRACT.TITLE, PLUGIN_CONTRACT.UNAVAILABLE_COPY];
}

function activitySource(api: TuiPluginApi): ActivityEventSource { return { onInteraction(listener) { const a = api.event.on("session.next.prompted", listener); const b = api.event.on("session.next.prompt.admitted", listener); return () => { a(); b(); }; }, onActive(listener) { return api.event.on("session.status", (event) => { if (event.properties.status.type === "busy") listener(); }); }, onInactive(listener) { const a = api.event.on("session.status", (event) => { if (event.properties.status.type === "idle") listener(); }); const b = api.event.on("session.idle", listener); return () => { a(); b(); }; }, isResourceConstrained: () => false }; }
function renderSidebar(display: () => UsageDisplay): JSX.Element { const section = () => display().status === USAGE_STATUS.LOADING ? ["Codex", "Loading…"] as const : renderCodexSidebar(display()); return jsxs("box", { flexDirection: "column", children: [jsx("text", { children: PLUGIN_CONTRACT.TITLE }), jsx("text", { children: () => display().status === USAGE_STATUS.UNAVAILABLE ? PLUGIN_CONTRACT.UNAVAILABLE_COPY : `${section()[0]}: ${section()[1]}` })] }); }
export function createUsageMeterTuiPlugin(dependencies: UsageMeterDependencies = {}): TuiPluginModule { const now = dependencies.now ?? (() => Date.now()); const platform = dependencies.platform ?? process.platform; const transport = dependencies.transport ?? createSafeProcessTransport({ platform }); return { id: PLUGIN_CONTRACT.ID, async tui(api) { const [display, setDisplay] = createSignal<UsageDisplay>(platform === "win32" ? { provider: PROVIDER.CODEX, status: USAGE_STATUS.UNAVAILABLE, refreshedAt: now() } : { status: USAGE_STATUS.LOADING }); const scheduler = createRefreshScheduler([{ provider: PROVIDER.CODEX, async refresh(signal) { const value = await createCodexProvider(transport, now, platform).refresh(signal); setDisplay(value); return value; } }], createUsageCache(), createProviderGates(), now); let registrationCleanup: unknown; try { const sidebar: TuiSlotPlugin = { slots: { sidebar_content: () => renderSidebar(display) } }; registrationCleanup = api.slots.register(sidebar); } catch { console.error("Usage meter sidebar registration failed"); return; } const unregisterCommand = api.keymap.registerLayer({ commands: [{ name: PLUGIN_CONTRACT.REFRESH_COMMAND, title: PLUGIN_CONTRACT.REFRESH_TITLE, run: () => scheduler.refreshNow() }] }); const activity = createAdaptiveActivityController(scheduler, dependencies.activitySource ?? activitySource(api)); activity.start(); void scheduler.refreshNow(); let disposed = false; const dispose = () => { if (disposed) return; disposed = true; unregisterCommand(); if (typeof registrationCleanup === "function") registrationCleanup(); activity.dispose(); scheduler.dispose(); setDisplay({ provider: PROVIDER.CODEX, status: USAGE_STATUS.UNAVAILABLE, refreshedAt: now() }); }; api.lifecycle.onDispose(dispose); api.lifecycle.signal.addEventListener("abort", dispose, { once: true }); } }; }
const plugin = createUsageMeterTuiPlugin();

export default plugin;
