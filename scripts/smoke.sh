#!/usr/bin/env bash

set -euo pipefail



COMPOSE="docker compose -f docker-compose.ci.yml"

BASE_URL="http://127.0.0.1:14000"



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

  if curl -fsS "${BASE_URL}/api/health" >/dev/null; then

    break

  fi

  sleep 1

done



echo "==> Health check"

curl -fsS "${BASE_URL}/api/health" | tee /tmp/health.json

grep -q '"status":"ok"' /tmp/health.json



echo "==> Auth smoke (login)"

if ! command -v jq >/dev/null 2>&1; then

  sudo apt-get update -y

  sudo apt-get install -y jq

fi



TOKEN=$(

  curl -fsS -X POST "${BASE_URL}/api/auth/login" \

    -H "Content-Type: application/json" \

    -d '{"email":"ci_admin@piroska.test","password":"ci_password"}' \

  | jq -r '.token // empty'

)



if [[ -z "${TOKEN}" ]]; then

  echo "ERROR: login did not return token"

  exit 1

fi



echo "==> Auth smoke OK (token received)"
