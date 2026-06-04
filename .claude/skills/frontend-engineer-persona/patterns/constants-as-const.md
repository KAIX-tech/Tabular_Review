---
title: "상수 정의 — as const + Companion Object"
description: "설정 상수(as const + typeof/keyof), 열거형 상수(Zod Companion Object), 인프라 상수(HTTP_STATUS 등)의 3가지 패턴. 의미에 따른 네이밍 컨벤션 근거 포함."
tags: [constants, as-const, companion-object, enum, zod, type-extraction, typescript, naming, http-status]
category: pattern
related:
  - ../patterns/api-three-file.md
  - ../patterns/type-safety-discriminated.md
---

# 상수 정의 — as const + Companion Object

상수의 **의미**에 따라 2가지 패턴을 구분하여 사용한다.

---

## 패턴 A: 설정 상수 (Config Object)

계층적 설정값을 그룹화할 때 사용. 프로퍼티는 **camelCase**.

```typescript
// shared/api/api.constants.ts
export const API_ENDPOINTS = {
  auth: { login: '/api/v1/auth/login' },
  users: { list: '/api/v1/users', detail: (id: string) => `/api/v1/users/${id}` },
} as const;

// 타입 추출이 필요한 경우
export const SORT_ORDER = {
  asc: 'asc',
  desc: 'desc',
} as const;

export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER];
// → 'asc' | 'desc'
```

**왜 camelCase인가:** 이들은 설정 객체의 프로퍼티다. `ENDPOINTS.auth.login`처럼 계층 구조를 탐색하므로 일반 객체 접근 패턴(camelCase)을 따른다.

---

## 패턴 B: Zod Companion Object (열거형 상수)

`z.enum`으로 정의된 도메인 열거형에 **동명의 const 객체**를 함께 export한다. TypeScript에서 타입과 값은 별도 네임스페이스이므로 같은 이름이 공존 가능하며, TS enum과 동일한 사용감을 제공한다.

프로퍼티는 **PascalCase**.

### 정의

```typescript
// shared/api/evaluationMetric/evaluationMetric.types.ts

// 1. Zod 스키마 (validation용)
export const OutputTypeSchema = z.enum(['numeric', 'binary', 'multi_choice']);

// 2. 타입 추론 (type namespace)
export type OutputType = z.infer<typeof OutputTypeSchema>;
// → 'numeric' | 'binary' | 'multi_choice'

// 3. Companion Object (value namespace) — 프로퍼티 PascalCase
export const OutputType = {
  Numeric: 'numeric',
  Binary: 'binary',
  MultiChoice: 'multi_choice',
} as const satisfies Record<string, OutputType>;
```

### 사용처

```typescript
import { OutputType } from '@/shared/api/evaluationMetric';

// ✅ Good — enum 상수 사용 (자기 문서화, 자동완성 지원)
if (metric.output_type === OutputType.Numeric) { ... }
if (metric.output_type === OutputType.Binary) { ... }

// ❌ Bad — raw string 비교 (오타 가능, 의미 불명확)
if (metric.output_type === 'numeric') { ... }
```

---

## 패턴 C: 인프라 상수 (Infrastructure Constants)

HTTP 상태 코드처럼 **도메인과 무관한 기술적 상수**. Zod enum이 아니므로 Companion Object 대상이 아니다. 설정 상수와 동일하게 프로퍼티는 **camelCase**.

```typescript
// shared/api/api.errors.ts
export const HTTP_STATUS = {
  badRequest: 400,
  notFound: 404,
  conflict: 409,
  internalServerError: 500,
} as const;

// 사용
import { HTTP_STATUS, isHttpError } from '@/shared/api';

if (isHttpError(error, HTTP_STATUS.conflict)) {
  toast.error('동일한 이름이 이미 존재합니다');
}
```

**왜 camelCase인가:** HTTP_STATUS는 enum 대체가 아니라 인프라 상수 객체다. `API_CONFIG`, `API_ENDPOINTS`와 동일한 성격이므로 프로젝트 상수 객체 컨벤션(camelCase 프로퍼티)을 따른다.

---

## 네이밍 컨벤션 근거

| 구분 | 프로퍼티 케이스 | 근거 | 예시 |
|------|---------------|------|------|
| 설정 상수 (Config) | camelCase | 객체 프로퍼티 접근 패턴 | `API_ENDPOINTS.auth.login` |
| 열거형 상수 (Enum) | PascalCase | TS Handbook enum 멤버 컨벤션 (`Direction.Up`) | `OutputType.Numeric` |
| 인프라 상수 (Infrastructure) | camelCase | 설정 상수와 동일 성격 (도메인 무관 기술적 값) | `HTTP_STATUS.conflict` |

**핵심:** 이 셋은 의미가 다르다. 설정 객체는 "계층적 데이터 접근"이고, 열거형 상수는 "유한한 값 집합의 멤버"이며, 인프라 상수는 "도메인 무관 기술적 값"이다. 의미가 다르면 컨벤션도 달라야 한다.

> Google TS Style Guide는 "enum values use CONSTANT_CASE"라고 하지만, 이는 TS `enum` 키워드를 사용하는 경우에 해당한다. Companion Object 패턴은 TS `enum`의 대체이므로 TS Handbook의 PascalCase 멤버 컨벤션(`Direction.Up`, `UserResponse.No`)을 따른다.

---

## `as const satisfies Record<string, T>` 의 역할

```typescript
// satisfies 없이 — 오타를 잡지 못함
export const OutputType = {
  Numeric: 'numericcc', // ← 오타지만 에러 없음!
} as const;

// satisfies 있으면 — 타입 불일치 에러
export const OutputType = {
  Numeric: 'numericcc', // ← Type '"numericcc"' is not assignable to type 'OutputType'
} as const satisfies Record<string, OutputType>;
```

`satisfies`는 값이 지정된 타입에 포함되는지 **컴파일 타임에 검증**하면서, `as const`의 리터럴 타입 추론은 유지한다.

---

## 안티패턴

```typescript
// ❌ Zod 구현 세부사항에 결합 — 라이브러리 내부 API
import { OutputTypeSchema } from '@/shared/api/evaluationMetric';
if (metric.output_type === OutputTypeSchema.enum.numeric) { ... }

// ❌ raw string 비교 — 오타, 리팩토링 시 누락 위험
if (metric.output_type === 'numeric') { ... }

// ✅ 명시적 Companion Object — 자기 문서화, 자동완성, 타입 안전
import { OutputType } from '@/shared/api/evaluationMetric';
if (metric.output_type === OutputType.Numeric) { ... }
```

**왜 `Schema.enum`을 피하는가:** `OutputTypeSchema.enum`은 Zod 라이브러리의 내부 API다. Zod 버전 업데이트나 라이브러리 교체 시 영향을 받는다. 비즈니스 로직에서는 명시적으로 export된 상수만 사용한다.

---

## 관련 문서

- [API 3-File 패턴](api-three-file.md) — `types.ts`에서 Companion Object 정의
- [타입 안전성](type-safety-discriminated.md) — Discriminated Union과 조합
