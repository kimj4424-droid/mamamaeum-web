type LimitEntry = { count: number; resetAt: number };

const buckets = new Map<string, LimitEntry>();
let lastPruneAt = 0;

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function prune(now: number) {
  if (now - lastPruneAt < 60_000) return;
  lastPruneAt = now;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

export function enforceRequestLimit(
  request: Request,
  route: string,
  maxRequests: number,
  windowMs: number,
) {
  const now = Date.now();
  prune(now);

  const key = `${route}:${clientIp(request)}`;
  const existing = buckets.get(key);
  const entry = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : existing;

  entry.count += 1;
  buckets.set(key, entry);

  if (entry.count <= maxRequests) return null;
  return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
}
