#!/bin/sh
set -e

sanitize_id() {
    printf '%s' "$1" | tr -cd 'A-Za-z0-9-'
}

GA4_ID=$(sanitize_id "${ANALYTICS_GA4_ID:-}")
BAIDU_ID=$(sanitize_id "${ANALYTICS_BAIDU_ID:-}")
# 空字符串表示同域（经 nginx 反代 /app）；也可设为完整 URL
API_BASE_URL="${API_BASE_URL-}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  ANALYTICS_GA4_ID: "${GA4_ID}",
  ANALYTICS_BAIDU_ID: "${BAIDU_ID}",
  API_BASE_URL: "${API_BASE_URL}"
};
EOF

# Midway 默认监听可用端口；统一固定 8001 给本机 nginx 反代
export NODE_ENV="${NODE_ENV:-production}"

cd /app/server
bun run start &
API_PID=$!

# 等 API 起来再对外提供 nginx（最多约 30s）
i=0
while [ "$i" -lt 30 ]; do
    if bun -e "fetch('http://127.0.0.1:8001/').then(r=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
        break
    fi
    i=$((i + 1))
    sleep 1
done

nginx -g 'daemon off;' &
NGINX_PID=$!

term() {
    kill -TERM "$API_PID" "$NGINX_PID" 2>/dev/null || true
    wait "$API_PID" "$NGINX_PID" 2>/dev/null || true
}
trap term INT TERM

wait -n "$API_PID" "$NGINX_PID"
EXIT_CODE=$?
term
exit "$EXIT_CODE"
