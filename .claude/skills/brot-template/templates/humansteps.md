---
description: >
    This template lays out the manual steps Brett must do himself — only TRUE human steps, nothing the agent can do. Two modes: setup (an external/manual task the agent can't do — log into a service, create an app, copy secrets back) or verify (confirm a change works — click here, check this value).

    Each step is an imperative action + where/how + the observable result to expect. For secrets, say what to copy and where to paste it back; never ask Brett to paste a secret into chat unless needed, and say so plainly. Keep steps minimal and ordered; split a step if it hides two actions. Omit 📋 Paste back only when truly nothing comes back.

---

```
🧑 Human steps — <verify | setup>: <subject>

1. <imperative action> — <where / how>
   → expect: <observable result>
2. <next action> — <where / how>
   → expect: <observable result>

✅ Done when: <the end state you should see>
📋 Paste back: <what to return to me, or "nothing">
```
