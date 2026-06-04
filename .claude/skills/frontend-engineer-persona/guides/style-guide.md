---
title: "스타일 가이드"
description: "Biome 포맷팅 규칙, 명명 컨벤션, 함수 선언 방식, Import 순서, TypeScript 규칙, 조건부 렌더링, 이벤트 핸들러 패턴."
tags: [style, formatting, naming, biome, typescript, conventions]
category: guide
related:
  - ../guides/fsd-architecture.md
  - ../guides/clean-code.md
  - ../guides/verification-process.md
---

# 스타일 가이드

## 코드 포맷팅 (Biome)

- **들여쓰기**: 2 스페이스
- **줄 길이**: 100자
- **따옴표**: JS 싱글 (`'`), JSX 더블 (`"`)
- **세미콜론**: 항상 사용
- **Import 정렬**: Biome `organizeImports` 자동 정렬
- **모듈 경로**: 슬라이스 간 import는 `@/` alias 필수. 같은 슬라이스 내부에서는 상대경로 사용

## 명명 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트/타입/인터페이스 | PascalCase | `LoginForm`, `User` |
| 함수/변수 | camelCase | `handleSubmit`, `userData` |
| 커스텀 훅 | `use` 접두사 | `useAuth`, `useUserData` |
| Boolean | `is`, `has`, `should`, `can` 접두사. HTML/React 관용적 속성명은 예외 | `isLoading`, `hasPermission`, `canEdit`. 예외: `disabled`, `open`, `readOnly`, `loading`, `checked`, `selected`, `required`, `hidden` |
| 상수 | 최상위 `CONSTANT_CASE`, 프로퍼티 `camelCase` | `API_ENDPOINTS.auth.login` |
| enum-like 상수 (Companion Object) | PascalCase 프로퍼티 | `OutputType.Numeric`, `TaskStatus.InProgress` |
| 파일 (컴포넌트) | PascalCase | `UserProfile.tsx` |
| 파일 (훅) | `use` 접두사 | `useAuth.ts` |
| 파일 (유틸/상수) | camelCase | `apiClient.ts` |
| 파일 (테스트) | 원본 + `.test` | `LoginForm.test.tsx` |

## 함수 선언
```typescript
// ✅ function 키워드 + Named Export
export function LoginForm() {}

// ❌ Arrow function export
export const LoginForm = () => {};
```

## Import 순서 (Biome 자동 정렬)
```typescript
'use client';

// 1. React
import { useState, useCallback } from 'react';

// 2. Third-party
import { Button } from '@radix-ui/react-button';
import { useQuery } from '@tanstack/react-query';

// 3. Internal (슬라이스 간: @/ alias 필수, 같은 슬라이스 내부: 상대경로)
import { useServiceId } from '@/shared/model';
import { ROUTES } from '@/shared/config';
```

## TypeScript
- **Type vs Interface**: 객체는 `interface`, Union/Tuple은 `type`
- **any 최소화**: 제네릭 `<T>` 또는 `unknown` + 타입 가드 사용
- **Strict Mode**: `strict: true`, null/undefined 체크 필수 (optional chaining 활용)

## 조건부 렌더링
```typescript
// ✅ Early return으로 중첩 감소
if (isLoading) return <Skeleton />;
if (isEmpty) return <EmptyView />;
return <DataView data={data} />;

// ❌ 중첩 삼항 연산자
return isLoading ? <Skeleton /> : isEmpty ? <EmptyView /> : <DataView />;
```

## 조건부 className

조건부 className은 `cn()` + **clsx Object 문법**으로 통일한다.

```typescript
import { cn } from '@/shared/lib';

// ✅ Object 문법 — 단일 조건
className={cn('flex items-center gap-2', { 'pointer-events-none': isSubmitting })}

// ✅ Object 문법 — 양자택일
className={cn('text-lg font-semibold', {
  'text-gray-900': isActive,
  'text-gray-400': !isActive,
})}

// ✅ Object 문법 — 복수 클래스 그룹
className={cn('flex w-full items-start gap-1', {
  'cursor-not-allowed opacity-50': disabled,
  'cursor-pointer hover:bg-black/[0.04]': !disabled,
})}

// ❌ && 패턴
cn('base', isSubmitting && 'pointer-events-none')

// ❌ 삼항 패턴
cn('base', isActive ? 'text-800' : 'text-400')

// ❌ 스타일을 변수로 분리
const triggerClassName = ['flex', isActive ? 'bg-gray' : ''].join(' ');
```

**예외:** 동적 변수 보간(`style.className`, prop `className`)은 Object 문법 대상 아님.

**`cn()` 구현:** `clsx` + `tailwind-merge`로 구성. 커스텀 타이포그래피 클래스가 있으면 `extendTailwindMerge`로 별도 그룹 등록하여 텍스트 색상 클래스와의 충돌을 방지.

## 이벤트 핸들러
```typescript
// ✅ handle 접두사 + 별도 함수
const handleSubmit = async (data: ItemCreate) => {
  try {
    await createItem(data);
    toast.success('생성되었습니다.');
    router.back();
  } catch {
    toast.error('생성에 실패했습니다.');
  }
};

// ❌ 인라인 함수
<button onClick={() => { /* 복잡한 로직 */ }} />
```

---

## 관련 문서

- [FSD 아키텍처](fsd-architecture.md) — Import 경로 및 모듈 구조
- [클린 코드 원칙](clean-code.md) — 가독성, 일관성 원칙
- [작업 검증 프로세스](verification-process.md) — Biome 린팅 실행
