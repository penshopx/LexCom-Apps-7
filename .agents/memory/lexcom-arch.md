---
name: LexCom architecture
description: Key architectural decisions and runtime facts for the LexCom monorepo
---

## Service layout
- API server: artifact `artifacts/api-server`, port 8080 (managed workflow `artifacts/api-server: API Server`)
- Frontend: artifact `artifacts/lexcom`, port 22529 (managed workflow `artifacts/lexcom: web`), previewPath `/`
- Mobile: artifact `artifacts/lexcom-mobile`, Expo (managed workflow `artifacts/lexcom-mobile: expo`)
- All registered as proper Replit artifacts after Task #2 merge

## API routes (all under `/api` prefix)
health, auth, openai, cases, documents, forum, assistant, agentic, userProfile

## Auth
- Replit OIDC PKCE via `openid-client`; `redirect_uri` built dynamically from `x-forwarded-host` → auto-adapts to production domain
- Session stored in DB (`sessionsTable`), SID in secure cookie or Authorization Bearer header
- `/api/auth/user` → `{user: null}` for guests; protected pages gate with `useAuth()` hook

## Frontend API calls
All relative `/api/...` — no hardcoded hostnames. Safe for any deployment domain.

## Floating chatbot
`FloatingLexBot.tsx` mounted globally in `App.tsx`, context-aware prompts per pathname, SSE streaming to `/api/assistant/conversations/:id/chat`

**Why:** Knowing these prevents re-investigating common questions about how services connect.
