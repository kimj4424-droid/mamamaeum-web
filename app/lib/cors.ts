const allowedOrigins = new Set([
  "https://momslator.apps.tossmini.com",
  "https://momslator.private-apps.tossmini.com",
]);

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) return { "Cache-Control": "no-store" };

  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function isAllowedCorsOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && allowedOrigins.has(origin);
}
