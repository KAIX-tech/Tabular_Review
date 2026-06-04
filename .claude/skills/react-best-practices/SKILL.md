---
description: Enforces React and Vercel best practices for frontend code. Use when writing React components, hooks, or updating frontend code. Includes performance optimization, async patterns, and Next.js patterns.
tags: [react, performance, next.js, best-practices, optimization]
user_invocable: false
---

# React Best Practices

> Based on [Vercel React Best Practices](https://vercel.com/blog/introducing-react-best-practices) (v1.0.0)
> Source: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)

코드 작성/리뷰 시 아래 인덱스에서 관련 규칙을 찾아 `rules/` 폴더의 개별 파일을 참조합니다.
각 규칙 파일에는 Incorrect/Correct 코드 예시와 상세 설명이 포함되어 있습니다.

---

## Quick Reference — Impact별 규칙 인덱스

### CRITICAL (반드시 적용)

| Rule | File | Category |
|------|------|----------|
| Promise.all() for Independent Operations | [async-parallel.md](rules/async-parallel.md) | Waterfalls |
| Dependency-Based Parallelization | [async-dependencies.md](rules/async-dependencies.md) | Waterfalls |
| Prevent Waterfall Chains in API Routes | [async-api-routes.md](rules/async-api-routes.md) | Waterfalls |
| Avoid Barrel File Imports | [bundle-barrel-imports.md](rules/bundle-barrel-imports.md) | Bundle |
| Dynamic Imports for Heavy Components | [bundle-dynamic-imports.md](rules/bundle-dynamic-imports.md) | Bundle |
| Authenticate Server Actions Like API Routes | [server-auth-actions.md](rules/server-auth-actions.md) | Server |
| Parallel Data Fetching with Component Composition | [server-parallel-fetching.md](rules/server-parallel-fetching.md) | Server |

### HIGH

| Rule | File | Category |
|------|------|----------|
| Defer Await Until Needed | [async-defer-await.md](rules/async-defer-await.md) | Waterfalls |
| Strategic Suspense Boundaries | [async-suspense-boundaries.md](rules/async-suspense-boundaries.md) | Waterfalls |
| Conditional Module Loading | [bundle-conditional.md](rules/bundle-conditional.md) | Bundle |
| CSS content-visibility for Long Lists | [rendering-content-visibility.md](rules/rendering-content-visibility.md) | Rendering |
| Cross-Request LRU Caching | [server-cache-lru.md](rules/server-cache-lru.md) | Server |
| Minimize Serialization at RSC Boundaries | [server-serialization.md](rules/server-serialization.md) | Server |

### MEDIUM-HIGH

| Rule | File | Category |
|------|------|----------|
| Use SWR for Automatic Deduplication | [client-swr-dedup.md](rules/client-swr-dedup.md) | Client |
| Early Length Check for Array Comparisons | [js-length-check-first.md](rules/js-length-check-first.md) | JS Perf |
| Use toSorted() Instead of sort() for Immutability | [js-tosorted-immutable.md](rules/js-tosorted-immutable.md) | JS Perf |

### MEDIUM

| Rule | File | Category |
|------|------|----------|
| Defer Non-Critical Third-Party Libraries | [bundle-defer-third-party.md](rules/bundle-defer-third-party.md) | Bundle |
| Preload Based on User Intent | [bundle-preload.md](rules/bundle-preload.md) | Bundle |
| Version and Minimize localStorage Data | [client-localstorage-schema.md](rules/client-localstorage-schema.md) | Client |
| Use Passive Event Listeners | [client-passive-event-listeners.md](rules/client-passive-event-listeners.md) | Client |
| Avoid Layout Thrashing | [js-batch-dom-css.md](rules/js-batch-dom-css.md) | JS Perf |
| Cache Repeated Function Calls | [js-cache-function-results.md](rules/js-cache-function-results.md) | JS Perf |
| Use Activity Component for Show/Hide | [rendering-activity.md](rules/rendering-activity.md) | Rendering |
| Prevent Hydration Mismatch Without Flickering | [rendering-hydration-no-flicker.md](rules/rendering-hydration-no-flicker.md) | Rendering |
| Calculate Derived State During Rendering | [rerender-derived-state-no-effect.md](rules/rerender-derived-state-no-effect.md) | Re-render |
| Subscribe to Derived State | [rerender-derived-state.md](rules/rerender-derived-state.md) | Re-render |
| Defer State Reads to Usage Point | [rerender-defer-reads.md](rules/rerender-defer-reads.md) | Re-render |
| Use Functional setState Updates | [rerender-functional-setstate.md](rules/rerender-functional-setstate.md) | Re-render |
| Use Lazy State Initialization | [rerender-lazy-state-init.md](rules/rerender-lazy-state-init.md) | Re-render |
| Extract Default Non-primitive to Constant | [rerender-memo-with-default-value.md](rules/rerender-memo-with-default-value.md) | Re-render |
| Extract to Memoized Components | [rerender-memo.md](rules/rerender-memo.md) | Re-render |
| Put Interaction Logic in Event Handlers | [rerender-move-effect-to-event.md](rules/rerender-move-effect-to-event.md) | Re-render |
| Use Transitions for Non-Urgent Updates | [rerender-transitions.md](rules/rerender-transitions.md) | Re-render |
| Use useRef for Transient Values | [rerender-use-ref-transient-values.md](rules/rerender-use-ref-transient-values.md) | Re-render |
| Use after() for Non-Blocking Operations | [server-after-nonblocking.md](rules/server-after-nonblocking.md) | Server |
| Per-Request Deduplication with React.cache() | [server-cache-react.md](rules/server-cache-react.md) | Server |

