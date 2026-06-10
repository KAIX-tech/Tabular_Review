# Phase 4 — 챗(RAG) 구현 계획

> 본 문서는 **구현 계획(plan)** 이다. 도메인/테이블/API의 **진실원천은
> [domain-design.md](domain-design.md)** 이며(특히 §2.9–2.11, §5, §6.5, §2.12 검색
> 파이프라인), 본 문서는 그 스펙을 "어떻게/어떤 순서로/어떤 결정으로" 구현할지를
> 정한다. 구현 중 스펙과 어긋나면 domain-design.md를 같은 변경에서 갱신한다.

상태: **draft (검토 대기)** · 대상: `chat` 바운디드 컨텍스트 신규 구현 + 프론트 mock→real

---

## 0. 목표 / 비목표

**목표**: 적재·추출된 문서 데이터셋 위에서 **자연어 질문 → 청크 검색(RAG) → LLM 답변 +
출처(ChatSource)** 를 제공한다. 대화는 서버에 영속되고, 답변은 청크를 인용한다.

**비목표(이번 단계 제외, 후속)**:
- 스트리밍(SSE) — 1차는 비스트리밍
- 리랭커(BGE-Reranker-V2-M3) — 1차는 벡터 top-k 직행
- 인증/권한(admin·user), 유저별 세션 격리
- 표(추출 그리드) 값 기반 정형 질의(예: "MFN 조항이 가장 유리한 계약은?") — 1차는
  **청크 RAG**만. 셀 값 집계 질의는 후속 확장.

---

## 1. 핵심 결정 (검토 포인트)

| # | 결정 | 근거 / 대안 |
|---|---|---|
| D1 | **비스트리밍 우선** (POST가 답변+출처를 한 번에 반환) | 설계의 SSE(§6.5)는 후속. 폴링→SSE는 원래 deferred 항목. 단순·안정 우선. |
| D2 | **서버 영속 세션/메시지/출처** | 설계 §2.9–2.11. 프론트 localStorage 세션을 서버로 승격. |
| D3 | **인증 없음** → `created_by` nullable, 유저 필터링 생략 | Identity는 별도 트랙. 챗을 막지 않기 위해 분리. |
| D4 | **리랭커 없음** → 벡터 top-k 직행 | §2.12에서 dev는 리랭크 생략. 온프렘 리랭커는 후속. |
| D5 | **`TextGenerationPort.generate_json` 재사용** | 프롬프트가 `{answer, sources:[{quote}]}` 반환 → quote→청크 매핑(추출과 동일 패턴). Gemini/온프렘 vLLM 양쪽 동작. 신규 LLM 포트 불필요. |
| D6 | **스코프**: 전역(모든 DB) 또는 특정 DB(`scope_document_db_id`) | §2.9. 프론트 기본은 전역. |
| D7 | **멀티턴**: 최근 N개 메시지를 프롬프트에 포함(간단) | 1차는 대화 메모리를 프롬프트 연결로. 요약/윈도잉은 후속. |
| D8 | **출처 표시 메타(documentName/documentDb)는 조인으로 채움** | §2.11. chat_source엔 chunk_id/quote/page/rank만 저장. |

> 검토 시 바꿀 만한 것: D1(SSE를 1차에 넣을지), D7(멀티턴 범위), 그리고 "표 값 정형
> 질의"를 1차 범위에 포함할지.

---

## 2. 도메인 모델 (domain-design.md §2.9–2.11 재확인)

- **ChatSession**: `id, title, scope_document_db_id?(→DocumentDB), created_by?(→User),
  created_at, updated_at`. title은 첫 메시지로 자동 생성.
- **ChatMessage**: `id, session_id(FK cascade), role('user'|'assistant'), content,
  created_at`. (프론트의 `model` → 표준 `assistant`로 어댑터 매핑)
- **ChatSource**: `id, message_id(FK cascade), chunk_id?(→DocumentChunk), quote, page?,
  rank, created_at`. rank=출처 표시 순번(①②③).

