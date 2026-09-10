import { corsHeaders, isAllowedCorsOrigin } from "../../lib/cors";
import { enforceRequestLimit } from "../../lib/request-limit";

// Google Forms는 항목 ID가 바뀌면 기존 Vercel 환경 변수가 오래된 값을 가리킬 수 있습니다.
// 현재 공개 피드백 폼의 항목 ID를 소스에서 명시해 제출 경로를 안정적으로 유지합니다.
const GOOGLE_FORM_RESPONSE_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfpJgKIu7-7C9MXV0LTIAgf3py6TKptsHCi6fRev6optUXdYQ/formResponse";
const GOOGLE_FORM_ENTRY_CATEGORY = "2039242319";
const GOOGLE_FORM_ENTRY_MESSAGE = "434700913";
const GOOGLE_FORM_ENTRY_CONTACT = "1753195098";

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
  body.set(`entry.${GOOGLE_FORM_ENTRY_CATEGORY}`, typeof category === "string" ? category.slice(0, 100) : "");
  body.set(`entry.${GOOGLE_FORM_ENTRY_MESSAGE}`, message.trim());
  body.set(`entry.${GOOGLE_FORM_ENTRY_CONTACT}`, typeof contact === "string" ? contact.trim() : "");

  try {
    const upstream = await fetch(GOOGLE_FORM_RESPONSE_URL, {
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
