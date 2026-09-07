const ANTHROPIC_MODEL = "claude-sonnet-5";
const MAX_MESSAGE_BYTES = 30_000;
const MAX_MESSAGES = 16;

const noStoreHeaders = { "Cache-Control": "no-store" };

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: noStoreHeaders });
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return error("AI 처리 설정이 준비되지 않았습니다.", 503);

  let payload: { system?: unknown; messages?: unknown; max_tokens?: unknown };
  try {
    payload = await req.json();
  } catch {
    return error("요청 형식이 올바르지 않습니다.", 400);
  }

  const { system, messages, max_tokens } = payload;
  if (typeof system !== "string" || !Array.isArray(messages)) {
    return error("system과 messages가 필요합니다.", 400);
  }
  if (
    messages.length === 0 ||
    messages.length > MAX_MESSAGES ||
    JSON.stringify(messages).length > MAX_MESSAGE_BYTES
  ) {
    return error("입력 메시지가 너무 깁니다.", 413);
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
    return Response.json(data, { status: upstream.status, headers: noStoreHeaders });
  } catch {
    return error("AI 응답을 받아오지 못했습니다. 잠시 후 다시 시도해주세요.", 502);
  }
}
