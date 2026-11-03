FROM oven/bun:1.3.13 AS build

WORKDIR /build

COPY package.json ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache

COPY ./ ./
RUN bun run build

FROM nginx:1.27-alpine

RUN mkdir /app
COPY --from=build /build/dist /app
COPY --from=build /build/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
