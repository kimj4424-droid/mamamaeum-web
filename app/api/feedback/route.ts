export async function POST(req: Request) {
  const formUrl = process.env.GOOGLE_FORM_RESPONSE_URL;
  const entryCategory = process.env.GOOGLE_FORM_ENTRY_CATEGORY;
  const entryMessage = process.env.GOOGLE_FORM_ENTRY_MESSAGE;
  const entryContact = process.env.GOOGLE_FORM_ENTRY_CONTACT;
  if (!formUrl || !entryCategory || !entryMessage || !entryContact) {
    return Response.json({ error: "피드백 설정이 준비되지 않았습니다." }, { status: 503 });
  }

  let payload: { category?: unknown; message?: unknown; contact?: unknown };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { category, message, contact } = payload;
  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message가 필요합니다." }, { status: 400 });
  }
  if (message.length > 2000 || (typeof contact === "string" && contact.length > 200)) {
    return Response.json({ error: "입력 내용이 너무 깁니다." }, { status: 413 });
  }

  const body = new URLSearchParams();
  body.set(`entry.${entryCategory}`, typeof category === "string" ? category.slice(0, 100) : "");
  body.set(`entry.${entryMessage}`, message.trim());
  body.set(`entry.${entryContact}`, typeof contact === "string" ? contact.trim() : "");

  const upstream = await fetch(formUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body: body.toString(),
  });

  if (!upstream.ok) {
    return Response.json({ error: "저장에 실패했습니다." }, { status: 502 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
