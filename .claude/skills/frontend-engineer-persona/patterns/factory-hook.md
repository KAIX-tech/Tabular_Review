---
title: "Factory Hook (세그먼트 조합)"
description: "shared/lib(순수 유틸) + shared/model(상태)을 조합하여 사용처의 import를 단일화하는 브릿지 훅 패턴. shared/hooks에 위치."
tags: [hooks, factory, composition, shared-hooks, bridge, segments]
category: pattern
related:
  - ../patterns/hook-composition.md
  - ../guides/fsd-architecture.md
---

# Factory Hook (세그먼트 조합)

여러 세그먼트(lib + model)를 조합하여 사용처의 import를 단일화하는 패턴. `shared/hooks/`에 위치한다.

```typescript
// shared/hooks/useDatetime.ts
import {
  DATE_FORMAT,
  formatDateTime as formatDateTimeFn,
  isSameTime as isSameTimeFn,
} from '@/shared/lib';
import { useClientTimezone } from '@/shared/model';

export function useDatetime() {
  const timezone = useClientTimezone();

  return {
    formatDateTime: (date: Date | string | number, pattern?: string) =>
      formatDateTimeFn(date, timezone, pattern),
    isSameTime: (a: Date | string | number, b: Date | string | number) =>
      isSameTimeFn(a, b, timezone),
    timezone,
    DATE_FORMAT,
  };
}
```

**사용 시:**
```typescript
// ✅ 단일 import, timezone 자동 바인딩
import { useDatetime } from '@/shared/hooks';
const { formatDateTime } = useDatetime();
formatDateTime(date);  // timezone 인자 불필요

// ❌ 개별 import + 수동 timezone 전달
import { formatDateTime } from '@/shared/lib';
import { useClientTimezone } from '@/shared/model';
```

**Factory Hook 도입 기준:**
- 사용처 3곳 이상에서 동일한 세그먼트 조합이 반복될 때
- 순수 유틸 함수 자체는 `lib/`에 유지하고, 조합 훅만 `hooks/`에 추가

---

## 관련 문서

- [Hook Composition](hook-composition.md) — 복잡한 훅 분리 합성
- [FSD 아키텍처](../guides/fsd-architecture.md) — shared/lib vs shared/hooks 배치 기준
