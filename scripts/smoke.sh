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



LOGIN_RESP=$(curl -fsS -X POST "${BASE_URL}/api/auth/login" -H "Content-Type: application/json" -d '{"email":"ci_admin@piroska.test","password":"ci_password"}')

TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token // empty')



if [[ -z "${TOKEN}" ]]; then

  echo "ERROR: login did not return token. Response was:"

  echo "$LOGIN_RESP"

  exit 1

fi



echo "==> Auth smoke OK (token received)"



echo "==> Admin endpoint smoke (GET /api/admin/users)"



ADMIN_RESP=$(curl -fsS -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/admin/users")



# valid JSON?

echo "$ADMIN_RESP" | jq . >/dev/null



# response formátum: { users: [...] }

echo "$ADMIN_RESP" | jq -e '.users | type=="array"' >/dev/null

echo "$ADMIN_RESP" | jq -e '.users | length >= 1' >/dev/null

echo "$ADMIN_RESP" | jq -e '.users[] | select(.email=="ci_admin@piroska.test")' >/dev/null



# legyen valid JSON és legyen benne users tömb

echo "$ADMIN_RESP" | jq . >/dev/null



# a válasz formátuma nálatok: { users: [...] }

echo "$ADMIN_RESP" | jq -e '.users | type=="array"' >/dev/null



# legyen legalább 1 user

echo "$ADMIN_RESP" | jq -e '.users | length >= 1' >/dev/null



# legyen benne a seeded admin email

echo "$ADMIN_RESP" | jq -e '.users[] | select(.email=="ci_admin@piroska.test")' >/dev/null



echo "==> Admin smoke OK"




echo "==> Domain smoke: book -> credit(0) -> cancel -> credit(1)"



# BOOK class 1001

BOOK_RESP=$(curl -fsS -X POST -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/classes/1001/book")

echo "$BOOK_RESP" | jq . >/dev/null



BOOKING_ID=$(echo "$BOOK_RESP" | jq -r '.booking.id // empty')

if [[ -z "${BOOKING_ID}" ]]; then

  echo "ERROR: booking id not found in response"

  echo "$BOOK_RESP"

  exit 1

fi

echo "Booking id: ${BOOKING_ID}"



# CREDIT should be 0 after booking (seeded pass id = 3001)

echo "==> Domain smoke: credit after book"

CRED_AFTER_BOOK=$($COMPOSE exec -T db psql -U piroska -d piroskagym -tA -c "SELECT COALESCE(remaining_credits, -999) FROM user_passes WHERE id=3001;")

echo "remaining_credits after book: ${CRED_AFTER_BOOK}"

if [[ "${CRED_AFTER_BOOK}" != "0" ]]; then

  echo "ERROR: expected remaining_credits=0 after book, got ${CRED_AFTER_BOOK}"

  exit 1

fi



# CANCEL booking

CANCEL_RESP=$(curl -fsS -X POST -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/bookings/${BOOKING_ID}/cancel")

echo "$CANCEL_RESP" | jq . >/dev/null



# CREDIT should be 1 after cancel (refunded)

echo "==> Domain smoke: credit after cancel"

CRED_AFTER_CANCEL=$($COMPOSE exec -T db psql -U piroska -d piroskagym -tA -c "SELECT COALESCE(remaining_credits, -999) FROM user_passes WHERE id=3001;")

echo "remaining_credits after cancel: ${CRED_AFTER_CANCEL}"

if [[ "${CRED_AFTER_CANCEL}" != "1" ]]; then

  echo "ERROR: expected remaining_credits=1 after cancel, got ${CRED_AFTER_CANCEL}"

  exit 1

fi



echo "==> Domain smoke OK (book+cancel+credit refund verified)"
