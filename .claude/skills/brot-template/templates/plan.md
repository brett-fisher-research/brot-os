---
description: >
    The board's plan proposal, in two views with the same content. Chat view: exactly this template — human-scannable, checkbox-free. File view: the same plan written to .brot/plans/<unixtimestamp>-<short-name>.md (gitignored, never deleted), where each leaf and each test line gains a `- [ ]` box for machine tracking — agents tick them as work lands.

    Shape: a title line, a short goal (1-2 sentences), phases as headings, and under each phase numbered one-line leaves with a one-line test each. Each `Test:` pins BEHAVIOR - given an input, assert the output or effect - never restate the leaf or grep a doc for a phrase; it should read as documentation of what the code does. Leaf names are DESCRIPTIVE ONLY — section-coordinate labels (A1/B2 style) are forbidden anywhere in the plan. Close with a verification section: the deterministic checks that prove the whole plan done.

    Plan files MAY carry optional frontmatter with an `initiative: <slug>` field linking the plan to .brot/initiatives/<slug>.md — additive record-keeping only; plan naming and the reading flow are unchanged.

---

```
╔═══════════════════════════════════════╗
║  🥨 🗺️  PLAN                            ║
╚═══════════════════════════════════════╝
<title>

Goal: <1-2 sentences: the end-state and why>

## <Phase name>

1. <one-line leaf, descriptive name>
   Test: <behavior: given <input>, assert <output/effect> - bash assertion or vitest>
2. <one-line leaf>
   Test: <behavior: given <input>, assert <output/effect>>

## <Next phase name>

1. <one-line leaf>
   Test: <behavior: given <input>, assert <output/effect>>

## Verification

- <deterministic check that proves the whole plan done>
- <another check>
```
