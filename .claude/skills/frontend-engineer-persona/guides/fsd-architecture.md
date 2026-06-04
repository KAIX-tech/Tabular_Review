---
title: "FSD 아키텍처"
description: "Feature-Sliced Design 레이어 결정, 세그먼트 배치, 의존성 규칙, Public API 패턴. 새 코드 배치의 의사결정 가이드."
tags: [fsd, architecture, layers, segments, dependencies, public-api]
category: guide
related:
  - ../guides/style-guide.md
  - ../patterns/api-three-file.md
  - ../patterns/factory-hook.md
---

# FSD 아키텍처

## FSD 레이어 결정

새 코드를 작성할 때, 다음 질문으로 레이어를 결정합니다:

| 질문 | Yes → 레이어 |
|------|--------------|
| Next.js 라우팅/레이아웃인가? | `app/` |
| 특정 비즈니스 도메인에 속하는가? | `domains/` |
| 여러 도메인에서 재사용되는 복합 UI인가? | `widgets/` |
| 여러 도메인에서 재사용되는 기능인가? | `features/` |
| 비즈니스 로직이 없는 순수 기술 코드인가? | `shared/` |

## 레이어별 역할

```
src/
├── app/              # Next.js 라우팅 전용 (비즈니스 로직 없음, domains의 페이지 컴포넌트 import만)
├── domains/          # 비즈니스 도메인별 독립 기능 (페이지 컴포넌트는 ui/[Domain]Page.tsx)
├── widgets/          # 여러 features를 조합한 복합 UI 블록
├── features/         # 도메인 간 공유되는 재사용 기능
└── shared/           # 비즈니스 로직 없는 순수 기술 코드
    ├── api/          # API 클라이언트 및 훅
    ├── hooks/        # 조합 훅 (lib + model 브릿지)
    ├── lib/          # 순수 유틸 함수 및 자족적 훅
    ├── types/        # 공통 타입 정의
    └── ui/           # 공통 UI 컴포넌트
```

## 세그먼트 배치

슬라이스 내에서 파일 위치를 결정할 때:

| 코드 성격 | 세그먼트 | 예시 |
|-----------|----------|------|
| 렌더링하는 JSX | `ui/` | `PersonaPage.tsx`, `MetricCard.tsx` |
| Zustand store, Context, 타입 정의 | `model/` | `chatStore.ts`, `types.ts` |
| TanStack Query 훅, API 함수 | `api/` | `usePersonas.ts`, `persona.api.ts` |
| 순수 함수, 외부 상태 없이 자족적으로 동작하는 훅 | `lib/` | `datetime.ts`, `useListNavigation.ts` |
| 여러 세그먼트(lib + model 등)를 조합하는 훅 | `hooks/` | `useDatetime.ts` |
| 상수, 설정값 | `config/` | `routes.ts`, `test-ids.ts` |

### `shared/lib` vs `shared/hooks` 배치 기준

| 위치 | 조건 | 예시 |
|------|------|------|
| `shared/lib` | 순수 유틸 함수 또는 **외부 상태(store, context) 없이** 자족적으로 동작하는 훅 | `useListNavigation`, `useCursorPagination`, `cn()` |
| `shared/hooks` | `lib`(순수 유틸) + `model`(상태) 등 **다른 세그먼트를 조합**하는 브릿지 훅 | `useDatetime` (lib/datetime + model/clientStore) |

`shared/hooks`는 사용처에서 여러 세그먼트를 개별 import하는 불편함을 해소하는 **조합(composition) 레이어**이다.

## FSD 레이어 의존성 규칙

**핵심 원칙: 상위 레이어는 하위 레이어만 import 가능. 역방향 import 절대 금지.**

```
app (최상위)
  ↓ import 가능
domains
  ↓ import 가능
widgets
  ↓ import 가능
features
  ↓ import 가능
shared (최하위)
```

