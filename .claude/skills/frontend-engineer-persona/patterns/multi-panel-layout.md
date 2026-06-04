---
title: "Multi-Panel Layout"
description: "CSS 높이 체인, 독립 스크롤, 고정/스크롤 영역 분리 패턴. 멀티 패널 레이아웃에서 각 패널이 독립적으로 스크롤되도록 하는 CSS 구조."
tags: [layout, scroll, grid, css, multi-panel, height-chain]
category: pattern
related:
  - ../guides/common-ui-patterns.md
  - ../guides/anti-pattern-checklist.md
---

# Multi-Panel Layout

멀티 패널 UI(채팅, 대시보드 등)에서 각 패널이 **독립적으로 스크롤**되도록 하려면, 루트에서 패널까지 CSS 높이 체인이 끊기지 않아야 한다.

## CSS 높이 체인

`overflow-y: auto`가 동작하려면 **부모의 높이가 제한**되어야 한다. 높이 제약이 루트에서 시작하여 모든 중간 노드를 거쳐 스크롤 대상까지 전파되어야 한다.

```
h-screen (루트: 고정 높이)
  └─ min-h-0 flex-1 (flex 자식: 남은 공간 차지 + 축소 허용)
       └─ min-h-0 flex-1 (중간 노드: 높이 제약 전파)
            └─ min-h-0 overflow-y-auto (스크롤 대상)
```

**핵심:** 모든 중간 flex 자식에 `min-h-0`을 적용해야 한다. flex 자식의 기본 `min-height: auto`는 컨텐츠 크기 이하로 축소되지 않아 overflow가 발생하지 않는다.

## `h-screen` vs `min-h-screen`

| 속성 | CSS | 높이 제한 | 스크롤 |
|------|-----|-----------|--------|
| `h-screen` | `height: 100vh` | ✅ 고정 | ✅ 하위 overflow 동작 |
| `min-h-screen` | `min-height: 100vh` | ❌ 최소값만 설정 | ❌ 컨텐츠만큼 무한 확장 |

```typescript
// ❌ Bad - 높이가 제한되지 않아 하위 요소가 overflow되지 않음
<div className="flex min-h-screen flex-col">

// ✅ Good - 높이가 고정되어 하위 요소의 overflow-y-auto가 동작
<div className="flex h-screen flex-col">
```

## Grid 패널 레이아웃

멀티 패널을 Grid로 배치할 때, `grid-rows-[1fr]`로 행 높이를 제한한다:

```typescript
<div className="grid min-h-0 flex-1 grid-cols-[256px_minmax(0,1fr)_minmax(0,1fr)] grid-rows-[1fr]">
  {/* 왼쪽 패널 */}
  <div className="min-h-0 overflow-y-auto">...</div>

  {/* 가운데 패널 */}
  <div className="flex min-h-0 flex-col">...</div>

  {/* 오른쪽 패널 */}
  <div className="min-h-0 overflow-y-auto">...</div>
</div>
```

- `grid-cols-[256px_minmax(0,1fr)_minmax(0,1fr)]`: 왼쪽 고정폭 + 나머지 균등 분배
- `grid-rows-[1fr]`: 행 높이를 부모 높이로 제한 (기본값 `auto`는 컨텐츠만큼 확장)
- 각 패널 셀에 `min-h-0`: Grid 자식도 `min-height: auto` 기본값 해제 필요

## 고정/스크롤 영역 분리

하나의 패널 안에서 헤더/풋터는 고정, 중앙은 스크롤되는 구조:

```typescript
<div className="flex min-h-0 flex-col">
  {/* 고정 영역 - 헤더 */}
  <div className="shrink-0">
    <Header />
  </div>

  {/* 스크롤 영역 - 메시지 */}
  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
    <MessageList />
  </div>

  {/* 고정 영역 - 입력 */}
  <div className="shrink-0">
    <ChatInput />
  </div>
</div>
```

| 역할 | 클래스 | 설명 |
|------|--------|------|
| 고정 | `shrink-0` | 축소 불가, 자체 높이 유지 |
| 스크롤 | `flex-1 min-h-0 overflow-y-auto` | 남은 공간 차지 + 축소 허용 + 스크롤 |

## 실제 적용 예시: 3-Panel 높이 체인

```
KnowledgeBasePage (h-screen)
  └─ <main> (min-h-0 flex-1)
       └─ Content Area (min-h-0 flex-1)
            └─ SystemKnowledgeContent (grid min-h-0 flex-1 grid-rows-[1fr])
                 ├─ 왼쪽 패널 (min-h-0 overflow-y-auto)
                 ├─ ChatPanel (flex min-h-0 flex-col)
                 │    ├─ 헤더 (shrink-0)
                 │    ├─ 메시지 (flex-1 min-h-0 overflow-y-auto)
                 │    └─ 입력 (shrink-0)
                 └─ 오른쪽 패널 (min-h-0 overflow-y-auto)
```

## 디버깅 체크리스트

스크롤이 동작하지 않을 때:

1. **루트에 고정 높이가 있는가?** `h-screen` (not `min-h-screen`)
2. **모든 중간 flex/grid 자식에 `min-h-0`이 있는가?**
3. **스크롤 대상에 `overflow-y-auto`가 있는가?**
4. **Grid 사용 시 `grid-rows-[1fr]`이 있는가?** (기본 `auto`는 높이를 제한하지 않음)

---

## 관련 문서

- [공통 UI 패턴](../guides/common-ui-patterns.md) — Skeleton 공간 일관성, 점진적 UI 구현
- [안티패턴 체크리스트](../guides/anti-pattern-checklist.md) — `min-h-screen` 스크롤 안티패턴
