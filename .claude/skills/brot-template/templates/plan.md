---
description: >
    This template is the output of /brot-plan: a recursive, deterministic build plan written to a gitignored BROT_PLAN.md.

    Two parts. First, the high-level goal in 2-3 sentences — what end-state we're building and why. Second, a recursive checkbox breakdown: big pieces split into sub-steps, recursed until every leaf is an atomic unit of work. Surface only 1-3 tasks at a time per level so it stays skimmable. Use emojis as visual anchors (🎯 goal, 📋 test, 🪨 big piece). EVERY leaf carries a SPECIFIC, verifiable test — a bash assertion or a vite test — never a vague "done when it works".

---

```
# BROT_PLAN — <title>

> Gitignored scratch tracker. Durable record = merged PRs. /brot-done deletes this.

## 🎯 High-level goal
<2-3 sentences: the end-state being built and why>

## Order: <dependency order, e.g. A → B → C>

---

## 🪨 <Big piece 1>

- [ ] <leaf task>
  - 🎯 <atomic goal for this leaf>
  - [ ] 📋 Test: <specific bash assertion or vite test that proves this leaf done>
- [ ] <leaf task>
  - 🎯 <atomic goal>
  - [ ] 📋 Test: <specific test>

## 🪨 <Big piece 2> (depends on 1)

- [ ] <leaf task>
  - 🎯 <atomic goal>
  - [ ] 📋 Test: <specific test>
```
