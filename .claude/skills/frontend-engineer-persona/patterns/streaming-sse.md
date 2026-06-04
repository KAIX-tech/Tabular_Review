---
title: "Streaming (AsyncGenerator + Handler Registry)"
description: "SSE 스트리밍을 AsyncGenerator로 파싱하고 Strategy 패턴의 handler registry로 메시지를 라우팅하는 구현 패턴."
tags: [streaming, sse, async-generator, strategy-pattern, handler-registry]
category: pattern
related:
  - ../patterns/hook-composition.md
  - ../patterns/type-safety-discriminated.md
---

# Streaming (AsyncGenerator + Handler Registry)

SSE 스트리밍은 AsyncGenerator로 파싱하고, Strategy 패턴의 handler registry로 라우팅합니다:

```typescript
// 파서: AsyncGenerator
async function* parseSSEStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const parsed = parseSSELine(line);
        if (parsed.success && parsed.data) yield parsed.data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// 핸들러 레지스트리: O(1) lookup
const handlerMap = new Map<SSEMessageType, SSEHandler>(
  allHandlers.map((h) => [h.type, h])
);

// 프로세서: 파싱 → 핸들러 라우팅
async function processStream(stream, chatId, callbacks): Promise<StreamResult> {
  const context = { chatId, result: createEmptyResult(), callbacks };
  for await (const message of parseSSEStream(stream)) {
    const handler = handlerMap.get(message.type);
    if (handler) handler.handle(message.content, context);
  }
  return context.result;
}
```

**핵심 원칙:**
- 핸들러는 store를 직접 수정하지 않고, result 객체와 callbacks를 통해 부수효과를 전달
- 파서(Generator)와 프로세서(handler)를 분리하여 각각 독립 테스트 가능
- handler registry는 Map으로 O(1) lookup 보장

---

## 관련 문서

- [Hook Composition](hook-composition.md) — 스트리밍 훅 조합
- [타입 안전성](type-safety-discriminated.md) — SSE 메시지 타입 판별
