# Session Retrospective Skill

세션 작업 흐름을 회고하여 반복된 실수 패턴을 식별하고, 스킬/가이드/규칙 파일을 개선하는 스킬입니다.

## 주요 기능

- 세션 타임라인 재구성 (왕복 횟수, 각 원인 분석)
- 실수 패턴 분류 (7가지 유형)
- 근본 원인 분석 (5 Whys 축약)
- 기존 스킬/가이드/규칙 파일에 개선안 매핑
- 승인 후 실제 파일 수정 및 MEMORY.md 업데이트

## 사용 방법

```
/session-retrospective
```

또는 Claude에게 다음과 같이 요청:
```
이번 세션 회고해줘
현재 세션 회고하고 스킬 개선 제안해줘
```

## 회고 트리거 기준

- 사용자 피드백 → 수정 왕복 3회 이상
- 같은 원인의 테스트/lint 실패 2회 이상 반복
- 사용자의 명시적 요청

## 실행 흐름

```
1. 세션 타임라인 재구성
2. 실수 패턴 분류 (7가지 유형)
3. 근본 원인 분석
4. 스킬/가이드/규칙 파일에 개선안 매핑
5. Plan 모드에서 개선안 작성
6. 사용자 승인 후 파일 수정
```

## 분석 대상 파일

| 디렉토리 | 용도 |
|----------|------|
| `.claude/skills/*/SKILL.md` | 핵심 원칙, 의사결정 기준 (모든 스킬에 존재) |
| `.claude/skills/frontend-engineer-persona/guides/` | FE 기술 가이드 (DS, 테스트, 아키텍처 등 9개) |
| `.claude/skills/frontend-engineer-persona/patterns/` | FE 구현 패턴 (10개) |
| `.claude/skills/react-best-practices/rules/` | React/Next.js 성능·패턴 규칙 (57개) |
| `.claude/rules/` | 파일 패턴별 자동 적용 규칙 (`backend.md`, `alembic.md`, `design-system-components.md`) |

---

**Version**: 1.0.1
**Last Updated**: 2026-02-24
