type OriginCheck = { host?: string; origin?: string; port: number };

/** 精确限制到当前 loopback 观测站，避免 Host 头与外站 Origin 配对绕过。 */
export function isTrustedClaudeTelemetryOrigin({ host, origin, port }: OriginCheck) {
  const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  if (!host || !allowed.has(host)) return false;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' && allowed.has(parsed.host);
  } catch { return false; }
}
