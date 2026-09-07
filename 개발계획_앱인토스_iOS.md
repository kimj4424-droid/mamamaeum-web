# 엄마마음 앱인토스·iOS 개발 계획

## 목표
공통 API와 안전 정책을 공유하고, 앱인토스는 WebView 기반 미니앱으로, iOS는 SwiftUI와 Share Extension 기반 앱으로 출시한다.

## 1단계 — 공통 기반 안정화
- [x] AI API와 피드백 API 복구
- [x] 요청 형식·길이 검증과 응답 캐시 방지
- [x] 입력 원문 비저장 정책과 AI 처리 동의 화면
- [x] 공개 개인정보 처리방침
- [x] Vercel 환경변수와 실제 API 호출 확인
- [x] 서버 인스턴스 단위 요청량 제한
- [ ] Vercel 전역 요청 제한 및 모니터링 설정

## 2단계 — 앱인토스 출시
- React/TypeScript와 Apps in Toss Web Framework 2.x로 화면 이식
- 토스 내비게이션, Safe Area, 클립보드 권한 적용
- 샌드박스·실기기 테스트 후 비게임 검수 제출

## 3단계 — iOS 앱스토어 출시
- SwiftUI 앱과 공통 API 클라이언트 구현
- 클립보드·공유 시트·Share Extension 실기기 검증
- 개인정보 라벨, Privacy Manifest, TestFlight, App Store 심사 준비
