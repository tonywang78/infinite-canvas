# 统一镜像：用户前台 + 管理后台 + Midway API（Postgres 仍建议外挂）

FROM oven/bun:1.3.13 AS web-build
WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache
COPY VERSION /app/VERSION
COPY CHANGELOG.md /app/CHANGELOG.md
COPY web ./
# 同域反代，运行时由 config.js 注入 API 地址（默认同源）
ENV VITE_API_BASE_URL=
ENV VITE_PLATFORM_MODE=true
RUN bun run build

FROM oven/bun:1.3.13 AS admin-build
WORKDIR /app/admin
COPY admin/package.json admin/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache
COPY admin ./
# 管理后台挂在 /console/，避免与 cool-admin 的 /admin API 冲突
RUN bunx vite build --base=/console/

FROM oven/bun:1.3.13 AS server-build
WORKDIR /app/server
COPY server/package.json server/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache
COPY server ./
RUN bun run build \
 && rm -rf node_modules \
 && bun install --production --cache-dir=/root/.bun/install/cache

FROM oven/bun:1.3.13

WORKDIR /app
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production
ENV KOA_PORT=8001

RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx \
 && rm -rf /var/lib/apt/lists/*

# 用户前台
COPY --from=web-build /app/web/dist /usr/share/nginx/html
# 管理后台
COPY --from=admin-build /app/admin/dist /usr/share/nginx/html/console
# API
COPY --from=server-build /app/server/package.json /app/server/bun.lock /app/server/bootstrap.js /app/server/
COPY --from=server-build /app/server/dist /app/server/dist
COPY --from=server-build /app/server/public /app/server/public
COPY --from=server-build /app/server/node_modules /app/server/node_modules
COPY --from=server-build /app/server/typings /app/server/typings

COPY nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && mkdir -p /var/log/nginx /var/lib/nginx /run/nginx

EXPOSE 3000

CMD ["/entrypoint.sh"]
