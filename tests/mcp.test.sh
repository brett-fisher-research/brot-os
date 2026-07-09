#!/usr/bin/env bash
# Behavior: the chrome-devtools MCP server is registered in .mcp.json. Claude Code
# reads this file at startup to spawn MCP servers; malformed JSON or a missing
# chrome-devtools entry means /brot-peek has no browser to drive.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

MCP=".mcp.json"

check ".mcp.json exists" '[ -f "$MCP" ]'
check ".mcp.json is valid JSON" \
  'node -e "JSON.parse(require(\"fs\").readFileSync(\"$MCP\",\"utf8\"))"'
check "mcpServers is an object" \
  'node -e "const j=JSON.parse(require(\"fs\").readFileSync(\"$MCP\",\"utf8\")); if(typeof j.mcpServers!==\"object\"||!j.mcpServers) process.exit(1)"'
check "registers mcpServers.chrome-devtools" \
  'node -e "const j=JSON.parse(require(\"fs\").readFileSync(\"$MCP\",\"utf8\")); if(!j.mcpServers[\"chrome-devtools\"]) process.exit(1)"'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
