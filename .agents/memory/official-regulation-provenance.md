---
name: Official regulation provenance
description: Trust boundary for presenting active, amended, or revoked regulation status
---

Only a structurally identified status field returned by the official government source may become an active, amended, or revoked label, and only after the page positively matches the requested regulation's type, number, and year. An official hostname alone is not identity evidence. Ambiguous markup, unsupported document types, search/listing pages, document mismatches, failed checks, stale results, and redirects outside the official HTTPS document URL must remain unavailable and display as requiring verification.

**Why:** A broad text search—or a valid government page for a different document—can create a dangerously authoritative false status for the requested regulation.

**How to apply:** Keep source checking server-side, accept only regulation identifiers from callers, bind final URL and page metadata/heading to the requested identity, globally bound and coalesce outbound work, and fail closed whenever identity or markup is uncertain.