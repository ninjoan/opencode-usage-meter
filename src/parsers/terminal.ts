const TERMINAL_CONTROL = /(?:\u001b\]|\u009d)[^\u0007\u009c]*(?:\u0007|\u001b\\|\u009c)|(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

export function sanitizeTerminalText(output: string): string {
  return output.replace(TERMINAL_CONTROL, "");
}
