---
title: "공통 UI 패턴"
description: "Mutation 토스트 알림, 데이터 페칭 3-State 렌더링, Compound Component(Object.assign), 폼 로딩 상태 처리 등 기본 적용 패턴."
tags: [ui-patterns, toast, skeleton, empty-view, compound-component, form-loading, mutation]
category: guide
related:
  - ../patterns/form-provider-controller.md
  - ../guides/clean-code.md
---

# 공통 UI 패턴

> **이 섹션의 패턴들은 별도 지시 없이 기본으로 적용됩니다.**

## Mutation 토스트 알림

모든 mutation에 성공/실패 토스트를 **반드시** 표시합니다:

```typescript
const mutation = useMutation({
  mutationFn: createItem,
  onSuccess: () => {
    toast.success('항목이 생성되었습니다.');
  },
  onError: () => {
    toast.error('항목 생성에 실패했습니다.');
  },
});
```

## 데이터 페칭 3-State 렌더링

모든 데이터 페칭 페이지는 loading → empty → data 3가지 상태를 처리합니다:

```typescript
if (isLoading) return <ItemList.Skeleton />;
if (!data?.length) return <ItemList.EmptyView />;
return <ItemList data={data} />;
```

### 초기 렌더 결정론

페이지 진입 시 **Skeleton이 가장 먼저** 보여야 한다. EmptyView나 placeholder가 깜빡이면 안 된다.

**문제 상황:** `serviceId` 등 upstream 비동기 의존성이 `null`이면 TanStack Query가 `enabled: false`로 비활성화되어 `isLoading=false`가 된다. 이때 빈 데이터(`[]`)로 EmptyView가 먼저 렌더된다.

**해결:** upstream 비동기 의존성을 로딩 조건에 포함한다.

```typescript
// ✅ Good - serviceId 미확정 시에도 Skeleton 표시
const isLoading = !serviceId || isSessionsLoading || isAgentsLoading;

// ❌ Bad - serviceId=null → enabled=false → isLoading=false → EmptyView 깜빡임
const isLoading = isSessionsLoading || isAgentsLoading;
```

**기대 흐름:**
```
[진입] → Skeleton → serviceId 설정 → 쿼리 실행 → fetch 완료 → 데이터/빈 상태
```

## Compound Component (Object.assign 패턴)

Feature 레벨 이상의 UI 컴포넌트는 Root + Skeleton + EmptyView를 하나의 네임스페이스로 export합니다:

```typescript
function ItemListRoot({ items }: ItemListProps) {
  return (
    <div className="flex flex-col">
      {items.map((item, index) => (
        <div key={item.id}>
          <ItemCard item={item} />
          {index < items.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );
}

function ItemListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index}>
          <Skeleton className="h-16 w-full" />
          {index < 4 && <Divider />}
        </div>
      ))}
    </div>
  );
}

function ItemListEmptyView() {
  return (
    <div className="flex flex-col items-center gap-2 pt-20">
      <p className="text-base font-semibold text-gray-500">No items yet</p>
    </div>
  );
}

export const ItemList = Object.assign(ItemListRoot, {
  Skeleton: ItemListSkeleton,
  EmptyView: ItemListEmptyView,
});
```

## 폼 로딩 상태 처리

| 출처 | 상태값 | 용도 |
|------|--------|------|
| Query Hook | `isLoading \| isPending` | 데이터 페칭 상태 |
| Mutation Hook | `mutation.isPending` | API 요청 진행 상태 |
| Form (react-hook-form) | `formState.isSubmitting` | 폼 제출 상태 |

**버튼 Disabled 처리:**
```typescript
// 기본 패턴: 유효성 + 로딩 조합
disabled={!isValid || isSubmitting}

// 복수 mutation: 다른 작업 진행 중이면 함께 비활성화
disabled={!hasChanges || !isValid || isDeleting}
```

**동적 버튼 텍스트:**
```typescript
{isSubmitting ? 'Creating...' : 'Create'}
```

**Modal/Drawer 닫기 방지:**
```typescript
<Drawer
  open={open}
  onChangeOpen={isOpen => !isOpen && !isSubmitting && onClose()}
>
```

## 점진적 UI 구현 (Layout-First)

복합 UI(멀티 패널, 채팅, 대시보드 등)는 **3단계로 점진 구현**합니다:

1. **레이아웃 구조 확정**: Grid/Flex로 패널 배치, 고정/스크롤 영역 결정
2. **Placeholder UI 배치**: 모든 인터랙티브 요소를 `disabled`로 배치하여 시각적 완성도 확보
3. **API 연동 + 활성화**: 데이터 페칭, 상태 관리, 인터랙션을 점진적으로 연결

```typescript
// Step 2: Placeholder — 모든 입력/버튼 disabled, 레이아웃만 확인
<input placeholder="Enter a question" disabled />
<Button leftIcon={FileUpload} disabled>Upload file</Button>
<IconButton icon={ArrowUpward} disabled />
```

**장점:**
- 레이아웃 문제(스크롤, 높이 체인 등)를 API 연동 전에 발견
- 디자인 리뷰를 기능 구현과 독립적으로 진행 가능
- 기능별 점진적 활성화로 디버깅 범위 축소

## Skeleton 공간 일관성

Skeleton 컴포넌트는 로드 완료 상태와 **동일한 레이아웃 공간**을 차지해야 합니다. 로딩→완료 전환 시 레이아웃 시프트가 발생하면 안 됩니다.

```typescript
// ✅ Good - Root과 Skeleton 모두 h-full로 부모 높이 채움
function PanelRoot() {
  return <div className="flex h-full flex-col gap-2 p-4">...</div>;
}
function PanelSkeleton() {
  return <div className="flex h-full flex-col gap-2 p-4">...</div>;
}

// ❌ Bad - Skeleton이 컨텐츠 높이만큼만 차지 → 로딩 완료 시 레이아웃 점프
function PanelSkeleton() {
  return <div className="flex flex-col gap-2 p-4">...</div>;
}
```

**규칙:**
- 패널형 컴포넌트: Root와 Skeleton **모두** `h-full`
- flex/grid 레이아웃 내 컴포넌트: 동일한 `flex-1`, `min-h-0` 등 공간 규칙 적용
- 외곽 래퍼(padding, border, background)는 Root과 Skeleton에서 동일하게 유지

## 레거시 코드 보존

대규모 UI 리팩토링(레이아웃 전환, 워크플로우 변경 등) 시 기존 코드를 **삭제하지 않고 보존**합니다:

```typescript
// Legacy[Name].tsx — 기존 코드를 별도 파일로 이동
// Legacy 2-column layout. 채팅 기반 워크플로우 전환에 따라 비활성화.
export function LegacySystemKnowledgeContent() {
  // 기존 코드 그대로 보존
}
```

**목적:**
- 롤백 가능성 확보 (새 레이아웃에 문제 발생 시)
- 기존 비즈니스 로직 참조용
- 안정화 확인 후 별도 cleanup 작업으로 제거

---

## 관련 문서

- [Form Provider+Controller](../patterns/form-provider-controller.md) — 폼 구현 상세
- [클린 코드 원칙](clean-code.md) — 성능 최적화, 에러 처리
- [Multi-Panel Layout](../patterns/multi-panel-layout.md) — CSS 높이 체인, 독립 스크롤 패턴
