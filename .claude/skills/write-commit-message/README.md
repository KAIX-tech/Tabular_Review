# Write Commit Message Skill

Git diff를 분석하여 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 형식의 간결한 커밋 메시지를 작성하는 스킬입니다.

## 주요 기능

- Git diff 자동 분석
- Conventional Commits 스펙 준수
- 프로젝트 영역 및 FSD 아키텍처 레이어 기반 scope 추천
- 간결한 커밋 메시지 작성 (body는 필요시에만)

## 사용 방법

### 기본 사용

staged된 변경 사항을 분석하여 커밋 메시지를 추천합니다:

```
/write-commit-message
```

또는 Claude에게 다음과 같이 요청:
```
커밋 메시지 작성해줘
```

### 예시 출력

```markdown
## 변경 사항 분석

### 변경된 파일
- frontend/src/domains/auth/ui/LoginForm.tsx
- frontend/src/domains/auth/api/useLogin.ts

### 변경 유형
- 새로운 기능 추가 (소셜 로그인)

### 관련 영역
- frontend/domains/auth

---

## 추천 커밋 메시지

```
feat(auth): add OAuth login flow
```
```

## Conventional Commits 타입

| Type | 설명 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 |
| `style` | 코드 포맷팅 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `docs` | 문서 변경 |
| `build` | 빌드 시스템 변경 |
| `chore` | 기타 변경 |

## Scope 가이드

프로젝트 영역 및 FSD 아키텍처를 따르는 경우 scope 활용:

- `frontend/src/domains/auth/*` → `feat(auth):`
- `frontend/src/features/form/*` → `feat(form):`
- `frontend/src/widgets/*` → `feat(widgets):`
- `frontend/src/shared/*` → `feat(shared):` 또는 생략
- `backend/*` → `chore(backend):`
- 여러 영역 변경 시 → scope 생략

## 간결성 원칙

- **대부분의 커밋은 한 줄로 충분**
- Body는 복잡한 변경이나 맥락 설명이 필요한 경우에만 추가
- 코드 자체로 설명 가능한 내용은 반복하지 않음

---

**Version**: 1.0.0
**Last Updated**: 2025-01-27
