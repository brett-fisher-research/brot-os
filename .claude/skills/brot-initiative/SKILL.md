---
name: brot-initiative
description: Track long-term AI+human goals (weeks/months — a product launch, learning piano) as human-readable markdown files in .brot/initiatives/. Four verbs — create, resume, log, close. Use PROACTIVELY when the user says "start a new initiative", "work on the <name> initiative", "let's check on <initiative>", "close out the initiative" — and whenever a loggable moment surfaces in conversation (progress reported, a pivot, human-only work like marketing posted or practice done): offer to log it, then return to the flow.
---

# Brot Initiative

Long-term goal tracking above plans. A plan tracks one brot session, fully decomposed; an
initiative tracks a weeks/months goal mixing AI work and human work — coarse, revisable,
ambiguous at the tail. One file per initiative at `.brot/initiatives/<slug>.md` (gitignored,
NEVER deleted), shaped by the `initiative` template. Human-readable first: emoji statuses, no
checkboxes, no bold. A fresh session re-orients from Status + Now / next + the latest log entry.

On entry, print this block:

```
🥨 BROT INITIATIVE
```

## Create

1. Whiteboard the goal on the board (via `/brot-board`) until it is SMART — specific and
   measurable, "done" unambiguous. Push back on vague goals; refine success measures until each
   is a checkable signal.
2. Write `.brot/initiatives/<slug>.md` via `/brot-template initiative`.
3. Guard against premature perfection: milestones at the tail may be 💭 fuzzy, open questions
   may stay open. Good enough for now — the file is revisable and will sharpen as we learn.

## Resume

1. Read the initiative file. Re-orient from Status, Now / next, and the latest log entry.
2. Continue on the board as co-manager: check progress against milestones and success measures,
   offer suggestions on ambiguous decisions, spin up research agents when useful.
3. Update Now / next and milestone statuses as the picture changes.

## Log

Append a dated entry to the Log section, NEWEST FIRST — from the user's words, or from a
loggable moment detected in conversation (PR merged, pivot decided, human work reported).

- The user's human-only progress (marketing posted, practice done) is a first-class log source.
- Entry shape: `### <date> — <one-line summary>`, short body, author noted as "the user:" /
  "PM:" when it matters.
- Logging NEVER breaks the whiteboard flow: log, then return to thinking. No detours, no
  status ceremony.

## Close

1. Confirm the success measures are met — or the user explicitly calls it done (or 🧊 iced).
2. Set the header status to 🏁 done, write a final log entry summarizing the arc.
3. The file stays in `.brot/initiatives/` forever. Files are never deleted.
