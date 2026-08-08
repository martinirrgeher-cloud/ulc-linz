#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${CI:-}" != "true" ]]; then
  echo "WARNUNG: prepare-writing-e2e.sh ist fuer die GitHub-CI vorgesehen."
fi

TEMP_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
START_LOG="$TEMP_ROOT/ulc-supabase-start.log"
START_STATUS="$TEMP_ROOT/ulc-supabase-start.status"
START_DONE="$TEMP_ROOT/ulc-supabase-start.done"

rm -f "$START_LOG" "$START_STATUS" "$START_DONE"

SUPABASE_STARTED_AT="$(date +%s)"
OVERALL_STARTED_AT="$SUPABASE_STARTED_AT"

(
  set +e
  supabase start -x studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor >"$START_LOG" 2>&1
  code=$?
  date +%s >"$START_DONE"
  printf '%s\n' "$code" >"$START_STATUS"
  exit "$code"
) &
SUPABASE_PID=$!

cleanup_background() {
  if kill -0 "$SUPABASE_PID" 2>/dev/null; then
    kill "$SUPABASE_PID" 2>/dev/null || true
    wait "$SUPABASE_PID" 2>/dev/null || true
  fi
}
trap cleanup_background EXIT

echo "Supabase startet im Hintergrund (PID $SUPABASE_PID)."
echo "Parallel werden Chromium und dessen Linux-Abhaengigkeiten vorbereitet."

PLAYWRIGHT_STARTED_AT="$(date +%s)"
set +e
npx playwright install --with-deps chromium
PLAYWRIGHT_CODE=$?
set -e
PLAYWRIGHT_FINISHED_AT="$(date +%s)"

if [[ "$PLAYWRIGHT_CODE" -ne 0 ]]; then
  echo "FEHLER: Playwright/Chromium-Vorbereitung ist fehlgeschlagen."
  cleanup_background
  cat "$START_LOG" || true
  exit "$PLAYWRIGHT_CODE"
fi

set +e
wait "$SUPABASE_PID"
SUPABASE_WAIT_CODE=$?
set -e
trap - EXIT

cat "$START_LOG"

if [[ ! -f "$START_STATUS" || ! -f "$START_DONE" ]]; then
  echo "FEHLER: Supabase-Start hat keinen vollstaendigen Status hinterlassen."
  exit 1
fi

SUPABASE_CODE="$(cat "$START_STATUS")"
SUPABASE_FINISHED_AT="$(cat "$START_DONE")"
if [[ "$SUPABASE_WAIT_CODE" -ne 0 || "$SUPABASE_CODE" -ne 0 ]]; then
  echo "FEHLER: Lokale Supabase-Umgebung konnte nicht gestartet werden."
  exit "${SUPABASE_CODE:-1}"
fi

supabase status >/dev/null

OVERALL_FINISHED_AT="$(date +%s)"
SUPABASE_SECONDS=$((SUPABASE_FINISHED_AT - SUPABASE_STARTED_AT))
PLAYWRIGHT_SECONDS=$((PLAYWRIGHT_FINISHED_AT - PLAYWRIGHT_STARTED_AT))
OVERALL_SECONDS=$((OVERALL_FINISHED_AT - OVERALL_STARTED_AT))

echo "Supabase-Start: ${SUPABASE_SECONDS}s"
echo "Chromium-Vorbereitung: ${PLAYWRIGHT_SECONDS}s"
echo "Parallelblock gesamt: ${OVERALL_SECONDS}s"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Writing-E2E Vorbereitung"
    echo
    echo "| Teil | Dauer |"
    echo "|---|---:|"
    echo "| Supabase-Start | ${SUPABASE_SECONDS}s |"
    echo "| Chromium + Systemabhaengigkeiten | ${PLAYWRIGHT_SECONDS}s |"
    echo "| Parallelblock gesamt | ${OVERALL_SECONDS}s |"
    echo
    echo "Supabase und Chromium wurden parallel vorbereitet; der Gesamtwert entspricht daher nicht der Summe der Einzelzeiten."
  } >>"$GITHUB_STEP_SUMMARY"
fi
