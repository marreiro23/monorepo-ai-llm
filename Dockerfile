FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci

FROM deps AS build
WORKDIR /app

COPY . .

ARG APP_NAME=monorepo-ai-llm
RUN npx nest build ${APP_NAME} \
  && npx tsc -p packages/auth/tsconfig.json \
  && npx tsc -p packages/shared/tsconfig.json

FROM node:22-bookworm-slim AS runtime-deps
WORKDIR /app

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages

ARG APP_NAME=monorepo-ai-llm
RUN npm ci --omit=dev --workspace=apps/${APP_NAME} --include-workspace-root=false

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=runtime-deps /app/package*.json ./
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

ARG APP_NAME=monorepo-ai-llm
ENV APP_NAME=${APP_NAME}
COPY --from=build /app/dist/apps/${APP_NAME} ./dist/apps/${APP_NAME}

EXPOSE 3000
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main"]
