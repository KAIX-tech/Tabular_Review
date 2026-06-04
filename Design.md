# Tabular Review — Design System (v1)

> 톤앤무드 + 디자인 토큰 + 컴포넌트 규격. UI를 만들거나 수정할 때 이 문서를 기준으로 한다.
> 구현: 토큰은 `frontend/tailwind.config.ts` + `frontend/src/app/globals.css`(`@layer components`)에 정의되어 있으며,
> 컴포넌트는 여기 정의된 클래스(`tr-*`)와 토큰을 우선 사용한다.

## 1. 디자인 원칙 (Tone & Mood)

**"Editorial precision"** — 법무·감사 같은 전문 사용자를 위한, 조용하고 정밀한 도구.
화려한 색보다 **여백 · 위계 · 디테일**로 세련됨을 만든다. (레퍼런스 감각: Linear / Notion / Vercel)

- **절제(Restraint)**: 한 화면에 강조색은 최소. 액션 위계를 색이 아니라 형태/굵기로.
- **구조(Structure)**: hairline 보더 + 부드러운 그림자로 면을 분리. 박스가 아니라 "층(layer)".
- **정밀(Precision)**: 일관된 radius·spacing·타이포 스케일. 숫자는 tabular-nums.
- **차분한 모션**: 150–180ms ease-out, 색/그림자 전환 위주. 통통 튀는 `scale` 바운스 금지.
- **항목은 면(surface)으로**: 리스트/카드 항목은 **전체를 클릭 타깃**으로 한다(항목마다 무거운 솔리드 버튼 남발 금지). 보조 액션(설정/삭제 등)은 hover 시 `⋯`(MoreHorizontal)로 드러낸다.
- **제네릭 아이콘 회피**: 도메인 객체는 단색 파일 아이콘 대신 **브랜드 스퀘어클(이니셜)**로 식별. lucide stroke는 1.75로 가늘게.

## 2. 컬러 토큰

| 역할 | 값 | 용도 |
|---|---|---|
| `--canvas` | `#F7F8FA` | 앱 배경(페이지 캔버스) |
| `--surface` | `#FFFFFF` | 카드·패널·사이드바 |
| `--surface-muted` | `#F1F3F7` | hover 배경, 미묘한 채움 |
| `--border` | `#E6E8EE` | hairline 보더 (기본) |
| `--border-strong` | `#D6DAE3` | 강조 보더, 구분선 |
| `--ink` | `#0B1220` | 본문/제목 텍스트 |
| `--ink-2` | `#5B6472` | 보조 텍스트 |
| `--ink-3` | `#8A93A2` | 캡션/플레이스홀더 |
| `--primary` | `#2563EB` | **조용한 블루 액센트**: 링크·포커스 링·선택 강조 (남용 금지) |
| `--primary-hover` | `#1D4ED8` | accent hover |
| `--primary-soft` | `#EEF4FF` | accent soft 배경 (선택 인용 등) |

> **솔리드 핵심 액션 버튼(Run / 전송 / 열기 / 생성)은 `--ink`(니어-블랙)** 을 사용한다 (Legora 톤). 블루는 강조용 액센트로만.

**시맨틱** (희소하게): success `#059669` (emerald-600), warning `#D97706` (amber-600), danger `#E11D48` (rose-600). 상태는 **소프트 파스텔 pill 배지**로 표기.

**브랜드 식별 (Identity)**: 각 Document DB는 `id` 해시 기반 **그라데이션 스퀘어클 + 이름 이니셜**(`DbSquircle`)로 식별한다. 사이드바·카드에서 같은 색을 써 일관된 정체성을 만든다.

**추출 신뢰도(Confidence)**: High = `#059669`, Medium = `#D97706`, Low = `#E11D48`. 점(dot)으로 표기.

> Tailwind에서는 위 토큰을 CSS 변수로 두고 `bg-canvas`, `text-ink`, `border-border`, `bg-primary` 등으로 사용한다.
> 기존 `slate-*`/`indigo-*` 유틸도 호환되나, 신규/수정 코드는 토큰을 우선한다.

## 3. 타이포그래피

