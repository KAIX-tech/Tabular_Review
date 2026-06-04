---
title: "Form (Provider + Controller 패턴)"
description: "react-hook-form의 FormProvider + 커스텀 Context를 조합하고, Controller로 개별 필드를 제어하는 폼 구현 패턴."
tags: [form, react-hook-form, provider, controller, zod, validation]
category: pattern
related:
  - ../patterns/api-three-file.md
  - ../patterns/zustand-provider.md
---

# Form (Provider + Controller 패턴)

## 폴더 구조

```
{domains,widgets,features}/[slice]/
├── model/[Form]FormContext/      # FormProvider + 커스텀 Context
│   ├── [Form]FormProvider.tsx
│   └── index.ts
└── ui/[Form]Form/                # Form UI
    ├── [Form]Form.tsx            # 레이아웃 + Submit 버튼
    └── [FieldName]Field.tsx      # 개별 필드 (Controller 사용)
```

## FormProvider

`react-hook-form`의 `FormProvider` + 커스텀 Context 조합:

```typescript
const methods = useForm<SomeCreate>({
  resolver: zodResolver(SomeCreateSchema),  // shared/api의 Zod 스키마 재사용
  defaultValues: getDefaultValues(),
  mode: 'onChange',
});
```

## 커스텀 훅

`useFormContext`와 커스텀 Context를 합쳐서 export:

```typescript
export const useSomeFormContext = () => ({
  ...useContext(FormContext),      // submit, isSubmitting
  ...useFormContext<SomeCreate>(), // control, formState, setValue 등
});
```

## Field 컴포넌트

`Controller`로 개별 필드 제어, `fieldState.error`로 에러 표시

## 핵심 원칙

| 항목 | 규칙 |
|------|------|
| **타입** | `shared/api`의 Zod 스키마에서 `z.infer<>` 사용 (중복 정의 금지) |
| **Validation** | `zodResolver`로 통합 (개별 `rules` prop 금지) |
| **Context 위치** | `model/` 세그먼트 |
| **에러 표시** | `fieldState.error.message` 활용 |
| **Submit 제어** | `formState.isValid` + `isSubmitting`으로 버튼 상태 관리 |

---

## 관련 문서

- [API 3-File 패턴](api-three-file.md) — Zod 스키마 zodResolver 재사용
- [Zustand Provider](zustand-provider.md) — Provider 패턴 비교