### LOW-MEDIUM

| Rule | File | Category |
|------|------|----------|
| Cache Property Access in Loops | [js-cache-property-access.md](rules/js-cache-property-access.md) | JS Perf |
| Cache Storage API Calls | [js-cache-storage.md](rules/js-cache-storage.md) | JS Perf |
| Combine Multiple Array Iterations | [js-combine-iterations.md](rules/js-combine-iterations.md) | JS Perf |
| Early Return from Functions | [js-early-exit.md](rules/js-early-exit.md) | JS Perf |
| Hoist RegExp Creation | [js-hoist-regexp.md](rules/js-hoist-regexp.md) | JS Perf |
| Build Index Maps for Repeated Lookups | [js-index-maps.md](rules/js-index-maps.md) | JS Perf |
| Use Set/Map for O(1) Lookups | [js-set-map-lookups.md](rules/js-set-map-lookups.md) | JS Perf |
| Suppress Expected Hydration Mismatches | [rendering-hydration-suppress-warning.md](rules/rendering-hydration-suppress-warning.md) | Rendering |
| Do not wrap simple expression in useMemo | [rerender-simple-expression-in-memo.md](rules/rerender-simple-expression-in-memo.md) | Re-render |
| Initialize App Once, Not Per Mount | [advanced-init-once.md](rules/advanced-init-once.md) | Advanced |

### LOW

| Rule | File | Category |
|------|------|----------|
| Deduplicate Global Event Listeners | [client-event-listeners.md](rules/client-event-listeners.md) | Client |
| Use Loop for Min/Max Instead of Sort | [js-min-max-loop.md](rules/js-min-max-loop.md) | JS Perf |
| Animate SVG Wrapper Instead of SVG Element | [rendering-animate-svg-wrapper.md](rules/rendering-animate-svg-wrapper.md) | Rendering |
| Use Explicit Conditional Rendering | [rendering-conditional-render.md](rules/rendering-conditional-render.md) | Rendering |
| Hoist Static JSX Elements | [rendering-hoist-jsx.md](rules/rendering-hoist-jsx.md) | Rendering |
| Optimize SVG Precision | [rendering-svg-precision.md](rules/rendering-svg-precision.md) | Rendering |
| Use useTransition Over Manual Loading States | [rendering-usetransition-loading.md](rules/rendering-usetransition-loading.md) | Rendering |
| Narrow Effect Dependencies | [rerender-dependencies.md](rules/rerender-dependencies.md) | Re-render |
| Avoid Duplicate Serialization in RSC Props | [server-dedup-props.md](rules/server-dedup-props.md) | Server |
| Store Event Handlers in Refs | [advanced-event-handler-refs.md](rules/advanced-event-handler-refs.md) | Advanced |
| useEffectEvent for Stable Callback Refs | [advanced-use-latest.md](rules/advanced-use-latest.md) | Advanced |

---

## Category별 규칙 인덱스

### 1. Eliminating Waterfalls — CRITICAL

| Impact | Rule | File |
|--------|------|------|
| CRITICAL | Promise.all() for Independent Operations | [async-parallel.md](rules/async-parallel.md) |
| CRITICAL | Dependency-Based Parallelization | [async-dependencies.md](rules/async-dependencies.md) |
| CRITICAL | Prevent Waterfall Chains in API Routes | [async-api-routes.md](rules/async-api-routes.md) |
| HIGH | Defer Await Until Needed | [async-defer-await.md](rules/async-defer-await.md) |
| HIGH | Strategic Suspense Boundaries | [async-suspense-boundaries.md](rules/async-suspense-boundaries.md) |