DDL은 §5에 이미 정의됨(`chat_session`/`chat_message`/`chat_source`) → **마이그레이션만
새로 추가**.

---

## 3. 백엔드 설계 (DDD 신규 컨텍스트 `chat`)

```
app/domains/chat/
├── domain/
│   ├── models.py     # ChatSession, ChatMessage, ChatSource, ChatRole, RetrievedChunk
│   └── ports.py      # ChatRepository, ChatRetrievalPort, NewChatSource, errors
├── application/
│   └── service.py    # ChatService: 세션 CRUD + RAG answer
├── infrastructure/
│   ├── models.py     # ChatSessionOrm / ChatMessageOrm / ChatSourceOrm
│   └── repositories.py
└── interface/
    ├── schemas.py    # CamelModel DTO
    ├── router.py
    └── dependencies.py
```

### 3.1 RAG 흐름 (`ChatService.send(session_id, question)`)

1. 세션 로드(스코프 확인) — 없으면 `ChatSessionNotFoundError`.
2. **질문 임베딩** — `EmbeddingPort.embed_query(question)`.
3. **청크 검색** — `ChatRetrievalPort.search(emb, top_k, document_db_id=scope)`.
   - 전역=모든 청크 / 스코프=해당 DB 청크. pgvector `cosine_distance` top-k.
   - 리랭커 생략(D4).
4. **컨텍스트 구성** — 검색된 청크들 + (D7) 최근 대화 일부를 프롬프트에 결합.
5. **LLM 호출** — `generate_json(system, user)` → `{answer, sources:[{quote}]}`.
6. **출처 매핑** — 각 quote를 검색된 청크에 매핑(추출 `_match_chunk`/`_locate_quote`
   재사용 검토) → `NewChatSource(chunk_id, quote, page, rank)`.
7. **영속** — user 메시지 + assistant 메시지(+sources) 저장, `updated_at` 갱신,
   title이 기본값이면 첫 user 메시지로 생성.
8. **반환** — assistant 메시지 + 출처(표시 메타 조인 포함).

### 3.2 청크 검색 확장 (ingestion 의존)

현재 `DocumentChunkRepository.search_in_document(document_id, ...)`만 존재.
챗은 **전역/DB-스코프** 검색이 필요 → 신규 포트 `ChatRetrievalPort` 도입:
- `search(embedding, limit, document_db_id=None) -> list[RetrievedChunk]`
- 구현: `document_chunk ⋈ document ⋈ document_db` 조인(표시 메타까지 한 번에),
  `document_db_id` 있으면 필터, `embedding.cosine_distance` 정렬, limit.
- `RetrievedChunk = {chunk_id, text, page, document_id, document_name,
  document_db_id, document_db_name}` → 컨텍스트 + ChatSource 표시 양쪽 충족.

> 대안: ingestion의 `DocumentChunkRepository`에 `search(...)`를 추가하고 이름은
> 서비스에서 조인. → 표시 메타 조인이 chat 전용이라 **chat 인프라에 두는 쪽**을 택함
> (레이어 위반 아님: infrastructure가 타 테이블 read).

### 3.3 main.py 배선

`ChatService`를 세션 스코프(요청 세션당 repo) 또는 백그라운드 없이 동기 처리.
추출과 달리 **즉시 응답**(백그라운드 태스크 불필요, 비스트리밍). composition root에서
embedder/text_generation(기존) + ChatRepository/ChatRetrievalPort(신규) 주입.

---

## 4. API (domain-design.md §6.5)

| Method | Path | 설명 | 1차 구현 |
|---|---|---|---|
| GET | `/chat/sessions` | 세션 목록 | ✅ |
| POST | `/chat/sessions` | 세션 생성(`{scopeDocumentDbId?}`) | ✅ |
| GET | `/chat/sessions/{sid}` | 세션 + 메시지(+출처) | ✅ |
| PATCH | `/chat/sessions/{sid}` | 제목 변경 | ✅ |
| DELETE | `/chat/sessions/{sid}` | 삭제 | ✅ |
| POST | `/chat/sessions/{sid}/messages` | 질문 전송 → 답변+출처 | ✅ (비스트리밍; §6.5의 SSE는 후속) |

