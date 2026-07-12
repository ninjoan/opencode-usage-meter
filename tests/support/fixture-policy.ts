const UNSAFE_FIXTURE_PATTERNS = {
  BEARER_TOKEN: /\bbearer\s+[a-z0-9._-]+/iu,
  KEY_VALUE_SECRET: /\b(token|api[_-]?key|secret|password)\s*[:=]\s*\S+/iu,
  PRIVATE_KEY: /-----BEGIN\s+(RSA\s+|OPENSSH\s+|EC\s+)?PRIVATE\s+KEY-----/iu
} as const;

export function assertFixtureTextIsSafe(
  fixturePath: string,
  fixtureText: string
): string {
  for (const pattern of Object.values(UNSAFE_FIXTURE_PATTERNS)) {
    if (pattern.test(fixtureText)) {
      throw new Error(`Unsafe fixture content in ${fixturePath}`);
    }
  }

  return fixtureText;
}
