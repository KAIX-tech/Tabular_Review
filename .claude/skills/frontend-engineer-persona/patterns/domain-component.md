---
title: "Domain Component (shared UI + 도메인 데이터)"
description: "shared/ui의 범용 프리미티브에 도메인 전용 상수와 로직을 결합하여, 도메인 내 여러 사용처에서 일관되게 사용하는 캡슐화된 컴포넌트 패턴."
tags: [domain, component, encapsulation, fsd, shared-ui, composition]
category: pattern
related:
  - ../patterns/factory-hook.md
  - ../guides/fsd-architecture.md
  - ../patterns/constants-as-const.md
---

# Domain Component (shared UI + 도메인 데이터)

shared/ui의 범용 프리미티브에 도메인 전용 상수와 로직을 결합하여, 도메인 내에서 일관된 API로 사용하는 컴포넌트.

## 적용 기준

- 같은 도메인의 **2곳 이상**에서 동일한 shared UI + 도메인 상수 조합이 반복될 때
- 상수/로직이 해당 도메인에서만 의미가 있을 때 (다른 도메인에서는 불필요)

## 구조

```
domains/[domain]/
├── ui/
│   ├── [Domain][ComponentName].tsx   # 도메인 컴포넌트
│   ├── CreateForm/
│   │   └── SomeField.tsx             # 사용처 1 (interactive)
│   └── DetailDrawer.tsx              # 사용처 2 (readOnly)
```

## 예시: PrioritySlider

shared `Slider`에 도메인 상수 `PRIORITY_LEVELS`과 라벨 렌더링을 캡슐화:

```typescript
// domains/task/ui/PrioritySlider.tsx
import { Slider } from '@/shared/ui';

export const PRIORITY_LEVELS = ['1', '2', '3', '4', '5'];

interface PrioritySliderProps {
  value: number;
  /** 없으면 readOnly 모드 */
  onValueChange?: (value: number) => void;
}

export function PrioritySlider({ value, onValueChange }: PrioritySliderProps) {
  const readOnly = !onValueChange;

  return (
    <div className="flex flex-col gap-4">
      <Slider
        value={[value]}
        onValueChange={onValueChange ? ([v]) => onValueChange(v) : undefined}
        readOnly={readOnly}
        min={1}
        max={5}
        step={1}
      />
      {/* 우선순위 라벨 렌더링 ... */}
    </div>
  );
}
```

**사용처:**
```typescript
// ✅ Interactive (폼에서 값 변경)
<PrioritySlider value={currentPriority} onValueChange={handlePriorityChange} />

// ✅ ReadOnly (상세 뷰에서 표시 전용)
<PrioritySlider value={task.priority} />
```

## 핵심 원칙

| 항목 | 규칙 |
|------|------|
| **위치** | `domains/[domain]/ui/` — shared가 아닌 도메인 세그먼트 |
| **네이밍** | `[Domain][PrimitiveName]` (예: `PrioritySlider`) |
| **도메인 상수** | 컴포넌트 파일 내부에 정의, named export로 같은 도메인 내 참조 허용 |
| **모드 결정** | optional callback 유무로 readOnly/interactive 추론 |
| **shared 승격 기준** | 2개 이상 도메인에서 동일 조합이 필요할 때 비로소 shared로 이동 |

## Factory Hook과의 차이

| 비교 | Factory Hook | Domain Component |
|------|-------------|-----------------|
| **조합 대상** | shared/lib + shared/model (같은 레이어 내 세그먼트) | shared/ui + 도메인 상수/로직 (레이어 간) |
| **결과물** | 커스텀 훅 (shared/hooks) | 도메인 UI 컴포넌트 (domains/[domain]/ui) |
| **위치** | shared (범용) | domains (도메인 전용) |

---

## 관련 문서

- [Factory Hook](factory-hook.md) — shared 내 세그먼트 조합 패턴 (비교)
- [FSD 아키텍처](../guides/fsd-architecture.md) — 레이어 배치 의사결정
- [상수 정의](constants-as-const.md) — 도메인 상수 타입 추출 패턴
