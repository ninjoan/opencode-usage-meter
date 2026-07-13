import { spawn as nodeSpawn } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { sanitizeTerminalText } from "../parsers/terminal.js";

export const PROCESS_STATUS = { BUSY: "busy", CANCELLED: "cancelled", FAILED: "failed", SUCCESS: "success", TIMED_OUT: "timed_out", UNAVAILABLE: "unavailable" } as const;
export type ProcessStatus = (typeof PROCESS_STATUS)[keyof typeof PROCESS_STATUS];
export interface ProcessResult { readonly output: string; readonly requiresTerminal?: boolean; readonly status: ProcessStatus; }
export interface ProcessRequest { readonly args: readonly string[]; readonly executable: string; readonly signal?: AbortSignal; readonly timeoutMs: number; }
export interface SpawnOptions { readonly env: Record<string, string>; readonly onClose: (code: number | null) => void; readonly onData: (chunk: string) => void; readonly onError: () => void; readonly onStderr: (chunk: string) => void; readonly shell: false; }
export interface SpawnedProcess { readonly kill: () => void; readonly killGroup?: () => void; readonly pid?: number; }
export type SpawnFunction = (executable: string, args: readonly string[], options: SpawnOptions) => SpawnedProcess;
export interface SafeProcessTransport { run(request: ProcessRequest): Promise<ProcessResult>; }
export interface ProcessTransportDependencies { readonly findExecutable?: (name: string, path: string) => string | undefined; readonly isExecutable?: (path: string) => boolean; readonly path?: string; readonly platform?: NodeJS.Platform; readonly spawn?: SpawnFunction; }
export interface PtyProcess { kill(): void; write(data: string): void; onData(listener: (data: string) => void): { dispose(): void }; onExit(listener: (event: { exitCode: number }) => void): { dispose(): void }; }
export interface PtyModule { spawn(file: string, args: string[], options: { cols: number; cwd: string; env: Record<string, string>; name: string; rows: number }): PtyProcess; }
export interface PtyTransportDependencies extends ProcessTransportDependencies { readonly loadPty?: () => Promise<PtyModule>; }

const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_STDERR_BYTES = 8 * 1024;
function executable(path: string): boolean { try { return statSync(path).isFile() && (accessSync(path, constants.X_OK), true); } catch { return false; } }
function find(name: string, path: string): string | undefined { return path.split(delimiter).map((part) => join(part, name)).find(executable); }
function spawn(executablePath: string, args: readonly string[], options: SpawnOptions): SpawnedProcess { const child = nodeSpawn(executablePath, args, { detached: process.platform !== "win32", env: options.env, shell: false, stdio: ["ignore", "pipe", "pipe"] }); child.stdout.on("data", (chunk: Buffer) => options.onData(chunk.toString("utf8"))); child.stderr.on("data", (chunk: Buffer) => options.onStderr(chunk.toString("utf8"))); child.on("close", options.onClose); child.on("error", options.onError); const handle = { kill: () => { if (child.pid !== undefined && process.platform !== "win32") try { process.kill(-child.pid, "SIGKILL"); return; } catch {} child.kill("SIGKILL"); } }; return child.pid === undefined ? handle : { ...handle, pid: child.pid }; }

