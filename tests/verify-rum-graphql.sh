#!/usr/bin/env bash
# WAVE 0 · leaf 0.4 — the assumption-killer.
#
# Proves that Cloudflare Web Analytics (RUM) data for brettfisher.dev is queryable via the
# GraphQL `rumPageloadEventsAdaptiveGroups` dataset on THIS account/plan. The whole analytics
# half of the brettfisher.dev plan (beacon + dashboard widget) rests on this returning data.
#
# SUCCESS = HTTP 200 + a parseable `data.viewer.accounts[]` block with NO GraphQL `errors`.
# Zero rows is still success (it just means no pageviews yet) — we're proving queryability,
# not traffic. Prints the row count and exits 0. Any failure exits non-zero with a reason.
#
# Requires (from config/cloudflare.env): CLOUDFLARE_API_TOKEN (Account->Analytics->Read),
# CLOUDFLARE_ACCOUNT_ID, CF_WEB_ANALYTICS_SITE_TAG. Needs: curl, jq.
#
# Usage: tests/verify-rum-graphql.sh [days]   (default 7)
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
ENV_FILE="$ROOT/config/cloudflare.env"
DAYS="${1:-7}"
API="https://api.cloudflare.com/client/v4/graphql"

die() { echo "FAIL: $*" >&2; exit 1; }

command -v curl >/dev/null || die "curl not installed"
command -v jq   >/dev/null || die "jq not installed"
[ -f "$ENV_FILE" ] || die "missing $ENV_FILE (copy config/cloudflare.env.example and fill it in)"

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN in config/cloudflare.env}"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID in config/cloudflare.env}"
: "${CF_WEB_ANALYTICS_SITE_TAG:?set CF_WEB_ANALYTICS_SITE_TAG in config/cloudflare.env}"

start="$(date -u -d "${DAYS} days ago" +%Y-%m-%dT%H:%M:%SZ)"
end="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# rumPageloadEventsAdaptiveGroups lives under viewer.accounts[], filtered by the Web Analytics
# site tag. We group by requestPath + countryName — the exact dimensions the dashboard needs.
read -r -d '' QUERY <<'GQL' || true
query Verify($accountTag: String!, $siteTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPageloadEventsAdaptiveGroups(
        filter: { AND: [{ datetime_geq: $start, datetime_leq: $end }, { siteTag: $siteTag }] }
        limit: 100
        orderBy: [count_DESC]
      ) {
        count
        dimensions { metric: requestPath, country: countryName }
      }
    }
  }
}
GQL

payload="$(jq -n \
  --arg q "$QUERY" \
  --arg accountTag "$CLOUDFLARE_ACCOUNT_ID" \
  --arg siteTag "$CF_WEB_ANALYTICS_SITE_TAG" \
  --arg start "$start" \
  --arg end "$end" \
  '{query: $q, variables: {accountTag: $accountTag, siteTag: $siteTag, start: $start, end: $end}}')"

echo "Querying RUM for site=$CF_WEB_ANALYTICS_SITE_TAG  range=$start .. $end" >&2

resp="$(curl -sS -w $'\n%{http_code}' "$API" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$payload")" || die "curl request failed"

http_code="$(printf '%s' "$resp" | tail -n1)"
body="$(printf '%s' "$resp" | sed '$d')"

[ "$http_code" = "200" ] || die "HTTP $http_code from Cloudflare GraphQL — body: $body"

# Top-level GraphQL errors (bad token scope, unknown dataset, etc.) come back WITH a 200.
errs="$(printf '%s' "$body" | jq -r 'if (.errors // []) | length > 0 then (.errors | map(.message) | join("; ")) else empty end')"
[ -z "$errs" ] || die "GraphQL errors: $errs  (most likely the token lacks Account->Analytics->Read)"

# Must be a parseable accounts[] block; null means the account filter matched nothing.
accounts_ok="$(printf '%s' "$body" | jq -r '(.data.viewer.accounts // null) | if type=="array" then "yes" else "no" end')"
[ "$accounts_ok" = "yes" ] || die "no data.viewer.accounts[] — check CLOUDFLARE_ACCOUNT_ID. body: $body"

rows="$(printf '%s' "$body" | jq '[.data.viewer.accounts[].rumPageloadEventsAdaptiveGroups[]] | length')"

echo "PASS: RUM dataset is queryable. rows=$rows (zero is OK — proves queryability)."
printf '%s' "$body" | jq -r '.data.viewer.accounts[].rumPageloadEventsAdaptiveGroups[] | "  \(.count)\t\(.dimensions.metric)\t\(.dimensions.country)"' 2>/dev/null | head -10 || true
exit 0
