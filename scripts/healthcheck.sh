#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:30010}"
PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

pass() { printf '[PASS] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; exit 1; }
warn() { printf '[WARN] %s\n' "$1"; }

cd "$PROJECT_DIR"

command -v docker >/dev/null 2>&1 && pass "Docker exists" || fail "Docker not found"
docker compose version >/dev/null 2>&1 && pass "Docker Compose exists" || fail "Docker Compose not found"

if docker inspect chatui >/dev/null 2>&1; then
  state="$(docker inspect -f '{{.State.Status}}' chatui)"
  [ "$state" = "running" ] && pass "chatui container is running" || fail "chatui state is $state"
else
  fail "chatui container does not exist"
fi

if command -v ss >/dev/null 2>&1; then
  ss -ltn | grep -q ':30010 ' && pass "30010 is listening" || fail "30010 is not listening"
elif command -v netstat >/dev/null 2>&1; then
  netstat -ltn | grep -q ':30010 ' && pass "30010 is listening" || fail "30010 is not listening"
else
  warn "ss/netstat not found, skipping port listener check"
fi

code="$(curl -sS -o /tmp/chatui_health_body.$$ -w '%{http_code}' "$BASE_URL/api/auth/me" || true)"
rm -f /tmp/chatui_health_body.$$
case "$code" in
  200|401) pass "/api/auth/me returns expected HTTP $code" ;;
  *) fail "/api/auth/me returned HTTP $code" ;;
esac

[ -f "$PROJECT_DIR/data/prod.db" ] && pass "SQLite database exists at data/prod.db" || fail "data/prod.db not found"

logs="$(docker logs --tail 250 chatui 2>&1 || true)"
if printf '%s\n' "$logs" | grep -Eiq 'fatal|panic|EADDRINUSE|migration failed|admin initialization failed|PrismaClientInitializationError'; then
  printf '%s\n' "$logs" >&2
  fail "docker logs contain fatal error markers"
fi
pass "docker logs have no fatal markers"

if docker inspect chatui >/dev/null 2>&1; then
  if docker exec chatui sh -c 'grep -R -F "$OPENAI_API_KEY" .next/static public >/dev/null 2>&1'; then
    fail "client static assets contain the configured API key"
  fi
  if docker exec chatui sh -c 'grep -R -F "OPENAI_API_KEY" .next/static public >/dev/null 2>&1'; then
    fail "client static assets contain OPENAI_API_KEY marker"
  fi
  pass "client static assets do not expose OPENAI_API_KEY or the configured key"
fi

pass "healthcheck completed"
