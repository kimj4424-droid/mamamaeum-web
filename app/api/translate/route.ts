const ANTHROPIC_MODEL = "claude-sonnet-5";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY가 서버에 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  const { system, messages, max_tokens } = await req.json();
  if (!system || !Array.isArray(messages)) {
    return Response.json({ error: "system과 messages가 필요합니다." }, { status: 400 });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: max_tokens || 1000,
      system,
      messages,
      thinking: { type: "disabled" },
    }),
  });

  const data = await upstream.json();
  return Response.json(data, { status: upstream.status });
}
