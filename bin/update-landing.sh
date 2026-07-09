#!/usr/bin/env bash
# Regenerate $HOME_DIR/index.html: a mobile-first index of all experiments.
source "$(dirname "$(readlink -f "$0")")/lib.sh"

ensure_registry

# Retired once the home dashboard is a Next.js app: it reads the registry at request time, so there's
# no static index.html to regenerate. Existing callers can keep invoking this harmlessly.
if [ -f "$HOME_DIR/package.json" ] && grep -q '"next"' "$HOME_DIR/package.json"; then
  log "Home is a Next app; static landing retired (dashboard reads registry at runtime)."
  exit 0
fi

mkdir -p "$HOME_DIR"

cards=""
for slug in $(reg_list_slugs); do
  type="$(reg_field "$slug" type)"
  created="$(reg_field "$slug" created)"
  cards+="<a class=\"card\" href=\"/$slug/\"><span class=\"name\">$slug</span><span class=\"meta\">$type &middot; ${created%T*}</span></a>"
done
[ -n "$cards" ] || cards='<p class="empty">No experiments yet.</p>'

cat > "$HOME_DIR/index.html" <<HTML
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0f17">
<title>Experiments</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#0b0f17; color:#e6edf3; padding:max(16px,env(safe-area-inset-top)) 16px 32px; }
  h1 { font-size:1.5rem; margin:8px 4px 4px; }
  p.sub { margin:0 4px 20px; color:#8b98a9; }
  .grid { display:grid; gap:12px; }
  .card { display:flex; flex-direction:column; gap:4px; padding:18px 16px; border-radius:14px;
          background:#141b27; border:1px solid #1f2a3a; text-decoration:none; color:inherit;
          transition:transform .08s ease, background .15s ease; }
  .card:active { transform:scale(.985); background:#18212f; }
  .name { font-weight:600; font-size:1.1rem; }
  .meta { color:#8b98a9; font-size:.85rem; }
  .empty { color:#8b98a9; }
  code { background:#1f2a3a; padding:2px 6px; border-radius:6px; }
</style>
</head>
<body>
  <h1>Experiments</h1>
  <p class="sub">$TS_HOST</p>
  <div class="grid">$cards</div>
</body>
</html>
HTML

log "Rendered $HOME_DIR/index.html"
