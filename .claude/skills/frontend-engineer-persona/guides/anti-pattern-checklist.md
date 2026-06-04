---
title: "안티패턴 체크리스트"
description: "구현 또는 리뷰 시 확인할 안티패턴 → 올바른 패턴 매핑 테이블. FSD, 타입, 상태관리, 문서화 전 영역 커버."
tags: [anti-pattern, checklist, review, code-quality]
category: guide
related:
  - ../guides/clean-code.md
  - ../guides/fsd-architecture.md
---

# 안티패턴 체크리스트

구현 또는 리뷰 시 다음을 확인합니다:

| 안티패턴 | 올바른 패턴 |
|----------|------------|
| 상위 레이어에서 하위로 import | FSD 레이어 의존성 규칙 준수 |
| 한 도메인 내 중복을 즉시 `shared/`로 승격 | 도메인 컴포넌트로 추출, 2+ 도메인 공유 시에만 shared 승격 |
| `as` 타입 캐스팅으로 렌더링 분기 | 타입 가드 함수 사용 |
| Zustand 전체 상태 구독 | selector로 필요한 값만 구독 |
| SSR에서 persisted store 직접 렌더링 | hydration 체크 후 렌더링 |
| 핸들러에서 store 직접 수정 | callbacks/result를 통한 간접 전달 |
| 슬라이스 내부에 FSD 레이어 이름 폴더 (`ui/shared/`, `ui/features/`) | 세그먼트 루트에 평탄 배치. FSD 최상위 레이어와 이름 충돌 방지 |
| 2~3개 파일에서만 사용하는 상수를 별도 `constants.ts`로 분리 | 주 소비자 컴포넌트에 인라인 후 export. 파일 수 최소화 |
| 슬라이스 간 상대 경로 import | 슬라이스 간은 `@/` alias 필수. 같은 슬라이스 내부는 상대경로 사용 |
| 내부 구현 직접 import | `index.ts` Public API를 통해 import |
| 타입을 수동으로 중복 정의 | Zod 스키마에서 `z.infer<>` 추출 |
| TS `enum` 사용 | `as const` + 타입 추출 또는 Zod Companion Object |
| z.enum 타입의 raw string 비교 (`=== 'numeric'`) | Companion Object 상수 사용 (`=== OutputType.Numeric`) |
| Zod 구현 세부사항 직접 참조 (`Schema.enum.value`) | 명시적 Companion Object export |
| 여러 세그먼트 개별 import 반복 (3곳+) | Factory Hook으로 조합 (`shared/hooks`) |
| 자족적 훅을 `shared/hooks`에 배치 | 외부 상태 없는 훅은 `shared/lib`에 유지 |
| Prop drilling (3단계 이상) | Zustand store 또는 Context 사용 |
| 인라인 이벤트 핸들러 | `handle` 접두사 함수로 분리 |
| 로딩 상태 미처리 | 3-state (loading/empty/data) 필수 |
| Mutation 후 피드백 없음 | 성공/실패 토스트 필수 |
| `npm` 사용 | `pnpm` 전용 |
| 모든 문서를 한 파일에 작성 (1000줄+ README) | 진입점 README (~200줄) + docs/ 분리 (Progressive Disclosure) |
| API 레퍼런스만 나열 | 디자인 의도(왜 필요한지) 먼저 기술, API는 상세 문서에 |
| docs/ npm 배포 누락 | `package.json` files에 docs 포함, 소비측 접근 보장 |
| 코드 변경 후 문서 미동기화 | 변경 유형별 체크리스트로 docs + README 동시 업데이트 |
| `@/shared/ui/shadcn/[component]` 직접 import | `@/shared/ui` Public API를 통해 import |
| `disabled`로 표시 전용(read-only) 표현 | `readOnly` prop 추가 구분 (pointer-events-none, opacity 유지) |
| CSS 렌더링 트릭(radial-gradient 하드 스톱 등)으로 시각적 결함 해결 | DOM 구조로 근본 수정 (native anti-aliasing 활용) |
| 컴포넌트명이 특정 도메인을 포함 (`MetricSlider`, `UserButton`) | 실제 역할이 범용이면 generic 이름 사용 (`Slider`, `Button`) |
| Tailwind 클래스명을 검증 없이 사용 | Tailwind config 또는 `@theme` 정의에서 실제 클래스명 확인 |
| `enabled: false` 쿼리의 `isLoading=false`를 미고려하여 빈 화면 깜빡임 | upstream 비동기 의존성(`!serviceId` 등)을 로딩 조건에 포함 |
| API 타입을 문서/추측 기반으로 작성 | OpenAPI spec(`/openapi.json`) 또는 실제 응답과 대조 검증 |
| `min-h-screen`으로 스크롤 컨테이너 구성 | `h-screen`으로 고정 높이 제약 설정 (하위 `overflow-y-auto` 동작을 위해 부모 높이가 제한되어야 함) |
| Skeleton이 로드 완료 상태와 다른 공간 차지 | Root와 Skeleton 모두 `h-full` 등 동일 크기 규칙 적용. 레이아웃 시프트 방지 |
| 대규모 리팩토링 시 기존 코드 즉시 삭제 | `Legacy*.tsx`로 보존 후 안정화 확인 후 제거 |
| `invalidateQueries`에서 raw string 배열 사용 (`['domain', 'key']`) | 해당 도메인이 export한 `QUERY_KEYS` 상수 import. 특히 cross-domain 무효화 시 필수 |
| cross-domain 캐시 무효화 시 QUERY_KEYS 미export | `export { QUERY_KEYS as DOMAIN_QUERY_KEYS }` — 외부에서 참조 가능하도록 도메인명 alias로 export |
| prefix 무효화 시 즉시 평가 배열에서 `QUERY_KEYS.all` 자기참조 | literal 값 직접 사용 (`['domain', 'sub']`). Biome `noInvalidUseBeforeDeclaration` 규칙 |
| 라이브러리 컴포넌트 내부 DOM을 CSS selector(`[&>div]:w-full`)로 오버라이드 | raw element에 동일 시각 스타일 직접 적용. 내부 구조는 버전 업데이트 시 변경될 수 있음 |
| 포맷 상수에 locale 종속 문자열 사용 (`'yyyy.MM.dd HH:mm:ss'`) | date-fns localized token 사용 (`'Ppp'`). locale 변경만으로 출력 자동 전환 |
| 상수명이 구현 세부사항 반영 (`DATETIME_DOT`, `FORMAT_SLASH`) | 의미 기반 네이밍 (`DATETIME_SHORT`, `DATE_ONLY`). locale 독립적 |
| 도메인 레이어에서 `axios` 직접 import하여 에러 체크 | `shared/api`의 `isApiError`/`isHttpError` 사용 |
| HTTP 상태 코드를 매직 넘버로 비교 (`=== 409`) | `HTTP_STATUS.conflict` 등 명명된 상수 사용 |
| 테스트에서 `AxiosError` 직접 import | `HttpError` re-export 사용 (`@/shared/api`) |
| 조건부 className에 `&&` 패턴 (`isActive && 'class'`) | `cn()` Object 문법 (`{ 'class': isActive }`) |
| 조건부 className에 삼항 (`isActive ? 'a' : 'b'`) | `cn()` Object 문법 (`{ 'a': isActive, 'b': !isActive }`) |
| className을 별도 변수로 분리 (`const cls = [...]`) | 요소의 `className` prop에 `cn()` 인라인 |
| 배열+join/템플릿 리터럴로 동적 className 조합 | `cn()` 함수 사용 |


---

## 관련 문서

- [클린 코드 원칙](clean-code.md) — 원칙의 상세 설명
- [FSD 아키텍처](fsd-architecture.md) — 레이어 의존성 규칙 상세
