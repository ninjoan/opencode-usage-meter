import { PROVIDER, type UsageDisplay } from "../domain/usage.js";
import { renderSidebarSection, type SidebarSection } from "./sidebar-section.js";
export function renderCodexSidebar(usage: UsageDisplay): SidebarSection { return renderSidebarSection(PROVIDER.CODEX, usage); }
