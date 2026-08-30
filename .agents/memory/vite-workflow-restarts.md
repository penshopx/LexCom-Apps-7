---
name: Vite workflow restarts
description: Replit workflow restart can leave an older LexCom Vite process holding the configured frontend port.
---

If the managed LexCom web workflow reports that port 22529 is occupied and starts on 22530, check for multiple Vite process groups before accepting the restart as healthy.

**Why:** A managed restart once left the older Vite process group alive, so the replacement workflow silently selected the next port and no longer matched the artifact's configured port.

**How to apply:** Stop only the older LexCom Vite process group, restart the existing artifact-owned web workflow, then confirm exactly one Vite process remains and logs show localhost:22529.