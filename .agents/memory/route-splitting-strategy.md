---
name: Route splitting strategy
description: Why LexCom should prefer route-level lazy imports over broad manual vendor chunks.
---

Keep major pages behind route-level dynamic imports. Defer non-critical global UI until after the first React commit, and do not add broad manual vendor groups solely to make individual chunk sizes look smaller; compare the complete initial dependency graph instead.

**Why:** Eager global Toast, Tooltip, and network-status imports pulled Radix, Floating UI, icons, and `tailwind-merge` into the startup graph. Deferring non-critical global UI removed about 30% of the entry's compressed size. Grouping whole libraries into vendor chunks instead pulled more compressed JavaScript into the initial route and could create circular chunk warnings.

**How to apply:** After bundling changes, run a production build and inspect both the largest chunk and every static import of the entry chunk. Keep the enforced initial gzip budget passing and optimize total initial compressed bytes, not just the size of one file.