#!/usr/bin/env bash

set -euo pipefail



COMPOSE="docker compose -f docker-compose.ci.yml"

BASE_URL="${BASE_URL:-http://127.0.0.1:14000}"



echo "==> Starting stack"

$COMPOSE up -d --build



cleanup() {

  echo "==> Logs (api)"

  $COMPOSE logs --no-color api || true

  echo "==> Tearing down"

  $COMPOSE down -v || true

}

trap cleanup EXIT



echo "==> Waiting for API /api/health"

for i in {1..60}; do

  # Ha még indul a szerver, curl néha reset-et dob — ezt elnyeljük a wait loopban.

  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then

    break

  fi

  sleep 1

done



echo "==> Health check"

curl -fsS "${BASE_URL}/api/health" | tee /tmp/health.json

grep -q '"status":"ok"' /tmp/health.json



echo "==> Auth smoke (login)"

# GH Actions ubuntu-latest-en általában van jq, de ha még sincs, install.

if ! command -v jq >/dev/null 2>&1; then

  apt-get update -y

  apt-get install -y jq

fi



LOGIN_RESP=$(

  curl -fsS -X POST "${BASE_URL}/api/auth/login" \

    -H "Content-Type: application/json" \

    -d '{"email":"ci_admin@piroska.test","password":"ci_password"}'

)



TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token // empty')



if [[ -z "${TOKEN}" ]]; then

  echo "ERROR: login did not return token. Response was:"

  echo "$LOGIN_RESP"

  exit 1

fi



echo "==> Auth smoke OK (token received)"
