import { corsHeaders, isAllowedCorsOrigin } from "../../lib/cors";
import { enforceRequestLimit } from "../../lib/request-limit";

const ANTHROPIC_MODEL = "claude-sonnet-5";
const MAX_MESSAGE_CHARS = 30_000;
const MAX_MESSAGES = 16;
const MAX_TRANSLATE_REQUESTS_PER_HOUR = 30;
const ONE_HOUR_MS = 60 * 60_000;

function error(request: Request, message: string, status: number, headers = corsHeaders(request)) {
  return Response.json({ error: message }, { status, headers });
}

export function OPTIONS(request: Request) {
  if (!isAllowedCorsOrigin(request)) return error(request, "허용되지 않은 Origin입니다.", 403);
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const retryAfter = enforceRequestLimit(
    req,
    "translate",
    MAX_TRANSLATE_REQUESTS_PER_HOUR,
    ONE_HOUR_MS,
  );
  if (retryAfter) {
    return error(req, "시간당 답변 생성 횟수를 모두 사용했어요. 잠시 후 다시 시도해주세요.", 429, {
      ...headers,
      "Retry-After": String(retryAfter),
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return error(req, "AI 처리 설정이 준비되지 않았습니다.", 503, headers);

  let payload: { system?: unknown; messages?: unknown; max_tokens?: unknown };
  try {
    payload = await req.json();
  } catch {
    return error(req, "요청 형식이 올바르지 않습니다.", 400, headers);
  }

  const { system, messages, max_tokens } = payload;
  if (typeof system !== "string" || !Array.isArray(messages)) {
    return error(req, "system과 messages가 필요합니다.", 400, headers);
  }
  if (
    messages.length === 0 ||
    messages.length > MAX_MESSAGES ||
    JSON.stringify(messages).length > MAX_MESSAGE_CHARS
  ) {
    return error(req, "입력 메시지가 너무 깁니다.", 413, headers);
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      cache: "no-store",
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens:
          typeof max_tokens === "number"
            ? Math.min(Math.max(max_tokens, 200), 1200)
            : 1000,
        system,
        messages,
        thinking: { type: "disabled" },
      }),
    });

    const data = await upstream.json();
    return Response.json(data, { status: upstream.status, headers });
  } catch {
    return error(req, "AI 응답을 받아오지 못했습니다. 잠시 후 다시 시도해주세요.", 502, headers);
  }
}
