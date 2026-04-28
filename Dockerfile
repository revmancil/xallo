# API + Prism UI on one origin (recommended for Railway).
# Build: docker build -t xallo .
# Run:  docker run -e DATABASE_URL=... -e OIDC_CLIENT_ID=... -p 8080:8080 xallo
FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json .npmrc ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts

ENV NODE_ENV=production
ENV BASE_PATH=/
ENV PORT=8080

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @workspace/prism-clone run build \
  && mkdir -p /app/prism-static \
  && cp -r artifacts/prism-clone/dist/public/* /app/prism-static/ \
  && pnpm --filter @workspace/api-server run build

ENV PRISM_STATIC_ROOT=/app/prism-static

WORKDIR /app/artifacts/api-server

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
