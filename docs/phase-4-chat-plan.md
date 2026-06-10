# Phase 4 — 챗(Agentic Search) 구현 계획

> 본 문서는 **구현 계획(plan)** 이다. 도메인/테이블/API의 **진실원천은
> [domain-design.md](domain-design.md)** 이며 — 특히 **§2.13 챗 Agentic Search**, §2.9–2.11
> 엔티티, §5 DDL, §6.5 API, §9(결정 13–16). 본 문서는 그 스펙을 "어떻게/어떤 순서로"
> 구현할지를 정한다. 구현 중 스펙과 어긋나면 domain-design.md를 같은 변경에서 갱신한다.

상태: **draft** · 대상: `chat` 바운디드 컨텍스트(에이전트) 신규 구현 + 프론트 mock→real

---

## 0. 목표 / 비목표

**목표**: 단발 RAG가 아니라 **에이전트가 카탈로그를 탐색**(Document DB 목록 → 컬럼 →
문서/셀/청크)하여 **정형(추출 그리드 값)·비정형(원문) 질의를 함께** 답하고, 진행 과정을
SSE로 보여주며 출처(청크/셀)를 연결한다.

**비목표(후속)**: 리랭커(BGE-Reranker), 인증/권한(유저별 세션), native function-calling
최적화, `query_cells` 고급 필터/집계 엔진.

---

## 1. 핵심 결정 (domain-design.md §9 #13–16 확정 반영)

