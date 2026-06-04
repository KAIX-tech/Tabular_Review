---
title: "타입 안전성 (Discriminated Union + Type Guard)"
description: "messageType 등 판별 필드 기반의 Discriminated Union 정의와 타입 가드 함수로 안전한 narrowing을 수행하는 패턴."
tags: [typescript, discriminated-union, type-guard, narrowing, type-safety]
category: pattern
related:
  - ../patterns/constants-as-const.md
  - ../guides/style-guide.md
---

# 타입 안전성 (Discriminated Union + Type Guard)

```typescript
type ChatMessage = UserMessage | AssistantMessage | WarningMessage;

interface UserMessage extends BaseMessage {
  messageType: 'user';
}

interface AssistantMessage extends BaseMessage {
  messageType: 'assistant';
  docLinks: DocLink[];
}

// 타입 가드
export function isUserMessage(msg: ChatMessage): msg is UserMessage {
  return msg.messageType === 'user';
}

// ✅ 타입 가드로 안전하게 narrowing
{messages.map((msg) => {
  if (isAssistantMessage(msg)) {
    return <AssistantView key={msg.id} message={msg} />;
  }
  return <UserView key={msg.id} message={msg as UserMessage} />;
})}
```

**핵심 원칙:**
- `as` 타입 캐스팅으로 렌더링 분기하지 않고, 타입 가드 함수 사용
- 판별 필드(discriminant)는 string literal로 명확히 구분
- 공통 필드는 BaseMessage에, 분기별 필드는 각 인터페이스에

---

## 관련 문서

- [상수 정의](constants-as-const.md) — as const와 조합하여 타입 리터럴 활용
- [스타일 가이드](../guides/style-guide.md) — Type vs Interface 사용 기준
