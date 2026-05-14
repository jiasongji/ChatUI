#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:30010}"
RUN_MODEL_TEST="${RUN_MODEL_TEST:-0}"
PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass() { printf '[PASS] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 not found"
}

need curl
need python3

get_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "$PROJECT_DIR/.env" | tail -n 1 | sed -E 's/^"//; s/"$//'
}

ADMIN_EMAIL="$(get_env ADMIN_EMAIL)"
ADMIN_PASSWORD="$(get_env ADMIN_PASSWORD)"
[ -n "$ADMIN_EMAIL" ] || fail "ADMIN_EMAIL missing in .env"
[ -n "$ADMIN_PASSWORD" ] || fail "ADMIN_PASSWORD missing in .env"

json_body() {
  python3 - "$@" > "$TMP_DIR/body.json" <<'PY'
import json, sys
args = sys.argv[1:]
print(json.dumps(dict(zip(args[0::2], args[1::2]))))
PY
}

request() {
  local method="$1"
  local path="$2"
  local cookie="$3"
  local body="${4:-}"
  local timeout="${5:-60}"
  local output="$TMP_DIR/response.json"
  local code
  if [ -n "$body" ]; then
    code="$(curl -sS --max-time "$timeout" -o "$output" -w '%{http_code}' \
      -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' \
      -b "$cookie" -c "$cookie" \
      --data-binary @"$body" || true)"
  else
    code="$(curl -sS --max-time "$timeout" -o "$output" -w '%{http_code}' \
      -X "$method" "$BASE_URL$path" \
      -b "$cookie" -c "$cookie" || true)"
  fi
  printf '%s' "$code" > "$TMP_DIR/status"
}

expect_status() {
  local expected="$1"
  local label="$2"
  local actual
  actual="$(cat "$TMP_DIR/status")"
  if [ "$actual" != "$expected" ]; then
    printf 'Expected %s, got %s for %s\n' "$expected" "$actual" "$label" >&2
    sed -E 's/(sk-[A-Za-z0-9_.-]{8,})/[REDACTED]/g' "$TMP_DIR/response.json" >&2 || true
    exit 1
  fi
  pass "$label"
}

json_get() {
  python3 - "$TMP_DIR/response.json" "$1" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
value = data
for part in sys.argv[2].split('.'):
    if part.isdigit():
        value = value[int(part)]
    else:
        value = value[part]
print(value)
PY
}

find_user_id() {
  python3 - "$TMP_DIR/response.json" "$1" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
email = sys.argv[2]
for user in data["data"]["users"]:
    if user["email"] == email:
        print(user["id"])
        sys.exit(0)
sys.exit(1)
PY
}

sessions_contain() {
  python3 - "$TMP_DIR/response.json" "$1" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
needle = sys.argv[2]
print("yes" if any(item["id"] == needle for item in data["data"]["sessions"]) else "no")
PY
}

timestamp="$(date +%s)"
USER_A="smoke-a-${timestamp}@example.test"
USER_B="smoke-b-${timestamp}@example.test"
PASS_A="SmokePass-${timestamp}-A"
PASS_B="SmokePass-${timestamp}-B"
COOKIE_ADMIN="$TMP_DIR/admin.cookie"
COOKIE_A="$TMP_DIR/a.cookie"
COOKIE_B="$TMP_DIR/b.cookie"
COOKIE_NONE="$TMP_DIR/none.cookie"
: > "$COOKIE_ADMIN"
: > "$COOKIE_A"
: > "$COOKIE_B"
: > "$COOKIE_NONE"

request GET /api/auth/me "$COOKIE_NONE"
expect_status 401 "GET /api/auth/me returns 401 when unauthenticated"

json_body username "Smoke A" email "$USER_A" password "$PASS_A"
request POST /api/auth/register "$COOKIE_NONE" "$TMP_DIR/body.json"
expect_status 200 "register user A"

json_body username "Smoke B" email "$USER_B" password "$PASS_B"
request POST /api/auth/register "$COOKIE_NONE" "$TMP_DIR/body.json"
expect_status 200 "register user B"

json_body email "$USER_A" password "wrong-password"
request POST /api/auth/login "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 401 "wrong password is rejected"

json_body email "$USER_A" password "$PASS_A"
request POST /api/auth/login "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 200 "pending user can log in"

json_body title "pending session"
request POST /api/sessions "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 201 "pending user can create own session shell"
SESSION_PENDING="$(json_get data.session.id)"

json_body sessionId "$SESSION_PENDING" model "gpt-5.4-mini" content "hello"
request POST /api/chat "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 403 "pending user cannot call chat"

json_body sessionId "$SESSION_PENDING" model "gpt-image-2" prompt "a square"
request POST /api/images "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 403 "pending user cannot call images"