| # | 결정 |
|---|---|
| D1 | **Agentic Search** — 에이전트가 도구로 카탈로그를 탐색(§2.13). 청크 검색은 도구 중 하나. |
| D2 | **provider-portable JSON 도구 루프** — `TextGenerationPort.generate_json` 재사용. native function-calling 불필요(Gemini·온프렘 GLM 동작). |
| D3 | **출처 = 청크 + 셀** — ChatSource `chunk_id`(비정형) 또는 `cell_id`(정형). |
| D4 | **SSE 라이브 스트림** — `step`→`answer`→`done`. 스텝은 `ChatMessage.steps`(jsonb)에 저장. |
| D5 | **서버 영속 세션/메시지/출처/스텝** (localStorage→서버). |
| D6 | **인증 없음** — `created_by` nullable, 유저 필터링 생략(별도 트랙). |
| D7 | **스코프** — 전역(에이전트가 DB 선택) 또는 `scope_document_db_id`로 도구 접근 제한. |
| D8 | **오케스트레이션 = LangGraph(커스텀 StateGraph)** — 프리빌트 react agent 대신 reason 노드가 `generate_json` 호출(포터블 유지). app/infra 레이어 한정, 도메인 순수(§9 #17). |

---

## 2. 백엔드 설계 (DDD 신규 컨텍스트 `chat` = 오케스트레이터)

```
app/domains/chat/
├── domain/      models(ChatSession/Message/Source/Step, ChatRole)
│                ports(ChatRepository, AgentToolset[read 포트 집합], errors)  # 프레임워크 import 금지
├── application/ agent.py(LangGraph StateGraph: reason/act/finalize) + service.py(세션 CRUD + run)
├── infrastructure/ models(ORM) + repositories + AgentToolset 어댑터(타 컨텍스트 read 포트)
└── interface/   schemas(DTO) + router(SSE) + dependencies
```

> LangGraph/`langchain-core`는 application/infra 레이어에서만 import. reason 노드의 LLM 호출은
> 우리 `TextGenerationPort.generate_json`(포터블, Langfuse 트레이싱 유지).

### 2.1 에이전트 도구 (read-only 포트; §2.13 도구 카탈로그)

각 도구는 **기존 컨텍스트의 read 포트**로 구현(직접 import 금지, main.py 조립):
- `list_document_dbs` / `list_columns` → `document_db` read 포트
- `list_documents` / `get_document` / `search_chunks` → `ingestion` read 포트(§2.12 검색 재사용)
- `query_cells` → `extraction` read 포트(셀 그리드 + cellId)

→ `chat` 도메인에 **`AgentToolset` 포트**(위 6개 메서드)를 정의하고, infra 어댑터가 각
컨텍스트 read 포트(또는 서비스)를 호출해 구현. 표시 메타(documentName/db)는 조인으로 채움.

### 2.2 에이전트 루프 (LangGraph StateGraph; §2.13)

State = `{question, scope, history, tool_results, steps, answer, sources, step_count}`. 노드:
- **reason**: 프롬프트(도구 스펙+규칙+스코프+최근 N메시지+누적 결과) → `generate_json` →
  `{action,args}` | `{answer,sources}`.
- **act**: toolset 디스패치(인자 Pydantic 검증) → 결과 누적 + step 기록.
- 조건부 엣지: reason —action→ act —(step<MAX)→ reason ; reason —answer→ finalize.
- **finalize**: `sources[].kind`로 ChatSource 매핑(`chunk`→chunk_id, `cell`→cell_id;
  quote→청크 매핑은 추출 폴백 재사용) → user/assistant 메시지(content/steps)+sources 영속,
  제목 자동생성, `updated_at`.

스트리밍: LangGraph `astream`/`astream_events` → act마다 `step`, finalize에서 `answer`/`done` SSE.

### 2.3 main.py 배선
`ChatAgent`(embedder/text_generation/AgentToolset 어댑터) + `ChatRepository` 주입. SSE는
FastAPI `StreamingResponse`(text/event-stream). 백그라운드 태스크 불필요(요청-수명 스트림).

---

## 3. API (domain-design.md §6.5)

세션 CRUD 5개(GET/POST 목록·생성, GET/PATCH/DELETE) + **`POST /chat/sessions/{sid}/messages`**
→ 에이전트 실행, **SSE**: `event: step`(도구 호출마다) → `event: answer`(답변+출처) →
`event: done`. DTO는 camelCase로 프론트 Zod 미러.

---

## 4. 프론트엔드 (mock → real)

1. **API 3-file**: `chat.sessions.api.ts`(+SSE 소비) / `.hooks.ts` + Zod(`model/types.ts` 갱신).
   - 매핑: 백엔드 `assistant/content/createdAt` ↔ 프론트 `model/text/timestamp`.
   - `chatSourceSchema`에 `kind/chunkId/cellId/rank` 추가(표시 필드 유지). `steps` 타입 추가.
2. **SSE 소비**: `fetch`+ReadableStream(또는 EventSource 불가 — POST라 fetch 스트림) 으로
   step/answer/done 처리 → 진행 표시("DB 탐색 중…") + 최종 답변/출처 렌더.
3. `ENV.mocks.chat`로 real 분기. `ChatMainPage`/`ChatInterface`/`ChatSessionList` 서버 세션 연결.
4. 출처 칩(①②③): 셀 출처는 그리드 셀로, 청크 출처는 문서 뷰어로 점프(기존 패널 재사용, Esc 닫기).

---

## 5. 구현 순서 (PR 분할)

- **PR-A 백엔드 컨텍스트 + 세션 CRUD**(에이전트 제외): 엔티티/ORM/repo/마이그레이션/CRUD 라우터.
  → LLM 없이 API 검증 가능.
- **PR-B 에이전트 + SSE**: `AgentToolset` 어댑터(6 도구) + `ChatAgent` JSON 루프 + SSE 메시지 엔드포인트.
  → 도구 단위 테스트 + 온프렘 E2E(§6).
- **PR-C 프론트 통합**: API 3-file + SSE 소비 + 페이지 연결.
- (후속) 리랭커 / native function-calling / `query_cells` 집계 고도화.

---

## 6. 검증 전략

- **LLM 없이**: 세션 CRUD(API), 각 도구 어댑터(목록/컬럼/셀/청크 검색 SQL·스코프), JSON 루프
  파서(action/answer 분기, MAX_STEPS), 출처 매핑 단위 테스트, SSE 프레이밍.
- **LLM·임베딩 필요(이 맥은 Gemini 429)**: 에이전트 멀티스텝 E2E는 **온프렘**(TEI+vLLM)에서.
  대표 질의 2종 스모크: ① 비정형("…에 대해 설명") ② 정형("…가 가장 ~한 문서?").

---

## 7. 리스크 / 미해결

- **정형 집계 정확도**: `query_cells` 결과를 LLM이 추론 → 큰 그리드에서 한계. 서버측 필터/집계는 후속.
- **루프 안정성**: 잘못된 JSON/무한 반복 → 엄격 파싱 + MAX_STEPS + best-effort 종료.
- **도구 결과 토큰 폭증**: 목록/셀 결과를 상한·요약. 스코프로 범위 축소.
- **온프렘 JSON 준수**: GLM이 순수 JSON을 안 줄 수 있음 → `VLLM_JSON_OBJECT_MODE` + 코드펜스 파싱(기존 재사용).
- **SSE+POST**: EventSource는 GET만 → 프론트는 fetch 스트림으로 파싱.

---

## 8. domain-design.md 정합
본 계획은 §2.13 / §2.9–2.11 / §5 / §6.5 / §9(13–16)와 일치하도록 작성됨. 구현 중 시그니처가
바뀌면(예: 도구 인자, 이벤트 스키마) 두 문서를 같은 PR에서 갱신한다.
