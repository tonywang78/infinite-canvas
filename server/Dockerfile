FROM oven/bun:1.3.13 AS build

WORKDIR /app

COPY package.json ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache

COPY . .
RUN bun run build

FROM oven/bun:1.3.13

WORKDIR /app
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/bun.lock ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/bootstrap.js ./
COPY --from=build /app/public ./public
COPY --from=build /app/typings ./typings

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --production --cache-dir=/root/.bun/install/cache

EXPOSE 8001

CMD ["bun", "run", "start"]
