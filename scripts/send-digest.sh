#!/bin/sh
# Sends the weekly digest (a JSON file) to the admin console's Weekly briefing screen.
# The token comes from the DIGEST_INGEST_TOKEN environment variable, or from the file
# ~/.config/simchakit/digest-ingest-token (keep it owner-only: chmod 600). The token is never printed;
# only the HTTP status is.
# Refuses to send a file that has no fact-check marker: a "Fact-checked:" line, or the "fact_checked"
# key of the digest JSON (see docs/AGENT_TEAM.md for the shape).
# Usage: sh scripts/send-digest.sh agent-reports/digest-latest.json

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -r "$FILE" ]; then
  echo "Usage: sh scripts/send-digest.sh <digest.json>" >&2
  exit 2
fi

if ! grep -qiE '("fact_checked"[[:space:]]*:|^[[:space:]]*fact-checked:)' "$FILE"; then
  echo "Refusing to send: no Fact-checked line (or fact_checked key) in $FILE." >&2
  exit 3
fi

TOKEN="${DIGEST_INGEST_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -r "$HOME/.config/simchakit/digest-ingest-token" ]; then
  TOKEN="$(tr -d ' \r\n' < "$HOME/.config/simchakit/digest-ingest-token")"
fi
if [ -z "$TOKEN" ]; then
  echo "No digest token: set DIGEST_INGEST_TOKEN or create ~/.config/simchakit/digest-ingest-token." >&2
  exit 2
fi

# The header goes in through a config on stdin so the token never appears in the process list.
STATUS="$(printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" | curl -sS -m 30 -K - \
  -o /dev/null -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' --data-binary @"$FILE" \
  "${SIMCHAKIT_DIGEST_URL:-https://app.simcha-kit.com/api/admin?action=digest-ingest}")"

echo "HTTP $STATUS"
[ "$STATUS" = "200" ]
