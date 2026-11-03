#!/bin/sh
# Prints the SimchaKit metrics summary (counts only, no personal data) for the planning agents.
# The read-only token comes from the METRICS_READ_TOKEN environment variable, or from the file
# ~/.config/simchakit/metrics-token. The token is never printed.
# Usage: sh scripts/fetch-metrics.sh > agent-reports/metrics-latest.json

TOKEN="${METRICS_READ_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -r "$HOME/.config/simchakit/metrics-token" ]; then
  TOKEN="$(tr -d ' \r\n' < "$HOME/.config/simchakit/metrics-token")"
fi
if [ -z "$TOKEN" ]; then
  echo "No metrics token: set METRICS_READ_TOKEN or create ~/.config/simchakit/metrics-token." >&2
  exit 2
fi

curl -sS -m 30 -H "Authorization: Bearer $TOKEN" \
  "${SIMCHAKIT_METRICS_URL:-https://app.simcha-kit.com/api/admin?action=metrics-summary}"
