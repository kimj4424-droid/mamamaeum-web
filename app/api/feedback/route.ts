import { corsHeaders, isAllowedCorsOrigin } from "../../lib/cors";
import { enforceRequestLimit } from "../../lib/request-limit";

function error(request: Request, message: string, status: number, headers = corsHeaders(request)) {
  return Response.json({ error: message }, { status, headers });
}

export function OPTIONS(request: Request) {
  if (!isAllowedCorsOrigin(request)) return error(request, "허용되지 않은 Origin입니다.", 403);
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const retryAfter = enforceRequestLimit(req, "feedback", 5, 60 * 60_000);
  if (retryAfter) {
    return error(req, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429, {
      ...headers,
      "Retry-After": String(retryAfter),
    });
  }

  const formUrl = process.env.GOOGLE_FORM_RESPONSE_URL;
  const entryCategory = process.env.GOOGLE_FORM_ENTRY_CATEGORY;
  const entryMessage = process.env.GOOGLE_FORM_ENTRY_MESSAGE;
  const entryContact = process.env.GOOGLE_FORM_ENTRY_CONTACT;
  if (!formUrl || !entryCategory || !entryMessage || !entryContact) {
    return error(req, "피드백 설정이 준비되지 않았습니다.", 503, headers);
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

  const body = new URLSearchParams();
  body.set(`entry.${entryCategory}`, typeof category === "string" ? category.slice(0, 100) : "");
  body.set(`entry.${entryMessage}`, message.trim());
  body.set(`entry.${entryContact}`, typeof contact === "string" ? contact.trim() : "");

  try {
    const upstream = await fetch(formUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      body: body.toString(),
    });

    if (!upstream.ok) return error(req, "저장에 실패했습니다.", 502, headers);
    return Response.json({ ok: true }, { headers });
  } catch {
    return error(req, "피드백을 전달하지 못했습니다. 잠시 후 다시 시도해주세요.", 502, headers);
  }
}
