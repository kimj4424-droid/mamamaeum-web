import { corsHeaders, isAllowedCorsOrigin } from "../../lib/cors";
import { enforceRequestLimit } from "../../lib/request-limit";

// Google Forms 중계는 양식 제출 트리거가 발생하지 않을 수 있어, 시트와 메일을 함께
// 처리하는 Apps Script 웹 앱으로 직접 전달합니다.
const FEEDBACK_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz9K58QoElYYgtOmKr1ObJNWp2N8pERHaZtwMv4onf7O4fPKNy4gBrgHNvKVMHbuV7suQ/exec";

function error(request: Request, message: string, status: number, headers = corsHeaders(request)) {
  return Response.json({ error: message }, { status, headers });
}

export function OPTIONS(request: Request) {
  if (!isAllowedCorsOrigin(request)) return error(request, "허용되지 않은 Origin입니다.", 403);
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const feedbackSecret = process.env.FEEDBACK_WEB_APP_SECRET;
  if (!feedbackSecret) {
    return error(req, "피드백 설정이 준비되지 않았습니다.", 503, headers);
  }
  const retryAfter = enforceRequestLimit(req, "feedback", 5, 60 * 60_000);
  if (retryAfter) {
    return error(req, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429, {
      ...headers,
      "Retry-After": String(retryAfter),
    });
  }

  let payload: { category?: unknown; message?: unknown; contact?: unknown };
  try {
    payload = await req.json();
  } catch {
    return error(req, "요청 형식이 올바르지 않습니다.", 400, headers);
  }

  const { category, message, contact } = payload;
  if (!message || typeof message !== "string" || !message.trim()) {
    return error(req, "message가 필요합니다.", 400, headers);
  }
  if (message.length > 2000 || (typeof contact === "string" && contact.length > 200)) {
    return error(req, "입력 내용이 너무 깁니다.", 413, headers);
  }

  const body = JSON.stringify({
    secret: feedbackSecret,
    timestamp: new Date().toISOString(),
    category: typeof category === "string" ? category.slice(0, 100) : "",
    message: message.trim(),
    contact: typeof contact === "string" ? contact.trim() : "",
    userAgent: req.headers.get("user-agent") || "",
  });

  try {
    const upstream = await fetch(FEEDBACK_WEB_APP_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body,
    });

    const upstreamData = await upstream.json().catch(() => null) as { ok?: unknown } | null;
    if (!upstream.ok || upstreamData?.ok !== true) return error(req, "저장에 실패했습니다.", 502, headers);
    return Response.json({ ok: true }, { headers });
  } catch {
    return error(req, "피드백을 전달하지 못했습니다. 잠시 후 다시 시도해주세요.", 502, headers);
  }
}
