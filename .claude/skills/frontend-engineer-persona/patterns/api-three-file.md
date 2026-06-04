---
title: "API 3-File 패턴"
description: "새 도메인 API를 types.ts(Zod) + api.ts(named export) + hooks.ts(TanStack Query) 3개 파일로 구성하는 패턴."
tags: [api, zod, tanstack-query, domain, three-file]
category: pattern
related:
  - ../guides/fsd-architecture.md
  - ../patterns/form-provider-controller.md
  - ../patterns/constants-as-const.md
---

# API 3-File 패턴

새 도메인 API를 추가할 때 항상 3개 파일로 구성합니다:

## `[domain].types.ts` — Zod 스키마가 단일 진실 소스

```typescript
export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string().datetime(),
});
export type Item = z.infer<typeof ItemSchema>;

export const ItemCreateSchema = z.object({
  name: z.string().min(1).max(255),
});
export type ItemCreate = z.infer<typeof ItemCreateSchema>;

export const ItemListResponseSchema = z.object({
  items: z.array(ItemSchema),
  total_size: z.number().default(0),
  next_page_token: z.string().nullable().optional(),
});
export type ItemListResponse = z.infer<typeof ItemListResponseSchema>;
```

## `[domain].api.ts` — Named export 함수 (클래스 메서드 X)

```typescript
export async function listItems(serviceId: string): Promise<ItemListResponse> {
  const response = await apiClient.get<ItemListResponse>(
    API_ENDPOINTS.items.list(serviceId)
  );
  return response.data;
}
```

## `[domain].hooks.ts` — 계층적 Query Key + 조건부 실행

```typescript
const QUERY_KEYS = {
  all: ['items'] as const,
  lists: (serviceId: string) => [...QUERY_KEYS.all, 'list', serviceId] as const,
  list: (serviceId: string, params?: PaginationParams) =>
    [...QUERY_KEYS.lists(serviceId), params] as const,
  detail: (serviceId: string, id: string) =>
    [...QUERY_KEYS.all, 'detail', serviceId, id] as const,
};

// 다른 도메인에서 이 도메인의 캐시를 무효화할 때 사용할 수 있도록 도메인명 alias로 export
export { QUERY_KEYS as ITEM_QUERY_KEYS };

export function useItems(serviceId?: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.list(serviceId ?? ''),
    queryFn: () => {
      if (!serviceId) throw new Error('serviceId is required');
      return listItems(serviceId);
    },
    enabled: !!serviceId,
  });
}

export function useCreateItem(serviceId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ItemCreate) => {
      if (!serviceId) throw new Error('serviceId is required');
      return createItem(serviceId, data);
    },
    onSuccess: () => {
      if (serviceId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(serviceId) });
      }
    },
  });
}
```

---

## Cross-Domain 캐시 무효화

도메인 A의 mutation이 도메인 B의 캐시에 영향을 미칠 때(예: 평가 결과 변경 → 시뮬레이션 결과 목록 갱신), **B가 export한 QUERY_KEYS**를 import하여 사용한다.

### 왜 raw string은 안 되는가

```typescript
// ❌ Bad — raw string으로 cross-domain 무효화
queryClient.invalidateQueries({ queryKey: ['simulations', 'results'] });
// 문제점:
// 1. simulation의 QUERY_KEYS 구조가 변경되면 컴파일 에러 없이 silent failure
// 2. 의존 관계가 코드에 드러나지 않아 리팩토링 시 누락 위험
// 3. 어떤 범위까지 무효화하는지 의도가 불명확

// ✅ Good — exported QUERY_KEYS로 명시적 의존
import { SIMULATION_QUERY_KEYS } from '../simulation/simulation.hooks';
queryClient.invalidateQueries({ queryKey: SIMULATION_QUERY_KEYS.resultsPrefix });
```

### Prefix 키 패턴

파라미터 없이 하위 모든 쿼리를 무효화해야 할 때, prefix 전용 키를 정의한다:

```typescript
const QUERY_KEYS = {
  all: ['simulations'] as const,
  // cross-domain invalidation용 prefix 키
  resultsPrefix: ['simulations', 'results'] as const,
  // full parameter 키 (개별 쿼리 식별)
  results: (serviceId: string, scenarioId: string, simulationId: string) =>
    [...QUERY_KEYS.all, 'results', serviceId, scenarioId, simulationId] as const,
};
```

> **주의**: prefix 키는 즉시 평가되는 배열이므로 `QUERY_KEYS.all` 자기참조 대신 literal 값을 직접 사용한다 (Biome `noInvalidUseBeforeDeclaration` 규칙).

### QUERY_KEYS export 규칙

| 상황 | 조치 |
|------|------|
| 내부에서만 사용 | export 불필요 (private) |
| 다른 도메인에서 캐시 무효화 필요 | `export { QUERY_KEYS as DOMAIN_QUERY_KEYS }` |
| 도메인 레이어(`domains/`)에서 참조 | `shared/api/[domain]` index.ts를 통해 re-export |

---

## 관련 문서

- [FSD 아키텍처](../guides/fsd-architecture.md) — `shared/api` 세그먼트 배치 규칙
- [Form Provider+Controller](form-provider-controller.md) — Zod 스키마 zodResolver 재사용
- [상수 정의](constants-as-const.md) — API_ENDPOINTS 상수 작성
