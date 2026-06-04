---
applicability: "kc-monitoring 프로젝트에서는 Zustand를 사용하지 않음 (frontend/CLAUDE.md 참조). 향후 클라이언트 상태 관리가 필요할 때 참조용으로 보존."
title: "Zustand Store (Provider 패턴)"
description: "SSR 호환을 위해 vanilla store + React Context를 조합하고, selector 훅으로 필요한 값만 구독하는 Zustand 사용 패턴."
tags: [zustand, state-management, provider, context, ssr, selector]
category: pattern
related:
  - ../patterns/hook-composition.md
  - ../patterns/form-provider-controller.md
  - ../guides/fsd-architecture.md
---

# Zustand Store (Provider 패턴)

SSR 호환을 위해 항상 vanilla store + React Context를 조합합니다:

```typescript
// 1. Store 생성 함수 (vanilla)
export const createMyStore = (initialState?: Partial<MyState>) => {
  return createStore<MyStore>()((set) => ({
    items: [],
    isLoading: false,
    ...initialState,
    setItems: (items) => set({ items }),
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  }));
};

// 2. Provider + Context
const MyStoreContext = createContext<ReturnType<typeof createMyStore> | null>(null);

export function MyStoreProvider({ children, initialState }: Props) {
  const storeRef = useRef<ReturnType<typeof createMyStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createMyStore(initialState);
  }
  return (
    <MyStoreContext.Provider value={storeRef.current}>
      {children}
    </MyStoreContext.Provider>
  );
}

// 3. Selector 훅 (전체 구독 절대 금지)
export function useMyStore<T>(selector: (state: MyStore) => T): T {
  const store = useContext(MyStoreContext);
  if (!store) throw new Error('useMyStore must be used within MyStoreProvider');
  return useStore(store, selector);
}
```

**사용 시 규칙:**
```typescript
// ✅ 항상 selector로 필요한 값만 구독
const items = useMyStore((state) => state.items);
const addItem = useMyStore((state) => state.addItem);

// ❌ 전체 상태 구독 금지 (불필요한 리렌더)
const state = useMyStore((s) => s);
```

---

## 관련 문서

- [Hook Composition](hook-composition.md) — store selector와 훅 합성
- [Form Provider+Controller](form-provider-controller.md) — Form 상태 관리와 비교
- [FSD 아키텍처](../guides/fsd-architecture.md) — model/ 세그먼트 배치