폰트: **Inter** (본문/UI), Merriweather(serif, 인용/문서 본문용). `antialiased` + Inter `cv02,cv03,cv04,cv11` 피처.

| 스타일 | 클래스 | 용도 |
|---|---|---|
| Title | `text-base font-semibold tracking-tight` | 페이지/패널 제목 |
| Section | `text-[11px] font-semibold uppercase tracking-wider text-ink-3` | 사이드바 그룹 라벨 |
| Body | `text-sm` | 기본 |
| Caption | `text-xs text-ink-2` | 부제·메타 |
| Numeric | `tabular-nums` | 카운트·페이지 |

## 4. 형태 토큰

- **Radius**: 버튼/인풋 `rounded-lg`(10px), 카드/패널 `rounded-xl`(14px), pill `rounded-full`, 작은 배지 `rounded-md`.
- **Elevation** (커스텀 그림자, 낮고 부드럽게):
  - `shadow-soft` — 카드 기본
  - `shadow-card` — hover 시 살짝 부양
  - `shadow-popover` — 드롭다운/모달
- **Spacing**: 4px 그리드. 카드 패딩 `p-5`, 페이지 패딩 `p-6`, nav 항목 높이 `h-9`.
- **Border**: 1px `border-border`. 구분선 `border-border`.
- **Focus**: `focus-visible:ring-2 ring-primary/40 outline-none`.

## 5. 컴포넌트 규격 (globals.css `@layer components`)

| 클래스 | 설명 |
|---|---|
| `.tr-card` | 흰 카드: `rounded-xl border border-border bg-surface shadow-soft` |
| `.tr-btn` | 버튼 베이스(인라인 플렉스, radius, 포커스 링, transition) |
| `.tr-btn-primary` | 주 액션(솔리드): **니어-블랙** `bg-ink text-white` |
| `.tr-badge(-neutral/rose/amber/emerald)` | 소프트 파스텔 상태 pill |
| `.tr-cite` | 번호형 인용 칩(① ②) — 챗 답변 출처 |
| `.tr-btn-secondary` | 보조: 흰 배경 + border, hover 채움 |
| `.tr-btn-ghost` | 텍스트 버튼: hover 시 `surface-muted` |
| `.tr-icon-btn` | 정사각 아이콘 버튼(36px) |
| `.tr-nav-item` | 사이드바 항목(h-9), `.is-active`로 활성 |
| `.tr-label` | 섹션 라벨 |
| `.tr-input` | pill 입력창 |

**버튼 위계**: 한 화면에 `primary`는 1개(주 액션). 나머지는 `secondary`/`ghost`/`icon`. 위험 동작만 danger 톤.

**상태**:
- Hover: 배경/보더 톤 전환(색 점프 금지).
- Disabled: `opacity-50 pointer-events-none`.
- Loading: 인라인 스피너(`Loader2 animate-spin`), 레이아웃 시프트 없이.
- Empty/Skeleton: 같은 높이의 `surface-muted` 펄스.

## 6. 레이아웃

- **3-pane 셸**: 좌측 사이드바(`w-60`, surface, 우측 hairline) · 중앙 콘텐츠(canvas) · 우측 컨텍스트 패널(verify/source).
- **페이지 헤더**: `h-16` surface, 하단 hairline. 좌측 제목+부제, 우측 액션(primary 1 + icon들).
- **콘텐츠**: canvas 위 `p-6`, 주요 객체(테이블/리스트)는 `.tr-card`로 담아 "페이지 안의 면"으로.
- **사이드바**: 탭(Chat / Document DB) 동일 위계, 활성 시 하위 리스트 펼침. 활성 항목은 `primary-soft` 배경.

## 7. 모션

- 전환: `transition-[colors,box-shadow,opacity] duration-150 ease-out`.
- 사이드/패널 폭: `300ms` ease-out.
- 진입(드롭다운/토스트): fade + 2px translate, 120–160ms.
- **금지**: `active:scale-95` 류의 바운스, 과한 그림자, 무지개 그라데이션.

## 8. 아이콘

lucide-react, 기본 `w-4 h-4`(16px), 사이드바/버튼 `w-3.5~4`. stroke 기본. 의미 단위로만 사용(장식 남용 금지).
