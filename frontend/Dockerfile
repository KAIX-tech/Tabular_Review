# Frontend (Next.js App Router) for Tabular Review
FROM node:20-alpine

WORKDIR /app

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_LLM_MODEL
ARG NEXT_PUBLIC_LLM_TIMEOUT_MS
# Mock toggles (per-domain falls back to the global flag). "false" => real API.
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_LLM_MODEL=$NEXT_PUBLIC_LLM_MODEL
ENV NEXT_PUBLIC_LLM_TIMEOUT_MS=$NEXT_PUBLIC_LLM_TIMEOUT_MS

# Internal network intercepts npm-registry TLS with a corporate cert, so disable
# strict-ssl for installs. (Registry fetches only; pnpm reads the same ~/.npmrc.)
# NOTE: weakens TLS verification — acceptable here for the closed internal deploy.
RUN npm config set strict-ssl false \
    && npm install -g pnpm@9

# Install dependencies first for layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build the app.
COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
