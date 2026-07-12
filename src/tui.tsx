export const PLUGIN_CONTRACT = {
  ID: "opencode-cli-usage-meter",
  SIDEBAR_SLOT: "sidebar_content",
  TITLE: "CLI Usage",
  UNAVAILABLE_COPY: "Data unavailable"
} as const;

export type PluginId = (typeof PLUGIN_CONTRACT)["ID"];
export type SidebarSlot = (typeof PLUGIN_CONTRACT)["SIDEBAR_SLOT"];
export type SidebarContent = readonly [
  (typeof PLUGIN_CONTRACT)["TITLE"],
  (typeof PLUGIN_CONTRACT)["UNAVAILABLE_COPY"]
];

export interface SidebarRegistration {
  dispose(): void;
}

export interface SidebarContentRegistrar {
  register(slot: SidebarSlot, render: () => SidebarContent): unknown;
}

export interface TuiApi {
  readonly slots: SidebarContentRegistrar;
}

export interface UsageMeterPlugin {
  readonly id: PluginId;
  tui(api: TuiApi): SidebarRegistration;
}

interface DisposeFunction {
  (): void;
}

export function renderUnavailableUsage(): SidebarContent {
  return [PLUGIN_CONTRACT.TITLE, PLUGIN_CONTRACT.UNAVAILABLE_COPY];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSidebarRegistration(value: unknown): value is SidebarRegistration {
  return isObject(value) && typeof value.dispose === "function";
}

function toSidebarRegistration(registration: unknown): SidebarRegistration {
  if (isSidebarRegistration(registration)) {
    return registration;
  }

  if (typeof registration === "function") {
    const dispose = registration as DisposeFunction;
    return { dispose };
  }

  return {
    dispose() {
      return undefined;
    }
  };
}

export function registerUsageSidebar(api: TuiApi): SidebarRegistration {
  try {
    return toSidebarRegistration(
      api.slots.register(PLUGIN_CONTRACT.SIDEBAR_SLOT, renderUnavailableUsage)
    );
  } catch {
    console.error("Usage meter sidebar registration failed");
    return toSidebarRegistration(undefined);
  }
}

const plugin = {
  id: PLUGIN_CONTRACT.ID,
  tui: registerUsageSidebar
} satisfies UsageMeterPlugin;

export default plugin;
