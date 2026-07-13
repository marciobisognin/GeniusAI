# syntax=docker/dockerfile:1
#
# Empacotamento opcional (PRD §14 — "Docker opcional"): roda o projeto sem
# Node instalado no host. Dois alvos (`backend`, `frontend`), selecionados
# pelo docker-compose.yml — build UMA vez, `npm ci` cacheado em camada
# própria (só invalida se os package.json mudarem).
#
# Limitação declarada: RUNNER=claude|codex|opencode exige o CLI
# correspondente instalado (e autenticado) DENTRO da imagem — fora do escopo
# desta fase. Nesta imagem, use RUNNER=mock (sempre funciona) ou
# RUNNER=ollama apontando para um Ollama rodando no host (ver
# docker-compose.yml). Para os runners de CLI, prefira `npm run dev` local.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
# Vite embute VITE_* no bundle em BUILD time (não dá pra trocar em runtime).
# O padrão "ws://localhost:8787" funciona sem configuração: quem conecta é o
# NAVEGADOR do host, e a porta 8787 do container é publicada em localhost.
ARG VITE_BACKEND_WS=ws://localhost:8787
ENV VITE_BACKEND_WS=$VITE_BACKEND_WS
RUN npm run build

# ── backend: HTTP + WebSocket (tsx, sem passo de build próprio) ────────────
FROM deps AS backend
COPY . .
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/data
EXPOSE 8787
CMD ["npx", "tsx", "apps/backend/src/index.ts"]

# ── frontend: serve o build via `vite preview` (mesma ferramenta do e2e) ───
FROM build AS frontend
WORKDIR /app/apps/frontend
EXPOSE 5173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
