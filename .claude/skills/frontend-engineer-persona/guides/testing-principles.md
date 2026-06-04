---
title: "테스트 작성 원칙"
description: "Vitest + React Testing Library 단위 테스트 패턴(Provider wrapper, 사용자 관점)과 Playwright E2E 테스트 가이드."
tags: [testing, vitest, react-testing-library, playwright, e2e, unit-test]
category: guide
related:
  - ../guides/verification-process.md
  - ../guides/clean-code.md
---

# 테스트 작성 원칙

## 단위 테스트 (Vitest + RTL)
```typescript
// Provider wrapper 패턴
const renderWithProviders = (onSubmit = vi.fn()) => {
  const user = userEvent.setup();
  render(
    <FormProvider onSubmit={onSubmit}>
      <FormComponent />
    </FormProvider>
  );
  return { user, onSubmit };
};

// 사용자 관점 테스트
it('submits with valid data', async () => {
  const { user, onSubmit } = renderWithProviders();
  await user.type(screen.getByLabelText('Name'), 'Test');
  await user.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test' })
    )
  );
});
```

## E2E (Playwright)
```typescript
// Test ID 사용 (shared/config/test-ids.ts에서 관리)
await page.getByTestId(TEST_IDS.items.page.title).isVisible();
```

---

## 관련 문서

- [작업 검증 프로세스](verification-process.md) — 테스트 실행 명령어
- [클린 코드 원칙](clean-code.md) — 테스트 가능성 원칙
