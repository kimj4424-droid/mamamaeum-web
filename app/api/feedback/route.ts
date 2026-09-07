import { enforceRequestLimit } from "../../lib/request-limit";

const noStoreHeaders = { "Cache-Control": "no-store" };

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: noStoreHeaders });
}

export async function POST(req: Request) {
  const retryAfter = enforceRequestLimit(req, "feedback", 5, 60 * 60_000);
  if (retryAfter) {
    return Response.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { ...noStoreHeaders, "Retry-After": String(retryAfter) } },
    );
  }

  const formUrl = process.env.GOOGLE_FORM_RESPONSE_URL;
  const entryCategory = process.env.GOOGLE_FORM_ENTRY_CATEGORY;
  const entryMessage = process.env.GOOGLE_FORM_ENTRY_MESSAGE;
  const entryContact = process.env.GOOGLE_FORM_ENTRY_CONTACT;
  if (!formUrl || !entryCategory || !entryMessage || !entryContact) {
    return error("피드백 설정이 준비되지 않았습니다.", 503);
  }

  let payload: { category?: unknown; message?: unknown; contact?: unknown };
  try {
    payload = await req.json();
  } catch {
    return error("요청 형식이 올바르지 않습니다.", 400);
  }

  const { category, message, contact } = payload;
  if (!message || typeof message !== "string" || !message.trim()) {
    return error("message가 필요합니다.", 400);
  }
  if (message.length > 2000 || (typeof contact === "string" && contact.length > 200)) {
    return error("입력 내용이 너무 깁니다.", 413);
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

    if (!upstream.ok) return error("저장에 실패했습니다.", 502);
    return Response.json({ ok: true }, { headers: noStoreHeaders });
  } catch {
    return error("피드백을 전달하지 못했습니다. 잠시 후 다시 시도해주세요.", 502);
  }
}
