---
title: "클린 코드 원칙"
description: "가독성, 구조화, 단순성, 예측 가능성, 일관성, 성능, 에러 처리, 테스트 가능성, Hooks 규칙, 접근성의 10가지 원칙."
tags: [clean-code, readability, srp, kiss, yagni, performance, accessibility, hooks]
category: guide
related:
  - ../guides/style-guide.md
  - ../guides/anti-pattern-checklist.md
---

# 클린 코드 원칙

## 1. 가독성 (Readability)
- 이름만 보고 역할 파악 가능
- 한 함수는 하나의 일만
- 주석은 "무엇"이 아니라 "왜"

## 2. 구조화 (Modularity)
- **단일 책임 원칙 (SRP)**: 컴포넌트는 한 가지 역할만
- **DRY**: 중복 로직은 공통 유틸리티나 커스텀 훅으로 추출
- **관심사 분리**: 데이터(`api/`) / 비즈니스 로직(`lib/`, `model/`) / UI(`ui/`)

## 3. 단순성 (Simplicity)
- **KISS**: 과도한 추상화 금지, 기본 기능 활용
- **YAGNI**: 필요하지 않은 기능 미리 구현 금지
- **적절한 크기**: 200~300줄 이상이면 분리 고려

## 4. 예측 가능성 (Predictability)
- **Pure Functions**: 부작용 없는 함수
- **Immutable Data**: 직접 수정 금지, 새 객체 생성 (`.toSorted()` 등)

## 5. 일관성 (Consistency)
- 네이밍 규칙 통일 (PascalCase, camelCase)
- 폴더 구조 일관성 (FSD 아키텍처)
- 자동 포맷팅 (Biome)

## 6. 성능 최적화

**Async Waterfall 제거** — 독립적인 비동기 작업은 `Promise.all()` 병렬 실행
```typescript
// ❌ 순차 실행
const user = await fetchUser(userId);
const posts = await fetchPosts(userId);

// ✅ 병렬 실행
const [user, posts] = await Promise.all([
  fetchUser(userId),
  fetchPosts(userId),
]);
```

**Re-render 최적화** — lazy initialization, 단일 패스 연산
```typescript
const [data, setData] = useState(() => expensiveComputation());
```

**Bundle Size 최적화** — 무거운 라이브러리는 동적 import
```typescript
const Chart = dynamic(() => import('heavy-chart-library'));
```

## 7. 에러 처리
- **Fail Fast**: 조건 불만족 시 Early Return
- try/catch 또는 React Query의 onError 활용

## 8. 테스트 가능성
- 비즈니스 로직을 UI에서 분리
- 작은 단위 테스트 우선
- Mock 가능한 구조 (의존성 주입)

## 9. React Hooks 규칙
- Hook은 **반드시** 최상위에서만 호출
- `useEffect` 의존성 배열에 모든 외부 값 포함
- `useEffect`에서 cleanup 함수 반환 (타이머, 구독 등)

## 10. 접근성 (Accessibility)
- 시맨틱 HTML (`<button>`, `<nav>`, `<main>`)
- 이미지에 `alt` 속성 필수
- 키보드 탐색 가능
- WCAG AA 기준 준수

---

## 관련 문서

- [스타일 가이드](style-guide.md) — 포맷팅 및 명명 규칙
- [안티패턴 체크리스트](anti-pattern-checklist.md) — 클린 코드 위반 사례
