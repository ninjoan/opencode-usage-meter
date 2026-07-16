import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { Terminal } from "@xterm/headless";
import { PROCESS_STATUS, type ProcessResult, type ProcessStatus } from "./process.js";

export const INTERACTIVE_PTY_STATE = { SPAWNING: "spawning", STARTUP: "startup", READY: "ready", COMMAND_SENT: "command-sent", WAITING: "waiting", STABLE: "stable", CAPTURED: "captured", CLOSING: "closing", DONE: "done" } as const;
export type InteractivePtyState = (typeof INTERACTIVE_PTY_STATE)[keyof typeof INTERACTIVE_PTY_STATE];
export interface ScreenSnapshot { readonly lines: readonly string[]; readonly text: string; }
export interface InteractivePtyRequest {
  readonly executable: string; readonly args: readonly string[]; readonly command: string;
  readonly cwd: string; readonly env: Readonly<Record<string, string | undefined>>;
  readonly ready: (screen: ScreenSnapshot) => boolean; readonly complete: (screen: ScreenSnapshot) => boolean;
  readonly timeoutMs: number; readonly startupTimeoutMs: number; readonly stabilityMs: number;
  readonly cols: number; readonly rows: number; readonly signal?: AbortSignal;
}
export interface InteractivePtyProcess {
  kill(): void; write(data: string): void;
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number }) => void): { dispose(): void };
}
export interface InteractivePtySpawnOptions { readonly cols: number; readonly rows: number; readonly cwd: string; readonly env: Record<string, string>; readonly name: string; }
export type InteractivePtySpawn = (file: string, args: string[], options: InteractivePtySpawnOptions) => InteractivePtyProcess;
export interface InteractivePtyDependencies {
  readonly spawn?: InteractivePtySpawn; readonly loadPty?: () => Promise<{ spawn: InteractivePtySpawn }>;
  readonly findExecutable?: (name: string, path: string) => string | undefined; readonly isExecutable?: (path: string) => boolean;
  readonly path?: string; readonly platform?: NodeJS.Platform;
}
export interface InteractivePtyTransport { run(request: InteractivePtyRequest): Promise<ProcessResult>; }

const MAX_BYTES = 64 * 1024;
function executable(path: string): boolean { try { return statSync(path).isFile() && (accessSync(path, constants.X_OK), true); } catch { return false; } }
function find(name: string, path: string): string | undefined { return path.split(delimiter).map((part) => join(part, name)).find(executable); }
function candidateFor(name: string, path: string, locate: (name: string, path: string) => string | undefined): string | undefined {
  return isAbsolute(name) ? name : name.includes("/") || name.includes("\\") ? undefined : locate(name, path);
}