### 2. Bundle Size Optimization — CRITICAL

| Impact | Rule | File |
|--------|------|------|
| CRITICAL | Avoid Barrel File Imports | [bundle-barrel-imports.md](rules/bundle-barrel-imports.md) |
| CRITICAL | Dynamic Imports for Heavy Components | [bundle-dynamic-imports.md](rules/bundle-dynamic-imports.md) |
| HIGH | Conditional Module Loading | [bundle-conditional.md](rules/bundle-conditional.md) |
| MEDIUM | Defer Non-Critical Third-Party Libraries | [bundle-defer-third-party.md](rules/bundle-defer-third-party.md) |
| MEDIUM | Preload Based on User Intent | [bundle-preload.md](rules/bundle-preload.md) |

### 3. Server-Side Performance — HIGH

| Impact | Rule | File |
|--------|------|------|
| CRITICAL | Authenticate Server Actions Like API Routes | [server-auth-actions.md](rules/server-auth-actions.md) |
| CRITICAL | Parallel Data Fetching with Component Composition | [server-parallel-fetching.md](rules/server-parallel-fetching.md) |
| HIGH | Cross-Request LRU Caching | [server-cache-lru.md](rules/server-cache-lru.md) |
| HIGH | Minimize Serialization at RSC Boundaries | [server-serialization.md](rules/server-serialization.md) |
| MEDIUM | Per-Request Deduplication with React.cache() | [server-cache-react.md](rules/server-cache-react.md) |
| MEDIUM | Use after() for Non-Blocking Operations | [server-after-nonblocking.md](rules/server-after-nonblocking.md) |
| LOW | Avoid Duplicate Serialization in RSC Props | [server-dedup-props.md](rules/server-dedup-props.md) |

### 4. Client-Side Data Fetching — MEDIUM-HIGH

| Impact | Rule | File |
|--------|------|------|
| MEDIUM-HIGH | Use SWR for Automatic Deduplication | [client-swr-dedup.md](rules/client-swr-dedup.md) |
| MEDIUM | Version and Minimize localStorage Data | [client-localstorage-schema.md](rules/client-localstorage-schema.md) |
| MEDIUM | Use Passive Event Listeners | [client-passive-event-listeners.md](rules/client-passive-event-listeners.md) |
| LOW | Deduplicate Global Event Listeners | [client-event-listeners.md](rules/client-event-listeners.md) |

### 5. Re-render Optimization — MEDIUM

| Impact | Rule | File |
|--------|------|------|
| MEDIUM | Calculate Derived State During Rendering | [rerender-derived-state-no-effect.md](rules/rerender-derived-state-no-effect.md) |
| MEDIUM | Subscribe to Derived State | [rerender-derived-state.md](rules/rerender-derived-state.md) |
| MEDIUM | Defer State Reads to Usage Point | [rerender-defer-reads.md](rules/rerender-defer-reads.md) |
| MEDIUM | Use Functional setState Updates | [rerender-functional-setstate.md](rules/rerender-functional-setstate.md) |
| MEDIUM | Use Lazy State Initialization | [rerender-lazy-state-init.md](rules/rerender-lazy-state-init.md) |
| MEDIUM | Extract Default Non-primitive to Constant | [rerender-memo-with-default-value.md](rules/rerender-memo-with-default-value.md) |
| MEDIUM | Extract to Memoized Components | [rerender-memo.md](rules/rerender-memo.md) |
| MEDIUM | Put Interaction Logic in Event Handlers | [rerender-move-effect-to-event.md](rules/rerender-move-effect-to-event.md) |
| MEDIUM | Use Transitions for Non-Urgent Updates | [rerender-transitions.md](rules/rerender-transitions.md) |
| MEDIUM | Use useRef for Transient Values | [rerender-use-ref-transient-values.md](rules/rerender-use-ref-transient-values.md) |
| LOW-MEDIUM | Do not wrap simple expression in useMemo | [rerender-simple-expression-in-memo.md](rules/rerender-simple-expression-in-memo.md) |
| LOW | Narrow Effect Dependencies | [rerender-dependencies.md](rules/rerender-dependencies.md) |

### 6. Rendering Performance — MEDIUM

