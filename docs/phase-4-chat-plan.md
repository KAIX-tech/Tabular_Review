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

> **위상**: 챗은 부가 기능이 아니라 **제품의 1차 표면**이다(domain-design.md §9 #18 —
> 법률사무소 문서 지식베이스에 대한 주 인터페이스). 따라서 이 phase가 현재 로드맵의
> **최우선** 작업이며, 추출 그리드(Tabular Review)는 이 챗이 조회할 정형 데이터를 만드는
> DB화 수단으로 위치한다.

**비목표(후속)**: 리랭커(BGE-Reranker), 인증/권한(유저별 세션), native function-calling
최적화, `query_cells` 고급 필터/집계 엔진.

---

## 1. 핵심 결정 (D1–D8 = domain-design.md §9 #13–17 반영 · D9–D11 = 본 계획에서 확정)

| # | 결정 |
|---|---|
| D1 | **Agentic Search** — 에이전트가 도구로 카탈로그를 탐색(§2.13). 청크 검색은 도구 중 하나. |
| D2 | **모델 native tool-calling** — LangChain `ChatOpenAI`(`langchain-openai`→vLLM/GLM(prod)·OpenRouter GLM(dev))의 네이티브 tool-calling(`create_agent`가 도구 바인딩). GLM이 tool-calling 구성됨(§9 #14). 챗만 이 경로, 추출은 `generate_json` 유지. |
| D3 | **출처 = 청크 + 셀** — ChatSource `chunk_id`(비정형) 또는 `cell_id`(정형). |
| D4 | **SSE 라이브 스트림** — `step`→`answer`→`done`. 스텝은 `ChatMessage.steps`(jsonb)에 저장. |
| D5 | **서버 영속 세션/메시지/출처/스텝** (localStorage→서버). |
| D6 | **인증 없음** — `created_by` nullable, 유저 필터링 생략(별도 트랙). |
| D7 | **스코프** — 전역(에이전트가 DB 선택) 또는 `scope_document_db_id`로 도구 접근 제한. |
| D8 | **오케스트레이션 = LangChain v1 `langchain.agents.create_agent`**(LangGraph 런타임 위 ReAct) + native tool-calling. 구버전 `langgraph.prebuilt`(`create_react_agent`/`ToolNode`/`tools_condition`)는 1.0에서 deprecated → `langchain.agents`로 이동. app/infra 레이어 한정, 도메인 순수(§9 #17). 트레이싱 = Langfuse LangChain 콜백. |
| D9 | **실패/취소 처리** — SSE 계약에 `error` 이벤트 포함. user 메시지는 실행 **전** 저장(실패해도 질문 보존), assistant는 성공 시 finalize에서만 저장(실패 시 미저장 → UI 재시도). 클라 disconnect 시 실행 취소. 세션당 동시 실행 1개(409). |
| D10 | **출처 인용 규칙** — 시스템 프롬프트로 모델이 사용한 출처 id를 **명시 인용**(`[chunk:<id>]`/`[cell:<id>]` 마커), 미명시 시 휴리스틱 폴백(마지막 도구 결과 순). 메시지당 출처 상한 `MAX_SOURCES`(기본 5). 환각 id 차단(ToolMessage에 실재하는 id만 인정). |
| D11 | **도구 결과 상한** — 모든 도구 결과에 공통 토큰 상한(`TOOL_RESULT_MAX_TOKENS`, 절단 시 truncated 표시). `get_document`는 슬라이스(offset/length) **필수** — 전문 반환 금지. |

---

## 2. 백엔드 설계 (DDD 신규 컨텍스트 `chat` = 오케스트레이터)

```
app/domains/chat/
├── domain/      models(ChatSession/Message/Source/Step, ChatRole)
│                ports(ChatRepository, AgentToolset[read 포트 집합], errors)  # 프레임워크 import 금지
├── application/ agent.py(create_agent 구성 + run/스트림 + 출처 finalize) + service.py(세션 CRUD + run)
├── infrastructure/ models(ORM) + repositories + AgentToolset 어댑터(타 컨텍스트 read 포트)
└── interface/   schemas(DTO) + router(SSE) + dependencies
```

> LangChain/LangGraph는 application/infra 레이어에서만 import. 의존(2026.6):
> `langchain>=1.3,<2`(umbrella; `langchain.agents.create_agent` 포함),
> `langchain-openai>=1.1,<2`(ChatOpenAI→vLLM/OpenRouter), `langgraph`/`langchain-core`는 transitive,
> `langfuse>=4`. 챗 LLM은 **LangChain ChatOpenAI + native tool-calling**; 추출은 기존
> `generate_json` 유지. 트레이싱 = Langfuse LangChain 콜백.

### 2.1 에이전트 도구 (read-only 포트; §2.13 도구 카탈로그)

각 도구는 **기존 컨텍스트의 read 포트**로 구현(직접 import 금지, main.py 조립):
- `list_document_dbs` / `list_columns` → `document_db` read 포트
- `list_documents` / `get_document` / `search_chunks` → `ingestion` read 포트(§2.12 검색 재사용)
- `query_cells` → `extraction` read 포트(셀 그리드 + cellId)

→ `chat` 도메인에 **`AgentToolset` 포트**(위 6개 메서드)를 정의하고, infra 어댑터가 각
컨텍스트 read 포트(또는 서비스)를 호출해 구현. 표시 메타(documentName/db)는 조인으로 채움.

**도구 결과 상한(D11)**: 모든 도구 반환에 공통 토큰 상한(`TOOL_RESULT_MAX_TOKENS`, 설정값)
적용 — 초과 시 절단하고 결과에 `truncated: true`를 표시해 모델이 범위를 좁혀 재호출하게
유도한다. `get_document`는 **슬라이스 파라미터(offset/length) 필수**로 전문 반환을 막는다
(온프렘 GLM 65k 컨텍스트에서 전문 1회 호출로 예산이 소진되는 것 방지). `query_cells`도
행/컬럼 수 상한을 적용한다.

### 2.2 에이전트 루프 (`langchain.agents.create_agent`; §2.13)

LangChain chat model(provider 분기) + 6개 도구 + system_prompt(규칙+스코프)로 **`create_agent`**
한 번 생성 → LangGraph 런타임 위 ReAct 루프가 도구 바인딩·반복·스트리밍을 제공:
- 모델이 **tool_calls** 내면 toolset이 실행(인자 검증) → `ToolMessage`로 주입 + step 기록, 없으면 종료.
- **상한**: LangGraph는 model 노드·tool 노드를 각각 1 스텝으로 세므로
  **`recursion_limit ≈ 2×MAX_STEPS + 1`** 로 환산해 설정. 초과 시 그때까지의 근거로
  best-effort 답변(UI에 표기 — §4.1).
- **영속 순서(D9)**: user 메시지는 에이전트 실행 **전에** 즉시 저장(실패해도 질문 보존).
  성공 시에만 finalize가 assistant를 저장하고, 실패 시 assistant는 저장하지 않고 SSE
  `error`로 알림 → UI에서 재시도.
- **finalize**(성공 시) — **출처 결정(D10)**: ① 시스템 프롬프트로 모델이 답변에 사용한 출처
  id를 **명시 인용**하게 한다(`[chunk:<id>]`/`[cell:<id>]` 마커 — 본문에서 제거 후
  ChatSource로 변환, 등장 순 = rank). ② 마커가 없으면 휴리스틱 폴백(최종 답변에 가까운
  도구 결과 순). 메시지당 출처 상한 `MAX_SOURCES`(기본 5). 어느 경로든 **최종 state의
  ToolMessage에 실재하는 id만 인정**(환각 id 차단, fuzzy 불필요) → assistant 메시지
  (content/steps)+sources 영속, `updated_at` 갱신.
- **제목 자동 생성**: 첫 user 메시지 truncate(약 40자)로 즉시 생성 — LLM 요약 제목은 후속.
- 시스템 프롬프트/스코프 주입·커스텀 종료가 더 필요하면 **v1 middleware**, 그래도 부족하면 커스텀 `StateGraph`.

스트리밍: `agent.astream_events(...)` → tool 호출마다 `step`, 최종 `answer`/`done` SSE.
모델: `langchain-openai`의 `ChatOpenAI`(vLLM/GLM(prod)·OpenRouter GLM(dev)). Langfuse LangChain 콜백.

### 2.3 main.py 배선
`ChatAgent`(LangChain chat model[provider 분기] + AgentToolset 어댑터 + Langfuse 콜백) +
`ChatRepository` 주입. chat model은 **`LLM_PROVIDER`**(onprem/openrouter)에 따라 `ChatOpenAI`로
구성(base_url/api_key/model = 백엔드 `_openai_llm_target`와 동일 소스). SSE는 FastAPI
`StreamingResponse`(text/event-stream). 백그라운드 태스크 불필요(요청-수명 스트림).

**취소/동시성(D9)**: 스트림 중 클라이언트 disconnect를 감지하면(`request.is_disconnected`)
에이전트 실행을 취소(asyncio cancel)하고 assistant는 저장하지 않는다(실행 전 저장된 user
메시지만 잔존). 같은 세션의 동시 실행은 1개로 제한 — 실행 중 추가 POST는 `409 Conflict`,
프론트는 스트림 진행 중 입력을 비활성화한다.

---

## 3. API (domain-design.md §6.5)

세션 CRUD 5개(GET/POST 목록·생성, GET/PATCH/DELETE) + **`POST /chat/sessions/{sid}/messages`**
→ 에이전트 실행, **SSE**: `event: step`(도구 호출마다) → `event: answer`(답변+출처) →
`event: done`. **실패 시 `event: error`**(`data: {message}` — 그 시점까지의 step은 이미
전송된 상태)로 스트림 종료(D9). 동일 세션 실행 중 추가 전송은 `409 Conflict`.
DTO는 camelCase로 프론트 Zod 미러.

---

## 4. 프론트엔드 (mock → real)

1. **API 3-file**: `chat.sessions.api.ts`(+SSE 소비) / `.hooks.ts` + Zod(`model/types.ts` 갱신).
   - 매핑: 백엔드 `assistant/content/createdAt` ↔ 프론트 `model/text/timestamp`.
   - `chatSourceSchema`에 `kind/chunkId/cellId/rank` 추가(표시 필드 유지). `steps` 타입 추가.
2. **SSE 소비**: `fetch`+ReadableStream(EventSource는 GET만 → POST라 fetch 스트림) 으로
   step/answer/done/**error** 처리 → 진행 표시("DB 탐색 중…") + 최종 답변/출처 렌더.
   `error` 수신 또는 done 없이 스트림이 끊기면 에러 말풍선 + **재시도**(user 메시지는 서버에
   보존됨 — D9). 스트림 진행 중 입력 비활성화(409 방지).
   - 호환성: `response.body?.getReader`를 feature-detect. 타깃은 모던 브라우저(Next.js)라 기본
     지원되지만, 미지원 시 **비스트리밍 폴백**(스트림 없이 최종 `answer`만 받는 일반 POST 응답으로
     degrade — 진행 표시는 생략)으로 처리. (서버는 동일 핸들러에서 `Accept`에 따라 분기 가능.)
3. `ENV.mocks.chat`로 real 분기. `ChatMainPage`/`ChatInterface`/`ChatSessionList` 서버 세션 연결.
4. 출처 칩(①②③): 셀 출처는 그리드 셀로, 청크 출처는 문서 뷰어로 점프(기존 패널 재사용, Esc 닫기).

### 4.1 화면 기준 (UI 스펙 — 폐기된 screen-plan.md U-0에서 이관)

챗 화면의 수용 기준. 골격(좌측 도메인 레일·세션 목록 + 중앙 챗 + 우측 출처 패널)은
`ChatMainPage`에 구현되어 있고, 아래가 PR-C에서 추가/연결될 동작이다.

```
┌──────────┬──────────────────────────────────────────────┬───────────┐
│ 도메인     │  계약서에 대해 질문하기              [그리드 보기]   │           │
│ ▸계약서 ●  │   🙋 MFN 조항이 가장 유리한 계약은?               │  출처 패널  │
│  약관     │                                              │           │
│ ────────  │   ⏳ ① DB 탐색 중… ② 컬럼 확인 중… ③ 셀 조회 중…  │ ┌───────┐ │
│ 대화기록   │      ← 에이전트 스텝 라이브(SSE), 완료 후 접힘      │ │ACME p12│ │
│ ·오늘      │   🤖 ACME_MSA 계약이 가장 유리합니다. 18.2조에서… │ │인용문…  │ │
│  └ MFN..  │      [출처 1: ACME_MSA p.12]  ← 청크(원문) 출처  │ └───────┘ │
│ ·어제      │      [출처 2: MFN조항 = "있음"] ← 셀(정형) 출처   │           │
└──────────┴──────────────────────────────────────────────┴───────────┘
```

- **에이전트 스텝 표시**: SSE `step` 이벤트를 진행 타임라인으로 라이브 표시(도구별 라벨 —
  "DB 탐색 중…", "컬럼 확인 중…", "셀 조회 중…"). 답변 완료 후 접힌 "탐색 과정"으로 보존,
  세션 재오픈 시 `ChatMessage.steps`로 동일하게 재현.
- **출처 칩**(①②③, `.tr-cite`): **청크 출처** = 문서명+페이지 → 문서 뷰어(`DocumentViewer`)
  점프, 인용구 하이라이트+자동 스크롤. **셀 출처** = 컬럼명=값 → 해당 DB 읽기전용 그리드의
  셀로 점프, 포커스/하이라이트.
- **스코프**: 좌측 도메인 선택 = 세션 `scopeDocumentDbId`, 미선택 = 전역(에이전트가 DB 선택).
- **세션**: 좌측 하단 목록(서버 영속), 제목 자동 생성, 이름변경/삭제.
- **상태**: 빈 상태 = 추천 질문 칩. SSE `error` = 에러 말풍선 + 재시도 버튼(질문 보존).
  스텝 상한 도달 = best-effort 답변임을 표기. 실행 중 입력 비활성화.
  스트리밍 미지원 환경은 비스트리밍 폴백(§4 2).
- 챗 외 잔여 UI 백로그(읽기전용 그리드 의미검색, 폴백 셀 "부분 컨텍스트" 배지)는
  domain-design.md §10 후속 항목으로 이관.

---

## 5. 구현 순서 (PR 분할)

- **PR-A 백엔드 컨텍스트 + 세션 CRUD**(에이전트 제외): 엔티티/ORM/repo/마이그레이션/CRUD 라우터.
  → LLM 없이 API 검증 가능.
- **PR-B 에이전트 + SSE**: `AgentToolset` 어댑터(6 도구) + `langchain.agents.create_agent` 구성
  + SSE 메시지 엔드포인트(`astream_events`). → 도구 단위 테스트 + 온프렘 E2E(§6).
- **PR-C 프론트 통합**: API 3-file + SSE 소비 + 페이지 연결.
- (후속) 리랭커 / `query_cells` 서버측 집계 고도화.

---

## 6. 검증 전략

- **LLM 없이**: 세션 CRUD(API), 각 도구 어댑터(목록/컬럼/셀/청크 검색 SQL·스코프), 출처 id 매핑
  (마커 파싱·환각 id 차단·상한), SSE 프레이밍 + `error` 이벤트, 409 동시성 가드, disconnect
  취소(user 메시지만 잔존), 도구 결과 절단(truncated 표시) 단위 테스트.
- **LLM·임베딩 필요**: 에이전트 멀티스텝 E2E는 dev(OpenRouter GLM + TEI) 또는 온프렘(vLLM GLM +
  TEI)에서. 대표 질의 2종 스모크: ① 비정형("…에 대해 설명") ② 정형("…가 가장 ~한 문서?").
  → 온프렘은 vLLM이 tool-calling으로 떠 있는지(`--enable-auto-tool-choice` 등), dev는 해당 GLM이
  OpenRouter에서 tool-calling 지원하는지 먼저 확인.
- **두 LLM 경로 정합성**(PR-B): 챗(`ChatOpenAI` native tool-calling)과 추출(`generate_json`)이
  같은 타깃(`_openai_llm_target`)을 쓰는지 확인하는 통합 테스트 1종 — 같은 vLLM/OpenRouter 설정에서
  ① 추출이 유효 JSON 객체를 돌려주고 ② 챗 모델이 tool_calls를 생성하는지(스키마/포맷 드리프트 조기 감지).

---

## 7. 리스크 / 미해결

- **정형 집계 정확도**: `query_cells` 결과를 LLM이 추론 → 큰 그리드에서 한계. 서버측 필터/집계는 후속.
- **루프 안정성**: 무한 반복 → MAX_STEPS/recursion_limit + best-effort 종료.
- **vLLM tool-calling 설정 의존**: GLM이 tool-call 파서로 떠 있어야 함(서버 설정). 모델별 tool-call 품질 편차 가능 → 스모크 검증.
- **도구 결과 토큰 폭증**: → 설계로 반영(D11, §2.1 — 공통 상한 + get_document 슬라이스 필수).
- **출처 마커 미준수**: 모델이 `[chunk:<id>]` 인용 형식을 안 지킬 수 있음 → 휴리스틱 폴백(D10)
  + 스모크에서 마커 준수율 확인, 필요 시 프롬프트 보강.
- **두 LLM 경로 공존**: 챗=LangChain chat model, 추출=`generate_json`. 설정(vLLM URL/모델) 공유로 일관성 유지.
- **SSE+POST**: EventSource는 GET만 → 프론트는 fetch 스트림으로 파싱.

---

## 8. domain-design.md 정합
본 계획은 §2.13 / §2.9–2.11 / §5 / §6.5 / §9(13–17)와 일치하도록 작성됨. 구현 중 시그니처가
바뀌면(예: 도구 인자, 이벤트 스키마) 두 문서를 같은 PR에서 갱신한다.
