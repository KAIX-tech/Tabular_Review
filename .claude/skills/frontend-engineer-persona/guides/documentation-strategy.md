---
title: "문서화 & 패키지 배포 전략"
description: "AI-First 문서 설계(README ~200줄 + docs/ 분리), npm 배포 관리, semantic-release 파이프라인, 문서 동기화 검증 체크리스트."
tags: [documentation, npm, semantic-release, ai-first, progressive-disclosure, deploy]
category: guide
related:
  - ../guides/verification-process.md
---

# 문서화 & 패키지 배포 전략

## AI-First 문서 설계

문서는 사람과 AI 도구 모두가 효율적으로 소비할 수 있도록 설계한다.

**진입점 README (~200줄):**
- 설치/사용법, 디자인 철학, 컴포넌트 카탈로그(docs/ 링크 포함)
- **빠른 참조 테이블**: import 경로 + 주요 props를 한 테이블로 정리 → README만 읽으면 바로 코딩 가능
- 디자인 의도 요약: 각 컴포넌트가 "왜" 필요한지 2-4줄로 기술 (API 상세와 중복되더라도 포함)

**상세 문서 (docs/):**
- 컴포넌트별 `.md` 파일 분리 (API Reference, 디자인 가이드, 사용 예시)
- 독립 문서이므로 헤딩 레벨 조정 (`###` → `##`)
- npm 패키지에 포함하여 소비측 레포에서 `node_modules/` 경로로 접근 가능

**CLAUDE.md (개발 가이드):**
- 자동 로딩되는 파일 → 코딩 컨벤션, 문서 경로 안내, 새 컴포넌트 체크리스트 배치
- npm 배포 대상 아님 (내부 개발용)

## 패키지 배포 관리

```json
// package.json
{
  "files": ["dist", "docs"]  // docs/를 명시적으로 포함
}
```

**배포 범위 결정 기준:**
| 파일 | 배포 | 이유 |
|------|------|------|
| `dist/` | O | 빌드 산출물 |
| `docs/` | O | README가 링크하는 상세 문서, 소비측 AI 도구 접근용 |
| `README.md` | O (자동) | npm이 항상 포함. 패키지 진입점 |
| `CLAUDE.md` | X | 개발용 컨벤션. `node_modules/` 안에서 자동 로딩 안 됨 |

## 문서 동기화 검증

코드 변경 시 문서 동기화를 **체크리스트로 강제**한다:

- **props 변경**: `docs/components/{name}.md` API 테이블 + README 빠른 참조 테이블 업데이트
- **새 컴포넌트**: docs 신규 생성 + README 카탈로그·빠른 참조·동기화 상태 테이블 모두 추가
- **컴포넌트 삭제/이름 변경**: docs 파일 삭제/변경 + README 모든 관련 테이블 수정

## 릴리스 파이프라인

**semantic-release 설정 (`.releaserc.json`):**
- `feat` → minor, `fix`/`perf`/`refactor`/`docs` → patch
- `docs` 타입도 patch 릴리스 트리거 (문서 변경이 소비측에 영향)
- `style`/`chore`/`test` → 릴리스 없음

**커밋 타입 선택 기준:**
| 변경 내용 | 커밋 타입 | 버전 영향 |
|-----------|----------|----------|
| 새 기능 추가 | `feat` | minor |
| 버그 수정 | `fix` | patch |
| 문서 변경 (docs/ 포함) | `docs` | patch |
| 빌드/CI 설정 변경 | `build` | patch (releaseRules에 있으면) |
| 코드 구조 개선 | `refactor` | patch |

---

## 관련 문서

- [작업 검증 프로세스](verification-process.md) — 빌드 및 배포 전 검증