**구체적 금지 규칙:**
- `shared/` → `features`, `widgets`, `domains`, `app` import 금지
- `features/` → `widgets`, `domains`, `app` import 금지
- `widgets/` → `domains`, `app` import 금지
- `domains/` → `app` import 금지
- **같은 레이어 내 슬라이스 간 import는 허용하되, 반드시 `index.ts` Public API를 통해서만**

**린팅 검증:**
```bash
# FSD 의존성 규칙 검증
pnpm run lint:fsd

# 전체 검사 (Biome + FSD)
pnpm run lint
```

FSD 의존성 규칙은 `scripts/check-fsd-imports.mjs` 스크립트로 자동 검증됩니다.
**새 프로젝트 시작 시 이 스크립트가 없으면 반드시 작성합니다.**

## 슬라이스 내부 폴더 네이밍

슬라이스 내부의 서브폴더에 FSD 레이어 이름(`shared/`, `features/`, `widgets/`)을 사용하지 않는다. FSD 최상위 레이어와 혼동을 일으키며, 아키텍처 수준의 네이밍 정합성을 깨뜨린다.

### 원칙

1. **평탄 배치 우선**: 도메인 내 여러 하위 컴포넌트가 공유하는 파일은 세그먼트 루트(`ui/` 등)에 평탄하게 배치한다
2. **폴더 생성 기준**: 단일 컴포넌트+테스트 수준은 폴더 래핑 없이 flat 배치. 폴더는 내부에 여러 하위 컴포넌트가 있을 때만 생성
3. **상수 근접 배치**: 소수 파일(2~3개)에서만 사용하는 상수는 별도 `constants.ts` 대신 주 소비자 컴포넌트에 인라인 후 export

```
// ✅ Good — ui/ 루트에 평탄 배치
domains/qa-scenario/ui/
├── AssigneeStep.tsx          // 여러 하위 컴포넌트에서 공유
├── AssigneeStep.test.tsx
├── MetricSelectionStep.tsx   // OUTPUT_TYPE_LABELS 인라인 정의
├── EvalStatusCell.tsx
├── StatusBadge.tsx
├── SetTestTab/               // 내부에 여러 하위 컴포넌트 → 폴더
│   └── RunSimulationWizard/

// ❌ Bad — FSD 레이어 이름을 슬라이스 내부에서 사용
domains/qa-scenario/ui/
├── shared/                   // FSD `shared/` 레이어와 혼동
│   ├── AssigneeStep.tsx
│   ├── MetricSelectionStep.tsx
│   └── constants.ts          // 2개 파일에서만 사용하는 상수를 별도 파일로 분리
```

### 판단 기준

| 상황 | 결정 |
|------|------|
| 파일이 같은 세그먼트 내 여러 곳에서 import됨 | 세그먼트 루트에 flat 배치 |
| 파일이 한 곳에서만 사용됨 | 소비자와 같은 폴더에 배치 |
| 상수가 2~3개 파일에서만 사용됨 | 주 소비자에 인라인 |
| 하위 컴포넌트가 3개 이상 모여야 함 | 폴더로 그룹화 |

---

## Public API 패턴

**모든 슬라이스는 `index.ts`를 통해서만 외부 노출. 내부 구현 직접 접근 절대 금지.**

```typescript
// ✅ Good — Public API를 통한 import
import { ExampleComponent } from '@/features/example';
import { useAuth } from '@/domains/auth';

// ❌ Bad — 내부 구현 직접 접근
import { ExampleComponent } from '@/features/example/ui/ExampleComponent';
import { useAuth } from '@/domains/auth/api/auth.hooks';
```

**`index.ts` 작성 원칙:**
- 외부에서 사용할 컴포넌트, 훅, 타입, 상수만 export
- 내부 구현 디테일(유틸 함수, 내부 타입 등)은 export하지 않음
- re-export는 named export만 사용 (default export 금지)

---

## 관련 문서

- [스타일 가이드](style-guide.md) — Import 순서, 모듈 경로 규칙
- [API 3-File 패턴](../patterns/api-three-file.md) — shared/api 세그먼트 구성
- [Factory Hook](../patterns/factory-hook.md) — shared/hooks 세그먼트 활용