| Impact | Rule | File |
|--------|------|------|
| HIGH | CSS content-visibility for Long Lists | [rendering-content-visibility.md](rules/rendering-content-visibility.md) |
| MEDIUM | Use Activity Component for Show/Hide | [rendering-activity.md](rules/rendering-activity.md) |
| MEDIUM | Prevent Hydration Mismatch Without Flickering | [rendering-hydration-no-flicker.md](rules/rendering-hydration-no-flicker.md) |
| LOW-MEDIUM | Suppress Expected Hydration Mismatches | [rendering-hydration-suppress-warning.md](rules/rendering-hydration-suppress-warning.md) |
| LOW | Animate SVG Wrapper Instead of SVG Element | [rendering-animate-svg-wrapper.md](rules/rendering-animate-svg-wrapper.md) |
| LOW | Use Explicit Conditional Rendering | [rendering-conditional-render.md](rules/rendering-conditional-render.md) |
| LOW | Hoist Static JSX Elements | [rendering-hoist-jsx.md](rules/rendering-hoist-jsx.md) |
| LOW | Optimize SVG Precision | [rendering-svg-precision.md](rules/rendering-svg-precision.md) |
| LOW | Use useTransition Over Manual Loading States | [rendering-usetransition-loading.md](rules/rendering-usetransition-loading.md) |

### 7. JavaScript Performance — LOW-MEDIUM

| Impact | Rule | File |
|--------|------|------|
| MEDIUM-HIGH | Early Length Check for Array Comparisons | [js-length-check-first.md](rules/js-length-check-first.md) |
| MEDIUM-HIGH | Use toSorted() Instead of sort() for Immutability | [js-tosorted-immutable.md](rules/js-tosorted-immutable.md) |
| MEDIUM | Avoid Layout Thrashing | [js-batch-dom-css.md](rules/js-batch-dom-css.md) |
| MEDIUM | Cache Repeated Function Calls | [js-cache-function-results.md](rules/js-cache-function-results.md) |
| LOW-MEDIUM | Cache Property Access in Loops | [js-cache-property-access.md](rules/js-cache-property-access.md) |
| LOW-MEDIUM | Cache Storage API Calls | [js-cache-storage.md](rules/js-cache-storage.md) |
| LOW-MEDIUM | Combine Multiple Array Iterations | [js-combine-iterations.md](rules/js-combine-iterations.md) |
| LOW-MEDIUM | Early Return from Functions | [js-early-exit.md](rules/js-early-exit.md) |
| LOW-MEDIUM | Hoist RegExp Creation | [js-hoist-regexp.md](rules/js-hoist-regexp.md) |
| LOW-MEDIUM | Build Index Maps for Repeated Lookups | [js-index-maps.md](rules/js-index-maps.md) |
| LOW-MEDIUM | Use Set/Map for O(1) Lookups | [js-set-map-lookups.md](rules/js-set-map-lookups.md) |
| LOW | Use Loop for Min/Max Instead of Sort | [js-min-max-loop.md](rules/js-min-max-loop.md) |

### 8. Advanced Patterns — LOW

| Impact | Rule | File |
|--------|------|------|
| LOW-MEDIUM | Initialize App Once, Not Per Mount | [advanced-init-once.md](rules/advanced-init-once.md) |
| LOW | Store Event Handlers in Refs | [advanced-event-handler-refs.md](rules/advanced-event-handler-refs.md) |
| LOW | useEffectEvent for Stable Callback Refs | [advanced-use-latest.md](rules/advanced-use-latest.md) |

---

## Keyword Search Guide

특정 주제의 규칙을 찾을 때 아래 키워드로 `rules/` 폴더에서 검색합니다:

| Keyword | 관련 규칙 파일 (prefix) |
|---------|------------------------|
| `waterfall`, `parallel`, `Promise.all` | `async-*` |
| `import`, `dynamic`, `lazy`, `code-splitting` | `bundle-*` |
| `RSC`, `Server Component`, `cache`, `serialization` | `server-*` |
| `SWR`, `localStorage`, `event listener` | `client-*` |
| `useMemo`, `memo`, `useCallback`, `setState`, `useRef` | `rerender-*` |
| `hydration`, `SVG`, `content-visibility`, `Activity` | `rendering-*` |
| `Map`, `Set`, `sort`, `RegExp`, `DOM` | `js-*` |
| `useEffectEvent`, `init`, `ref` | `advanced-*` |

---

**Version**: 1.0.0
**Source**: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (Jan 2026)
**Rules**: 57 rules across 8 categories in `rules/` directory
