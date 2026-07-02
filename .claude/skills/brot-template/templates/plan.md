---
description: >
    The board's plan proposal, in two views with the same content. Chat view: exactly this template — human-scannable, checkbox-free. File view: the same plan written to .brot/plans/<unixtimestamp>-<short-name>.md (gitignored, never deleted), where each leaf and each test line gains a `- [ ]` box for machine tracking — agents tick them as work lands.

    Shape: a title line, a short goal (1-2 sentences), phases as headings, and under each phase numbered one-line leaves with a one-line test each. Leaf names are DESCRIPTIVE ONLY — section-coordinate labels (A1/B2 style) are forbidden anywhere in the plan. Close with a verification section: the deterministic checks that prove the whole plan done.

---

```
# PLAN — <title>

Goal: <1-2 sentences: the end-state and why>

## <Phase name>

1. <one-line leaf, descriptive name>
   Test: <specific bash assertion or vite test>
2. <one-line leaf>
   Test: <specific test>

## <Next phase name>

1. <one-line leaf>
   Test: <specific test>

## Verification

- <deterministic check that proves the whole plan done>
- <another check>
```
