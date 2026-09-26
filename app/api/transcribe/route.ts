import { corsHeaders, isAllowedCorsOrigin } from "../../lib/cors";
import { enforceRequestLimit } from "../../lib/request-limit";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_TRANSCRIPTION_REQUESTS_PER_HOUR = 30;
const ONE_HOUR_MS = 60 * 60_000;
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
]);

function error(request: Request, message: string, status: number, headers = corsHeaders(request)) {
  return Response.json({ error: message }, { status, headers });
}

export function OPTIONS(request: Request) {
  if (!isAllowedCorsOrigin(request)) return error(request, "허용되지 않은 Origin입니다.", 403);
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const retryAfter = enforceRequestLimit(
    request,
    "transcribe",
    MAX_TRANSCRIPTION_REQUESTS_PER_HOUR,
    ONE_HOUR_MS,
  );
  if (retryAfter) {
    return error(request, "시간당 음성 입력 횟수를 모두 사용했어요. 잠시 후 다시 시도해주세요.", 429, {
      ...headers,
      "Retry-After": String(retryAfter),
    });
  }

  // 기존 Vercel 설정의 키 이름도 지원해, 배포 후 바로 음성 인식을 사용할 수 있게 합니다.
  const apiKey = process.env.OPENAI_API_KEY || process.env.STT_api_Key;
  if (!apiKey) return error(request, "음성 인식 설정이 준비되지 않았습니다.", 503, headers);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return error(request, "오디오 파일을 multipart/form-data로 보내주세요.", 415, headers);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error(request, "오디오 파일을 읽지 못했습니다.", 400, headers);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) return error(request, "오디오 파일이 필요합니다.", 400, headers);
  if (!audio.size) return error(request, "녹음된 내용이 없습니다.", 400, headers);
  if (audio.size > MAX_AUDIO_BYTES) return error(request, "음성 파일은 10MB 이하만 전송할 수 있습니다.", 413, headers);
  if (audio.type && !SUPPORTED_AUDIO_TYPES.has(audio.type)) {
    return error(request, "지원하지 않는 오디오 형식입니다.", 415, headers);
  }

  const upstreamForm = new FormData();
  upstreamForm.set("file", audio, audio.name || "recording.webm");
  upstreamForm.set("model", "gpt-transcribe");
  upstreamForm.append("languages[]", "ko");
  upstreamForm.set("response_format", "json");

  try {
    const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      body: upstreamForm,
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) return error(request, "음성을 텍스트로 바꾸지 못했습니다.", upstream.status >= 500 ? 502 : upstream.status, headers);
    if (!data || typeof data.text !== "string") return error(request, "음성 인식 결과 형식이 올바르지 않습니다.", 502, headers);
    return Response.json({ text: data.text }, { headers });
  } catch {
    return error(request, "음성 인식 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.", 502, headers);
  }
}
