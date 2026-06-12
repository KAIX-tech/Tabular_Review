# Phase 5 — 에이전트 품질 고도화 계획 (챗 우선 + 추출 검증 루프)

> 본 문서는 **구현 계획(plan)** 이다. 도메인/테이블/API의 **진실원천은
> [domain-design.md](domain-design.md)** 이며 — 특히 §2.13 도구 카탈로그(본 phase에서 갱신),
> §2.12 검색 파이프라인, §10 로드맵. 구현 중 스펙과 어긋나면 domain-design.md를 같은
> 변경에서 갱신한다. Phase 4(챗 풀스택)는 완료 — [phase-4-chat-plan.md](phase-4-chat-plan.md).

상태: **draft** · 대상: 챗 에이전트 도구/검색 고도화 + 추출 자기검증 루프

---

## 0. 방향 결정 (왜 챗 먼저인가)

서비스 품질 = `추출 데이터 품질 × 검색 품질 × 에이전트 행동 품질`. 두 후보 중:

1. **챗 에이전트 고도화** ← **우선**
2. 문서 추출 Agent화 ← 후속(얇은 검증 루프만 선반영)

근거:
- **추출에는 사람 검증(그리드)이라는 안전망이 이미 있다.** 배치 작업이라 지연도 허용.
  챗은 안전망이 없어 검색 미스·에이전트 루프가 그대로 사용자에게 노출된다(운영에서
  실제 발생: 도구 호출 루프 → phase-4 후속으로 가드 추가).
