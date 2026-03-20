# 우리 동네 칼갈이 (KnifeTruck)

수원 기준 이동형 칼갈이 트럭 제보와 지역 알림 흐름을 검증하는 공개 MVP 저장소입니다.

## Stack

- Next.js 15
- React 19
- TypeScript
- Supabase
- Kakao Maps / Kakao Login 예정

## Product Focus

핵심은 `provider directory`보다 `report flow`입니다.

- 사용자가 동네에서 칼갈이 트럭을 발견하면 바로 제보
- 최근 제보를 구/동 기준으로 확인
- 관심 지역 알림을 저장
- 이후 Kakao 지도와 Kakao 로그인으로 확장

## Current Scope

현재 앱은 두 가지 모드로 동작합니다.

- Supabase env가 있으면 `providers`, `reports`를 읽고 `reports`, `alert_subscriptions`에 저장 시도를 합니다.
- env가 없으면 mock 데이터와 `localStorage`로 동일한 화면 흐름을 검증합니다.

## Local Run

```bash
npm install
```

`.env.example`를 참고해 `.env.local`을 만든 뒤 값을 채웁니다.

```bash
npm run dev
```

## Supabase Setup

1. Supabase 프로젝트 생성
2. SQL Editor에서 [supabase/schema.sql](./supabase/schema.sql) 실행
3. 필요하면 [supabase/seed.sql](./supabase/seed.sql) 실행
4. `NEXT_PUBLIC_SUPABASE_URL` 입력
5. `NEXT_PUBLIC_SUPABASE_ANON_KEY` 입력

현재 공개 스키마 정책은 아래 기준입니다.

- `providers`: anon read 허용
- `reports`: active rows read 허용, insert 허용
- `alert_subscriptions`: insert 허용, public read는 열지 않음

## Status

현재는 공개 MVP 구현과 Supabase 연결 단계입니다.

## Public Repo Policy

내부 기획 문서, 운영용 수집 자료, 비공개 실험 데이터는 저장소에 포함하지 않습니다. 공개 저장소에는 실행 가능한 앱 코드와 공개 가능한 최소 스키마만 둡니다.