json_body email "$ADMIN_EMAIL" password "$ADMIN_PASSWORD"
request POST /api/auth/login "$COOKIE_ADMIN" "$TMP_DIR/body.json"
expect_status 200 "admin login"

request GET /api/admin/users "$COOKIE_ADMIN"
expect_status 200 "admin can list users"
USER_A_ID="$(find_user_id "$USER_A")"
USER_B_ID="$(find_user_id "$USER_B")"

request POST "/api/admin/users/${USER_A_ID}/approve" "$COOKIE_ADMIN"
expect_status 200 "admin approves user A"
request POST "/api/admin/users/${USER_B_ID}/approve" "$COOKIE_ADMIN"
expect_status 200 "admin approves user B"

json_body email "$USER_A" password "$PASS_A"
request POST /api/auth/login "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 200 "approved user A can log in"

json_body title "A private session"
request POST /api/sessions "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 201 "user A creates session"
SESSION_A="$(json_get data.session.id)"

json_body sessionId "$SESSION_A" model "not-a-model" content "hello"
request POST /api/chat "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 400 "chat rejects non-whitelisted model"

json_body sessionId "$SESSION_A" model "bad-image-model" prompt "a square"
request POST /api/images "$COOKIE_A" "$TMP_DIR/body.json"
expect_status 400 "images reject non-whitelisted model"

if [ "$RUN_MODEL_TEST" = "1" ]; then
  json_body sessionId "$SESSION_A" model "gpt-5.5" content "只回复 OK"
  request POST /api/chat "$COOKIE_A" "$TMP_DIR/body.json" 180
  expect_status 200 "approved user A can call gpt-5.5 chat"

  json_body sessionId "$SESSION_A" model "gpt-image-2" prompt "simple red square icon, plain white background"
  request POST /api/images "$COOKIE_A" "$TMP_DIR/body.json" 240
  expect_status 200 "approved user A can generate image with gpt-image-2"
else
  pass "model calls skipped; set RUN_MODEL_TEST=1 to test gpt-5.5 and gpt-image-2"
fi

json_body email "$USER_B" password "$PASS_B"
request POST /api/auth/login "$COOKIE_B" "$TMP_DIR/body.json"
expect_status 200 "approved user B can log in"

request GET /api/sessions "$COOKIE_B"
expect_status 200 "user B lists own sessions"
[ "$(sessions_contain "$SESSION_A")" = "no" ] && pass "user B cannot see user A session" || fail "user B saw user A session"

request GET "/api/messages?sessionId=${SESSION_A}" "$COOKIE_B"
expect_status 404 "user B cannot read user A messages"

request DELETE "/api/sessions/${SESSION_A}" "$COOKIE_B"
expect_status 404 "user B cannot delete user A session"

json_body title "B private session"
request POST /api/sessions "$COOKIE_B" "$TMP_DIR/body.json"
expect_status 201 "user B creates session"
SESSION_B="$(json_get data.session.id)"

json_body sessionId "$SESSION_A" model "gpt-5.4-mini" content "cross-user"
request POST /api/chat "$COOKIE_B" "$TMP_DIR/body.json"
expect_status 404 "user B cannot chat into user A session"

json_body sessionId "$SESSION_A" model "gpt-image-2" prompt "cross-user"
request POST /api/images "$COOKIE_B" "$TMP_DIR/body.json"
expect_status 404 "user B cannot generate image into user A session"

request POST "/api/admin/users/${USER_B_ID}/disable" "$COOKIE_ADMIN"
expect_status 200 "admin disables user B"

json_body email "$USER_B" password "$PASS_B"
request POST /api/auth/login "$TMP_DIR/b-disabled.cookie" "$TMP_DIR/body.json"
expect_status 401 "disabled user cannot log in"

json_body sessionId "$SESSION_B" model "gpt-5.4-mini" content "disabled"
request POST /api/chat "$COOKIE_B" "$TMP_DIR/body.json"
expect_status 403 "disabled user cookie cannot call chat"

request GET /api/admin/users "$COOKIE_A"
expect_status 403 "ordinary user cannot access admin API"

if docker inspect chatui >/dev/null 2>&1; then
  if docker exec chatui sh -c 'grep -R -F "$OPENAI_API_KEY" .next/static public >/dev/null 2>&1'; then
    fail "client static assets contain the configured API key"
  fi
  if docker exec chatui sh -c 'grep -R -F "OPENAI_API_KEY" .next/static public >/dev/null 2>&1'; then
    fail "client static assets contain OPENAI_API_KEY marker"
  fi
  pass "client static assets do not expose OPENAI_API_KEY or the configured key"
fi

pass "smoke test completed"