응답 DTO(camelCase)는 프론트 Zod와 미러링. 출처는 `{chunkId, quote, page, rank,
documentName, documentDbId, documentDbName}` (표시 메타 포함).

---

## 5. 프론트엔드 통합 (mock → real)

현재: `domains/chat/`에 mock(`chat.fixtures`, localStorage `chat-sessions.store`),
타입은 `{role:'user'|'model', text, timestamp, sources:{documentDb,documentName,page,quote}}`.

작업:
1. **API 3-file 패턴**: `chat.sessions.api.ts` / `.hooks.ts` + Zod(`model/types.ts` 갱신).
   - 백엔드 계약(camelCase, `assistant`/`content`/`createdAt`)과 프론트 표시 타입
     (`model`/`text`/`timestamp`) 간 **어댑터 매핑**.
   - `chatSourceSchema`에 `chunkId/rank/documentDbId` 추가, 표시 필드 유지.
2. **mock 플래그**: `ENV.mocks.chat`로 real 분기 (현재 `.env`는 chat=mock 유지 중).
   real 켜면 서버 세션 사용.
3. `ChatMainPage`/`ChatInterface`/`ChatSessionList`를 서버 세션 훅으로 연결
   (localStorage store는 mock 경로로 잔존 또는 단계적 제거).
4. 출처 칩(①②③) 클릭 → 기존 출처 패널 재사용(Esc 닫기 이미 지원).

---

## 6. 구현 순서 (PR 분할)

- **PR-A (백엔드 챗 컨텍스트)**: domain/application/infrastructure/interface + 마이그레이션
  + `ChatRetrievalPort` + main 배선. 세션 CRUD는 API로 검증, RAG 답변은 단위(매핑/스코프)
  + 온프렘 E2E(아래 §7).
- **PR-B (프론트 통합)**: API 3-file + 훅 + 페이지 연결, real 분기.
- (후속) PR-C: SSE 스트리밍 / PR-D: 리랭커 / PR-E: 셀 값 정형 질의.

작은 슬라이스 선호 시 PR-A를 (A1 세션 CRUD) / (A2 RAG send)로 더 쪼갤 수 있음.

---

## 7. 검증 전략

- **LLM·임베딩 없이 검증 가능**: 세션 CRUD(API), 검색 스코프 SQL(전역/DB 필터),
  quote→청크 매핑 단위 테스트, 부팅 배선.
- **LLM·임베딩 필요(현재 맥은 Gemini 크레딧 소진 → 429)**: RAG 답변 E2E는
  **내부망(온프렘 TEI 임베딩 + vLLM 생성)** 에서 확인. `AI_PROVIDER=onprem` 경로 재사용.
- 권장: PR-A 머지 전, 온프렘에서 "질문→답변+출처" 1건 스모크.

---

## 8. 리스크 / 미해결

- **표시 메타 조인 비용**: top-k 작음(≈6) → 무시 가능. 필요 시 캐시.
- **출처 매핑 실패**: quote가 청크와 정확히 안 맞을 때 → chunk_id null로 quote만 저장
  (추출과 동일 폴백).
- **멀티턴 길이**: 긴 대화 시 프롬프트 폭증 → 최근 N개로 제한(D7), 후속에 요약.
- **검색 품질**: 리랭커 부재로 top-k가 거칠 수 있음 → PR-D에서 보강.
- **정형 질의 기대**: 사용자가 표 값 집계("가장 ~한 계약")를 기대할 수 있음 → 1차는
  청크 RAG 한계 명시, 후속 확장.

---

## 9. domain-design.md 갱신 필요 항목 (구현 시)

- §6.5 메시지 엔드포인트: 1차 **비스트리밍**으로 표기(추후 SSE) — 구현 시 동기화.
- 검색 파이프라인(§2.12): 챗 검색은 현재 **리랭크 생략(벡터 top-k)** 임을 명시.
- ChatSource 응답에 표시 메타(documentName/db) 포함 방식 명시.
