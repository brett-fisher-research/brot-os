#!/usr/bin/env bash
# Asserts chrome-devtools MCP registration (.mcp.json), the /brot-peek skill, and blueprint wiring.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

MCP=".mcp.json"
SKILL=".claude/skills/brot-peek/SKILL.md"

# .mcp.json — chrome-devtools registered headless + isolated
check ".mcp.json exists" '[ -f "$MCP" ]'
check ".mcp.json is valid JSON" 'node -e "JSON.parse(require(\"fs\").readFileSync(\"$MCP\",\"utf8\"))"'
check "registers mcpServers.chrome-devtools" 'node -e "const j=JSON.parse(require(\"fs\").readFileSync(\"$MCP\",\"utf8\")); if(!j.mcpServers[\"chrome-devtools\"]) process.exit(1)"'
check "command is npx" 'node -e "const j=JSON.parse(require(\"fs\").readFileSync(\"$MCP\",\"utf8\")); if(j.mcpServers[\"chrome-devtools\"].command!==\"npx\") process.exit(1)"'
check "args pin chrome-devtools-mcp@latest" 'grep -q "chrome-devtools-mcp@latest" "$MCP"'
check "args set --headless=true" 'grep -q -- "--headless=true" "$MCP"'
check "args set --isolated=true" 'grep -q -- "--isolated=true" "$MCP"'

# /brot-peek skill
check "SKILL.md exists" '[ -f "$SKILL" ]'
check "has frontmatter name" 'grep -q "^name: brot-peek" "$SKILL"'
check "enforces png screenshots (never jpeg)" 'grep -qi "png ONLY" "$SKILL" && grep -qi "jpeg" "$SKILL"'
check "pulls console messages" 'grep -q "list_console_messages" "$SKILL"'
check "writes console output to .logs/" 'grep -q "\.logs/" "$SKILL"'

# blueprint wiring
check "CLAUDE.md mentions brot-peek" 'grep -q "brot-peek" CLAUDE.md'
check "CLAUDE.md mentions chrome-devtools" 'grep -q "chrome-devtools" CLAUDE.md'
check ".gitignore covers .logs/" 'grep -q "^\.logs/$" .gitignore'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
