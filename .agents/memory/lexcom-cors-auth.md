---
name: CORS & auth configuration
description: CORS and authentication decisions for LexCom API server
---

## CORS
`cors({ credentials: true, origin: true })` — reflects the requesting origin rather than a fixed allowlist.

**Why:** In production both frontend and API share the same domain (API at `/api` path), so CORS is same-origin and this setting is harmless. In dev, cross-origin works without hardcoding the dev domain.

**How to apply:** Do not add a fixed `origin` allowlist unless multi-domain setup is introduced.

## Login redirect_uri
Built from `req.headers["x-forwarded-host"]` and `req.headers["x-forwarded-proto"]` in `routes/auth.ts → getOrigin()`. Automatically uses production domain after deploy — no env var needed.
