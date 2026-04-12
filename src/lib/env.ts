/**
 * 환경 변수 읽기. Supabase 연결 시 `requireEnv`로 필수값 검증 (기획서 5-15).
 */
export function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function requireEnv(name: string): string {
  const v = readEnv(name);
  if (!v) {
    throw new Error(
      `[Localy] Missing required environment variable: ${name}. Copy .env.example to .env`,
    );
  }
  return v;
}
