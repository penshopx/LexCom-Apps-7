---
name: Merged route integrity
description: Verification rule for API router changes that arrive through merged parallel work
---

After merged work touches an Express router and its tests, verify both the production build and endpoint-specific tests before diagnosing failures in later features.

**Why:** A merge can leave route boundaries syntactically malformed while independently changing test URLs or event assertions. Either problem can make an unrelated feature appear broken, and fixing only one does not restore trustworthy validation.

**How to apply:** For API changes near recently merged routes, run the API build first, then the focused route tests, then the full API suite. Check that test requests still target the router mounted in each fixture and assert the route's actual SSE shape.