export function createInteractivePtyTransport(deps: InteractivePtyDependencies = {}): InteractivePtyTransport {
  const path = deps.path ?? process.env.PATH ?? ""; const platform = deps.platform ?? process.platform;
  const locate = deps.findExecutable ?? find; const verify = deps.isExecutable ?? executable;
  return { async run(request) {
    if (platform === "win32") return { status: PROCESS_STATUS.UNAVAILABLE, output: "" };
    if (request.cwd.trim() === "") return { status: PROCESS_STATUS.UNAVAILABLE, output: "" };
    if (request.signal?.aborted) return { status: PROCESS_STATUS.CANCELLED, output: "" };
    const candidate = candidateFor(request.executable, path, locate);
    if (candidate === undefined || !isAbsolute(candidate) || !verify(candidate)) return { status: PROCESS_STATUS.UNAVAILABLE, output: "" };
    let launch = deps.spawn;
    if (launch === undefined) { try { launch = (await (deps.loadPty?.() ?? import("node-pty"))).spawn; } catch { return { status: PROCESS_STATUS.UNAVAILABLE, output: "" }; } }
    if (request.signal?.aborted) return { status: PROCESS_STATUS.CANCELLED, output: "" };
    return new Promise((resolve) => {
      const terminal = new Terminal({ cols: request.cols, rows: request.rows, allowProposedApi: true, scrollback: 0 });
      let child: InteractivePtyProcess | undefined; let state: InteractivePtyState = INTERACTIVE_PTY_STATE.SPAWNING;
      let bytes = 0; let commandSent = false; let settled = false;
      let overall: ReturnType<typeof setTimeout> | undefined; let startup: ReturnType<typeof setTimeout> | undefined; let stable: ReturnType<typeof setTimeout> | undefined;
      const disposables: Array<{ dispose(): void }> = [];
      const snapshot = (): ScreenSnapshot => {
        const lines = Array.from({ length: terminal.rows }, (_, index) => terminal.buffer.active.getLine(terminal.buffer.active.viewportY + index)?.translateToString(true) ?? "");
        while (lines.at(-1) === "") lines.pop();
        return Object.freeze({ lines: Object.freeze(lines), text: lines.join("\n") });
      };
      const cleanup = () => {
        state = INTERACTIVE_PTY_STATE.CLOSING; for (const timer of [overall, startup, stable]) if (timer !== undefined) clearTimeout(timer);
        request.signal?.removeEventListener("abort", abort); for (const disposable of disposables.splice(0)) try { disposable.dispose(); } catch {}
        try { terminal.dispose(); } catch {} try { child?.write("\u001b"); child?.write("\u0003"); } catch {} try { child?.kill(); } catch {} state = INTERACTIVE_PTY_STATE.DONE;
      };
      const finish = (status: ProcessStatus, output = "") => { if (settled) return; settled = true; cleanup(); resolve({ status, output }); };
      const abort = () => finish(request.signal?.aborted ? PROCESS_STATUS.CANCELLED : PROCESS_STATUS.TIMED_OUT);
      const guard = (action: () => void) => { if (settled) return; try { action(); } catch { finish(PROCESS_STATUS.FAILED); } };
      const keep = (disposable: { dispose(): void }) => { if (settled) { try { disposable.dispose(); } catch {} } else disposables.push(disposable); };
      const inspect = () => {
        if (settled) return; const screen = snapshot();
        if (!commandSent && request.ready(screen)) {
          state = INTERACTIVE_PTY_STATE.READY; commandSent = true; if (startup !== undefined) clearTimeout(startup);
          state = INTERACTIVE_PTY_STATE.COMMAND_SENT; child?.write(`${request.command}\r`); state = INTERACTIVE_PTY_STATE.WAITING;
        }
        if (commandSent && request.complete(screen)) {
          state = INTERACTIVE_PTY_STATE.STABLE; if (stable !== undefined) clearTimeout(stable);
          stable = setTimeout(() => guard(() => { const captured = snapshot(); if (!request.complete(captured)) return; const output = captured.text; if (Buffer.byteLength(output) > MAX_BYTES) finish(PROCESS_STATUS.FAILED); else { state = INTERACTIVE_PTY_STATE.CAPTURED; finish(PROCESS_STATUS.SUCCESS, output); } }), request.stabilityMs);
        } else if (stable !== undefined) { clearTimeout(stable); stable = undefined; state = INTERACTIVE_PTY_STATE.WAITING; }
      };
      try {
        const env = Object.fromEntries(Object.entries(request.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
        child = launch(candidate, [...request.args], { cols: request.cols, rows: request.rows, cwd: request.cwd, env, name: "xterm" }); state = INTERACTIVE_PTY_STATE.STARTUP;
        keep(child.onData((data) => guard(() => {
          bytes += Buffer.byteLength(data); if (bytes > MAX_BYTES) { finish(PROCESS_STATUS.FAILED); return; }
          terminal.write(data, () => guard(inspect));
        })));
        if (settled) return; keep(child.onExit(() => finish(PROCESS_STATUS.FAILED)));
        if (settled) return; startup = setTimeout(abort, request.startupTimeoutMs); overall = setTimeout(abort, request.timeoutMs);
        request.signal?.addEventListener("abort", abort, { once: true }); if (request.signal?.aborted) abort();
      } catch { finish(PROCESS_STATUS.FAILED); }
    });
  } };
}