export function createSafeProcessTransport(deps: ProcessTransportDependencies = {}): SafeProcessTransport {
  const platform = deps.platform ?? process.platform; const path = deps.path ?? process.env.PATH ?? ""; const locate = deps.findExecutable ?? find; const verified = deps.isExecutable ?? executable; const launch = deps.spawn ?? spawn; const inFlight = new Set<string>();
  return { async run(request) {
    if (platform === "win32") return { status: PROCESS_STATUS.UNAVAILABLE, output: "" };
    if (request.signal?.aborted) return { status: PROCESS_STATUS.CANCELLED, output: "" };
    const candidate = isAbsolute(request.executable) ? request.executable : request.executable.includes("/") || request.executable.includes("\\") ? undefined : locate(request.executable, path);
    if (candidate === undefined || !isAbsolute(candidate) || !verified(candidate)) return { status: PROCESS_STATUS.UNAVAILABLE, output: "" };
    if (inFlight.has(candidate)) return { status: PROCESS_STATUS.BUSY, output: "" };
    inFlight.add(candidate);
    return new Promise((resolve) => {
      let output = ""; let outputBytes = 0; let stderr = ""; let stderrBytes = 0; let settled = false; let exceeded = false; let terminated = false; let timer: ReturnType<typeof setTimeout> | undefined; let child: SpawnedProcess | undefined;
      const finish = (status: ProcessStatus, value = "") => { if (settled) return; settled = true; if (timer !== undefined) clearTimeout(timer); request.signal?.removeEventListener("abort", cancel); inFlight.delete(candidate); const requiresTerminal = status === PROCESS_STATUS.FAILED && /(?:tty|terminal|interactive)/i.test(sanitizeTerminalText(stderr)); resolve(requiresTerminal ? { status, output: value, requiresTerminal: true } : { status, output: value }); };
      const kill = () => { if (terminated) return; terminated = true; child?.killGroup?.(); child?.kill(); };
      const cancel = () => { kill(); finish(request.signal?.aborted ? PROCESS_STATUS.CANCELLED : PROCESS_STATUS.TIMED_OUT); };
      try {
        child = launch(candidate, request.args, { env: { PATH: path }, shell: false, onClose: (code) => finish(code === 0 ? PROCESS_STATUS.SUCCESS : PROCESS_STATUS.FAILED, code === 0 ? output : ""), onError: () => finish(PROCESS_STATUS.FAILED), onData: (chunk) => { if (settled || exceeded) return; outputBytes += Buffer.byteLength(chunk, "utf8"); if (outputBytes > MAX_OUTPUT_BYTES) { exceeded = true; if (child !== undefined) { kill(); finish(PROCESS_STATUS.FAILED); } } else output += chunk; }, onStderr: (chunk) => { if (settled || stderrBytes >= MAX_STDERR_BYTES) return; const bounded = Buffer.from(chunk, "utf8").subarray(0, MAX_STDERR_BYTES - stderrBytes).toString("utf8"); stderr += bounded; stderrBytes += Buffer.byteLength(bounded, "utf8"); } });
        if (exceeded) { kill(); queueMicrotask(() => finish(PROCESS_STATUS.FAILED)); }
        else { timer = setTimeout(cancel, request.timeoutMs); request.signal?.addEventListener("abort", cancel, { once: true }); }
      } catch { finish(PROCESS_STATUS.FAILED); }
    });
  } };
}

export function createPtyProcessTransport(deps: PtyTransportDependencies = {}): SafeProcessTransport {
  const platform = deps.platform ?? process.platform; const path = deps.path ?? process.env.PATH ?? ""; const locate = deps.findExecutable ?? find; const verified = deps.isExecutable ?? executable;
  const load = deps.loadPty ?? (async () => import("node-pty") as Promise<PtyModule>);
  return { async run(request) {
    if (platform === "win32") return { status: PROCESS_STATUS.UNAVAILABLE, output: "" };
    if (request.signal?.aborted) return { status: PROCESS_STATUS.CANCELLED, output: "" };
    const candidate = request.executable === "claude" ? locate(request.executable, path) : undefined;
    if (candidate === undefined || !isAbsolute(candidate) || !verified(candidate)) return { status: PROCESS_STATUS.UNAVAILABLE, output: "" };
    let module: PtyModule; try { module = await load(); } catch { return { status: PROCESS_STATUS.UNAVAILABLE, output: "" }; }
    if (request.signal?.aborted) return { status: PROCESS_STATUS.CANCELLED, output: "" };
    return new Promise((resolve) => {
      let output = ""; let bytes = 0; let settled = false; let timer: ReturnType<typeof setTimeout> | undefined;
      const disposables: Array<{ dispose(): void }> = []; let terminal: PtyProcess | undefined;
      const finish = (status: ProcessStatus, value = "") => { if (settled) return; settled = true; if (timer !== undefined) clearTimeout(timer); request.signal?.removeEventListener("abort", cancel); for (const disposable of disposables) disposable.dispose(); resolve({ status, output: value }); };
      const cancel = () => { try { terminal?.kill(); } catch {} finish(request.signal?.aborted ? PROCESS_STATUS.CANCELLED : PROCESS_STATUS.TIMED_OUT); };
      try {
        terminal = module.spawn(candidate, [], { cols: 120, rows: 40, cwd: "/", env: { PATH: path }, name: "xterm" });
        disposables.push(terminal.onData((chunk) => { if (settled) return; bytes += Buffer.byteLength(chunk); if (bytes > MAX_OUTPUT_BYTES) cancel(); else output += chunk; }));
        disposables.push(terminal.onExit(({ exitCode }) => finish(exitCode === 0 ? PROCESS_STATUS.SUCCESS : PROCESS_STATUS.FAILED, exitCode === 0 ? sanitizeTerminalText(output) : "")));
        timer = setTimeout(cancel, request.timeoutMs); request.signal?.addEventListener("abort", cancel, { once: true }); terminal.write("/usage\r");
      } catch { cancel(); }
    });
  } };
}
