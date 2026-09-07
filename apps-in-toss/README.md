# 엄마마음 — 앱인토스 WebView

기존 Vercel/Next.js API를 사용하는 앱인토스 전용 React 번들이에요. 일반 웹 서비스와 소스·배포 산출물을 분리해 관리합니다.

## 실행과 번들 생성

```bash
npm install
npm run dev
npm run build
```

`npm run build`는 Vite 산출물(`dist`)과 앱인토스 업로드 파일(`mamamaeum.ait`)을 생성합니다. `.ait` 파일은 Git에 저장하지 않습니다.

## 콘솔에 올리기 전 확인

1. `apps-in-toss.config.ts`의 `appName: 'mamamaeum'`을 앱인토스 콘솔의 실제 appName과 일치시킵니다.
2. 콘솔/검수 정보에서 클립보드 읽기·쓰기 권한 사용 목적을 “카카오톡 메시지 붙여넣기와 답장 문구 복사”로 설명합니다.
3. `VITE_API_BASE_URL`이 없으면 `https://mamamaeum-web.vercel.app`을 사용합니다. 다른 API 서버를 쓸 경우 `.env.local`에 지정할 수 있습니다.
4. 토스 샌드박스에서 Vercel API의 안전한 CORS 허용 출처를 확인한 뒤 실제 AI 호출을 테스트합니다. 출처를 확인하지 않은 상태에서 `Access-Control-Allow-Origin: *`를 적용하지 않습니다.
5. 토스 샌드박스에서 클립보드 권한 허용·거부, 뒤로가기, Safe Area, AI 처리 동의 화면을 확인합니다.
