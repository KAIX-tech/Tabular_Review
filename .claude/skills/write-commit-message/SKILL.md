---
description: Git diff를 분석하여 간결한 Conventional Commits 형식의 커밋 메시지를 작성하는 스킬
tags: [git, commit, conventional-commits]
---

# Write Commit Message Skill

현재 Git diff를 분석하여 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 스펙에 맞는 간결한 커밋 메시지를 작성합니다.

## 역할 (Role)

당신은 **Git 커밋 메시지 작성 전문가**입니다. 코드 변경 사항을 분석하여 명확하고 일관된 커밋 메시지를 작성합니다.

## 실행 단계

### 1단계: Git 상태 확인

다음 명령어들을 병렬로 실행하여 현재 변경 사항을 파악합니다:

```bash
# 변경된 파일 목록 확인
git status --short

# staged 변경 사항 확인
git diff --cached

# unstaged 변경 사항 확인 (참고용)
git diff
```

### 2단계: 변경 사항 분석

변경된 파일의 경로를 분석하여 다음을 파악합니다:

**프로젝트 영역 식별** (scope 참고용):
- `frontend/*` → `frontend` 또는 생략
- `backend/*` → `backend`
- `frontend/src/domains/[name]/*` → 도메인 이름 (예: `auth`, `user`)
- `frontend/src/widgets/*` → `widgets`
- `frontend/src/features/[name]/*` → 기능 이름 (예: `form`, `navigation`)
- `frontend/src/shared/*` → `shared` 또는 생략
- `frontend/src/app/*` → `app` 또는 생략
- 여러 영역에 걸친 변경 → scope 생략

**변경 유형 판단**:
- 새 기능 추가 → `feat`
- 버그 수정 → `fix`
- 리팩토링 → `refactor`
- 스타일/포맷 → `style`
- 테스트 → `test`
- 문서 → `docs`
- 설정/의존성 → `build` 또는 `chore`

### 3단계: 커밋 메시지 작성

## Conventional Commits 형식

```
<type>[optional scope]: <description>

[optional body]
```

### Type (필수)

| Type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `style` | 코드 포맷팅 (동작 변경 없음) |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `docs` | 문서 변경 |
| `build` | 빌드 시스템, 의존성 변경 |
| `chore` | 기타 변경 |

### Scope (선택)

- 프로젝트 영역(frontend, backend) 또는 FSD 레이어/도메인명 사용 가능 (예: `auth`, `shared`, `widgets`)
- 명확한 경우에만 사용, 불분명하면 생략

### Description (필수)

- 명령형 현재 시제 ("add" not "added")
- 첫 글자 소문자
- 마침표 없음
- 50자 이내

### Body (선택, 필요시에만)

- 변경의 **이유**나 **맥락** 설명
- 복잡한 변경이 아니면 생략
- description과 빈 줄로 구분

## 작성 원칙

### 간결성 우선
- Body는 복잡한 변경이나 맥락 설명이 필요한 경우에만 추가
- 대부분의 커밋은 **한 줄(description)**로 충분
- 코드 자체로 설명 가능한 내용은 반복하지 않음

### 좋은 예시

```
feat(auth): add OAuth login flow

fix: resolve image loading issue in Safari

refactor(shared): extract API client to separate module

style: apply Biome formatting rules

docs: update FSD architecture guide

chore(backend): update database dependencies
```

### Body가 필요한 경우

```
feat(domains): implement user profile edit

기존 read-only 프로필 화면에 편집 기능 추가.
Zustand로 상태 관리하며 낙관적 업데이트 적용.
```

```
perf: optimize re-renders in data table

useMemo/useCallback 적용하여 불필요한 리렌더 제거.
1000개 행에서 렌더링 시간 70% 감소.
```

### 피해야 할 패턴

```
❌ fix: fixed bug
❌ feat: added new stuff
❌ update: changes
❌ WIP
❌ 임시 커밋
```

## 출력 형식

분석 결과와 커밋 메시지를 다음 형식으로 제공합니다:

```markdown
## 변경 사항 분석

### 변경된 파일
- [파일 목록]

### 변경 유형
- [변경 내용 요약]

### 관련 영역
- [프로젝트 영역/레이어/도메인명, 해당되는 경우]

---

## 추천 커밋 메시지

```
<type>[scope]: <description>

[body if needed]
```
```

## 언어 선택

- **영어 우선**: 국제 표준, 협업에 유리
- **한국어**: Body에서 상세 설명 시 사용 가능

> 💡 프로젝트의 기존 커밋 히스토리를 확인하여 일관된 스타일을 유지합니다.

---

**Version**: 1.0.0
**Last Updated**: 2025-01-27
