---
alwaysApply: false
description: 
---
# Vercel SRE Autopilot
- Always prioritize terminal output containing 'vercel logs'.
- If a any error is detected:
    1. Identify the file/line from the trace.
    2. Check if the error is due to a missing Env Var (cross-reference with `.env.local`).
    3. Suggest a fix that includes error boundaries or better logging.
- After every fix, suggest running `vercel` to trigger a new preview build.