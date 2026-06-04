---
title: "Hook Composition"
description: "복잡한 훅을 작은 단위 훅으로 분리하고 합성하여 테스트 가능성과 재사용성을 높이는 패턴."
tags: [hooks, composition, separation-of-concerns, react]
category: pattern
related:
  - ../patterns/factory-hook.md
  - ../patterns/zustand-provider.md
---

# Hook Composition

복잡한 훅은 작은 단위로 분리한 뒤 합성합니다:

```typescript
export function useChat() {
  const { chatId } = useChatSession();
  const { isPolling, startPolling, stopPolling } = useChatPolling({ chatId });
  const { sendMessage, isStreaming } = useSendMessage({
    onStartPolling: startPolling,
    onStopPolling: stopPolling,
  });

  const resetChat = useCallback(() => {
    chatSessionStorage.clearChatId();
    stopPolling();
    reset();
  }, [reset, stopPolling]);

  return { chatId, messages, isStreaming, isPolling, sendMessage, resetChat };
}
```

**분리 기준:**
- 각 훅이 하나의 관심사만 담당
- 훅 간 의존성은 파라미터/콜백으로 명시적 전달
- 최상위 훅은 조합만 수행, 직접 로직 최소화

---

## 관련 문서

- [Factory Hook](factory-hook.md) — lib + model 세그먼트 조합 패턴
- [Zustand Provider](zustand-provider.md) — store selector와 함께 사용
