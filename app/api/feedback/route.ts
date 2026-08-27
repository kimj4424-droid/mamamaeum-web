export async function POST(req: Request) {
  const formUrl = process.env.GOOGLE_FORM_RESPONSE_URL;
  const entryCategory = process.env.GOOGLE_FORM_ENTRY_CATEGORY;
  const entryMessage = process.env.GOOGLE_FORM_ENTRY_MESSAGE;
  const entryContact = process.env.GOOGLE_FORM_ENTRY_CONTACT;
  if (!formUrl || !entryCategory || !entryMessage || !entryContact) {
    return Response.json(
      { error: "구글 폼 연동 환경변수가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  const { category, message, contact } = await req.json();
  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message가 필요합니다." }, { status: 400 });
  }

  const body = new URLSearchParams();
  body.set(`entry.${entryCategory}`, typeof category === "string" ? category : "");
  body.set(`entry.${entryMessage}`, message.slice(0, 2000));
  body.set(`entry.${entryContact}`, typeof contact === "string" ? contact.slice(0, 200) : "");

  const upstream = await fetch(formUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!upstream.ok) {
    return Response.json({ error: "저장에 실패했습니다." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
