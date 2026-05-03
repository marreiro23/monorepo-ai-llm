FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app

COPY . .

ARG APP_NAME=monorepo-ai-llm
RUN npx nest build ${APP_NAME}
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules

ARG APP_NAME=monorepo-ai-llm
ENV APP_NAME=${APP_NAME}
COPY --from=build /app/dist/apps/${APP_NAME} ./dist/apps/${APP_NAME}

EXPOSE 3000
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main"]
