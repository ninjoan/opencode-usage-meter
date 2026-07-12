export interface Disposable { dispose(): void; }
export function combineDisposables(disposables: readonly Disposable[]): Disposable { let disposed = false; return { dispose() { if (disposed) return; disposed = true; for (const disposable of disposables) disposable.dispose(); } }; }
