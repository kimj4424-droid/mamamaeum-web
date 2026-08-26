export async function POST(req: Request) {
  const webhookUrl = process.env.FEEDBACK_SHEET_WEBHOOK_URL;
  if (!webhookUrl) {
    return Response.json(
      { error: "FEEDBACK_SHEET_WEBHOOK_URL이 서버에 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  const { category, message, contact } = await req.json();
  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message가 필요합니다." }, { status: 400 });
  }

  const payload = {
    timestamp: new Date().toISOString(),
    category: typeof category === "string" ? category : "",
    message: message.slice(0, 2000),
    contact: typeof contact === "string" ? contact.slice(0, 200) : "",
    userAgent: req.headers.get("user-agent") || "",
  };

  const upstream = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    return Response.json({ error: "저장에 실패했습니다." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
