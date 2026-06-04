---
title: "작업 검증 프로세스"
description: "모든 프론트엔드 작업 완료 후 수행하는 5단계 필수 검증 (Formatting → Linting → TypeCheck → Test → Build)과 도구 설정 가이드."
tags: [verification, lint, biome, vitest, typecheck, build, pipeline]
category: guide
related:
  - ../guides/testing-principles.md
  - ../guides/style-guide.md
---

# 작업 검증 프로세스

## 필수 검증 단계

모든 프론트엔드 작업 완료 후, 다음을 **반드시** 순서대로 검증합니다:

| 단계 | 도구 | 명령어 | 목적 |
|------|------|--------|------|
| 1. Formatting | Biome | `bun run lint` | 코드 포맷 자동 정리 (--write 포함) |
| 2. Linting | Biome | `bun run lint` | 코드 품질 검증 |
| 3. Type Check | TypeScript | `tsc -p tsconfig.build.json` | 타입 안전성 검증 |
| 4. Unit Test | Vitest | `bun run test:run` | 기능 정합성 검증 (도입 시) |
| 5. Build | Vite | `bun run build` | 번들 빌드 성공 여부 |

## 도구 설정 확인

작업 시작 전, 프로젝트에 다음 도구들이 설치·설정되어 있는지 확인합니다. **없으면 최신 버전으로 설치 및 설정합니다.**

### Biome (Formatter + Linter)
```bash
# 설치 확인
bun biome --version

# 미설치 시
bun add -D @biomejs/biome
bun biome init  # biome.json 생성
```

**biome.json 필수 설정:**
- `formatter.indentStyle`: "space"
- `formatter.indentWidth`: 2
- `formatter.lineWidth`: 100
- `javascript.formatter.quoteStyle`: "single"
- `javascript.formatter.jsxQuoteStyle`: "double"
- `linter.enabled`: true
- `organizeImports.enabled`: true

### Vitest (Unit Test)
```bash
# 설치 확인
bun vitest --version

# 미설치 시
bun add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### package.json 스크립트 확인
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.build.json && vite build",
    "lint": "biome check --write --unsafe --no-errors-on-unmatched --files-ignore-unknown=true ./",
    "preview": "vite preview",
    "generate-client": "openapi-ts"
  }
}
```

### Git Hooks (필수)

커밋 시 프론트엔드 변경 사항을 자동 검증하는 pre-commit hook이 설정되어야 합니다.

```bash
# 프로젝트 루트에서 실행
./scripts/install-hooks.sh
```

**확인**: `.git/hooks/pre-commit` 파일 존재 여부로 판단합니다. 미설치 시 위 스크립트를 실행합니다.

**동작 구조**:
- `pre-commit.sh` — 스테이지된 파일 경로에 따라 backend/frontend hook을 조건부 실행
- `frontend-hook.sh` — lint:fix → re-stage → lint → typecheck → test:run

---

## 관련 문서

- [테스트 작성 원칙](testing-principles.md) — Vitest + RTL, Playwright E2E
- [스타일 가이드](style-guide.md) — Biome 포맷팅 규칙