- 챗이 제품의 1차 표면(§9 #18).
- 추출 full agent화는 온프렘 GLM 처리량을 크게 소모 — 검증 병목이 실측될 때 진행.

단, 추출 쪽도 **자기검증(self-check) 1회 + low-confidence 재시도**라는 얇은 루프(B1)는
싸게 효과를 보므로 본 phase 후반에 포함한다.

---

## 1. 핵심 결정 (D12–D16; D1–D11 = phase-4)

| # | 결정 |
|---|---|
| D12 | **`find_documents` 도구 신설** — 문서명 키워드 검색(ILIKE 부분일치, 다중 키워드 AND). 전 DB 횡단(스코프 세션은 해당 DB 한정). 상한 20건 + `truncated` 표시(D11 컨벤션). 0건이면 에이전트가 `search_chunks` 폴백(프롬프트 규칙). |
| D13 | **`query_cells` 서버측 필터** — 모델이 raw SQL을 쓰지 않는다(인젝션·스키마 환각 루프 방지). **구조화 필터 DSL**(`filters=[{columnId,op,value}]`)을 받아 서버가 파라미터라이즈드 SQL로 컴파일. v1 op = `eq/ne/contains/in/is_empty` + `count_only`. 범위 비교(gte/lte: number/date 캐스팅)는 v2. list 컬럼은 `value_json`(JSONB) containment. |
| D14 | **골든 평가셋** — 대표 질의 20~30문항(정형/비정형/조회형/집계형)을 fixture로 두고, Langfuse 트레이스와 함께 운영 스모크에 사용. 채점은 수동(정답 문서/셀 id 명시) — 자동 채점은 후속. |
| D15 | **하이브리드 검색 + 리랭커** — `search_chunks`를 키워드(Postgres full-text/trigram) + 벡터 병합 후 BGE-Reranker-V2-M3 재정렬로 교체(§2.12에 이미 예정). 법률 문서의 정확 어휘 매칭("제12.3조", "Change of Control") 보강. |
| D16 | **추출 자기검증 루프(얇은 agent화)** — full ReAct 재설계 대신: 추출 직후 self-check 1회("quote가 value를 뒷받침하는가") → 불일치 시 confidence 강등, low-confidence는 다른 청크 컨텍스트로 1회 재추출 후 비교. 사람 검증 부담 절감이 목표. |

---

## 2. A1 — `find_documents` (D12)

**문제**: 예시 질문이 "OOO 문서를 찾아줘" 형태인데, 현재 도구로는 이름 기반 문서 탐색이
불가(전 DB `list_documents` 순회 필요 — 스텝 낭비 + D11 절단).

**도구 계약** (§2.13 카탈로그에 추가):

```
find_documents(keyword: str, document_db_id?: str)
→ [{id, name, status, documentDbId, documentDbName}] (상한 20건, truncated 표시)
```

- 매칭: `name ILIKE '%kw%'`, 공백 구분 다중 키워드는 AND. 대소문자 무시.
- 스코프 세션(`scope_document_db_id`)이면 해당 DB로 강제 제한(D7과 동일 규칙).
- 구현: `ingestion` read 포트에 `search_documents_by_name(keyword, document_db_id?, limit)`
  추가 → `AgentToolset` 포트 7번째 메서드 → `CatalogAgentToolset` 어댑터(D11 캡 적용).
- 시스템 프롬프트: "문서를 이름으로 찾을 때는 find_documents 먼저. 0건이면 search_chunks로
  내용 검색 폴백." + 루프 가드(동일 호출 반복 금지)는 기존 적용.
- 파일명·실제 제목 불일치(예: `KC_SMF-#93975-v8-…`) 한계는 v1에서 수용 — 첫 헤딩/제목
  컬럼 매칭 확장은 후속.

**테스트**: toolset 단위(키워드 AND/스코프/캡) + agent loop 오프라인(find→get_document 시나리오).

## 3. A4 — `query_cells` 서버측 필터 (D13)

**문제**: 현재 50행 덤프(D11 캡)를 모델이 컨텍스트에서 거름 — DB가 커지면 절단으로 오답.
"X 조항 있는 계약은?"·"몇 건?" 류 정형 질의는 서버가 걸러서/세서 줘야 한다.

**도구 계약** (기존 도구 확장 — 새 도구 아님, 모델 프롬프트 비용 최소화):

```
query_cells(document_db_id, column_ids?, filters?, sort?, limit?, count_only?)
filters = [{columnId, op, value}]          # AND 결합 (OR은 v2)
op(v1)  = eq | ne | contains | in | is_empty
count_only = true → {total, byValue?: {...}} (행 덤프 없이 집계만)
```

- 컴파일: cell 테이블 self-join 또는 문서별 피벗 후 WHERE — **파라미터라이즈드만**,
  문자열 조립 금지. 필터 대상 컬럼이 해당 DB 소속인지 검증(타 DB columnId 거부).
- 타입 정책(v1): 모든 op는 text 비교(`value` 컬럼) + list 컬럼의 `contains/in`은
  `value_json` JSONB containment. **gte/lte(숫자·날짜 캐스팅)는 v2** — 캐스팅 실패 행
  무시 정책과 함께.
- `sort`: `{columnId, dir}` 텍스트 정렬(v1). `limit` 기본 50(D11 유지).
- 시스템 프롬프트: "정형 조건은 filters로 서버에서 거른다. 개수 질문은 count_only.
  필터 op는 list_columns의 타입에 맞게."
- API 표면 변화 없음(도구 계약만) — domain-design §2.13 갱신으로 충분.

**테스트**: 필터 컴파일 단위(op별/스코프 위반/JSONB containment) + count_only +
agent loop 오프라인("있음 필터 → count" 시나리오).

## 4. A2 — 골든 평가셋 (D14)

- `backend/tests/chat/golden_questions.md`(또는 yaml): 질문, 기대 출처(문서/셀 id 또는
  서술), 기대 행동(사용 도구) 20~30문항. 유형: 문서 조회형 / 정형 필터형 / 집계형 /
  비정형 근거형 / 스코프 세션형.
- 용도: ① 운영 스모크 체크리스트(LLM E2E는 운영 pull로 — 기존 검증 전략 유지),
  ② Langfuse 트레이스 리뷰 기준점, ③ A3/A4 전후 비교.
- 자동 채점 러너는 비목표(후속) — dev LLM 키 발급 후 검토.

## 5. A3 — 하이브리드 검색 + 리랭커 (D15, 개요)

- `search_scoped`(ingestion)를 2단계로: ① 후보 수집 = 벡터 top-k ∪ 키워드 매치
  (Postgres `to_tsvector`(simple) 또는 pg_trgm — 한국어 형태소는 비목표, 부분일치로 충분)
  ② BGE-Reranker-V2-M3 cross-encoder 재정렬 → 상위 k 반환.
- 리랭커 서빙: 온프렘 TEI/로컬(임베딩과 동일 패턴) — 인프라 확인 후 상세 설계.
- 본 phase에서는 **설계 확정 + 인터페이스 자리만**(포트 시그니처에 영향 없음 — 내부 교체).

## 6. B1 — 추출 자기검증 루프 (D16, 개요)

- processor `_save` 전 단계에 self-check 1회: 추출 결과(value, quote)를 모델에 재제시 —
  "quote가 value를 뒷받침하는가? yes/no + 보정값". no → confidence 강등(low) 또는 보정.
- low-confidence(또는 quote 미발견) 셀: 폴백 검색으로 다른 컨텍스트 1회 재추출, 두 결과
  일치 시 confidence 승격.
- LLM 호출 +1~2회/셀 — 운영 GLM 처리량 확인 후 기본 off 설정(`EXTRACTION_SELF_CHECK`)
  으로 시작.

---

## 7. 구현 순서 (PR 분할)

| PR | 내용 | 비고 |
|---|---|---|
| 5-A | `find_documents` 도구(포트→어댑터→프롬프트) + 골든 평가셋 초안 | 작고 독립적, 체감 즉시 |
| 5-B | `query_cells` filters/count_only(v1 op) + 프롬프트 갱신 | §2.13 갱신 동반 |
| 5-C | 하이브리드 검색 + 리랭커(인프라 확인 후) | search_chunks 내부 교체 |
| 5-D | 추출 self-check + 재시도(설정 게이트) | 운영 처리량 확인 후 |

각 PR: 오프라인 테스트(fake 모델/toolset) → 운영 브랜치 pull 스모크(골든셋 일부) → 머지.

## 8. 검증 전략

phase-4 §6과 동일 — dev LLM 키 부재로 **LLM E2E는 운영 pull 스모크**, 로컬은 LLM 없는
단위/agent-loop 테스트. 골든 평가셋(A2)이 스모크 체크리스트 역할.

## 9. domain-design.md 정합

- §2.13 도구 카탈로그: `find_documents` 행 추가, `query_cells` 입력에 filters/count_only
  반영 (본 계획과 함께 갱신).
- §2.12 검색 파이프라인: 리랭커 활성화 시점에 하이브리드 단계 기술 갱신(5-C).
- §10 다음 단계: Phase 5 로드맵으로 교체.
