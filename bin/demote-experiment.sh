#!/usr/bin/env bash
# Demote an experiment: remove it from the platform sidebar manifest. The app keeps
# its vendored sidebar chrome (harmless) unless you also remove that by hand and
# rebuild; the entry just stops appearing in the menu.
#
# Usage: demote-experiment.sh <slug>
source "$(dirname "$(readlink -f "$0")")/lib.sh"

slug="${1:?slug required}"
feat_has "$slug" || die "'$slug' is not a promoted feature"
feat_remove "$slug"
log "Demoted '$slug' (removed from the sidebar manifest)"
