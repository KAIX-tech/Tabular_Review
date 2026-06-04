# Frontend (Next.js App Router) for Tabular Review
FROM node:20-alpine

WORKDIR /app

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_LLM_MODEL
ARG NEXT_PUBLIC_LLM_TIMEOUT_MS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_LLM_MODEL=$NEXT_PUBLIC_LLM_MODEL
ENV NEXT_PUBLIC_LLM_TIMEOUT_MS=$NEXT_PUBLIC_LLM_TIMEOUT_MS

RUN npm install -g pnpm

# Install dependencies first for layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build the app.
COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
