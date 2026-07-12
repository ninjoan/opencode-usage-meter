const SENSITIVE_VALUE = /([a-z][a-z0-9_-]*)(=)([^\s]+)/gi;
export function redactDiagnostic(value: unknown): string { return value instanceof Error ? value.message.replace(SENSITIVE_VALUE, "$1$2[redacted]") : "Usage meter refresh failed"; }
