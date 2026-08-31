---
name: SVG splash rasterization
description: Prevents malformed branded PNGs when rasterizing generated SVG splash screens with ImageMagick.
---

When generated splash SVGs embed logo geometry, scale the artwork through a nested SVG with its own `viewBox` instead of a shell-computed transform scale.

**Why:** Integer shell arithmetic rounded a fractional scale into a large whole-number multiplier. ImageMagick still produced valid PNG files, but the oversized white logo geometry covered most of the image, so dimension checks alone did not catch the failure.

**How to apply:** For future generated splash or launch images, use nested SVG viewport scaling and visually inspect at least one representative PNG after rasterization.