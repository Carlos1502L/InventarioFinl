# Freitag — Style Reference
> Swiss industrial catalog — a printed manifest of truck tarpaulins laid flat on poured concrete, where the only color is the recycled product itself.

**Theme:** light

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Freitag operates as a Swiss industrial catalog in monochrome: an almost color-zero system where the only chromatic surface is the product itself (truck tarpaulin bags bleeding red, yellow, blue, green). The UI is a grid of black, white, and concrete gray, serving as a neutral stage for the circular-economy merchandise. Typography is compressed and uppercase-driven (Akkurat Standard), line-heights tight as machinery, letterspacing wide on labels, and interactive elements shaped as horizontal pills with hard-edged 1px outlines. Layout follows a strict modular grid — full-bleed 50/50 hero, then 3-column category blocks, then 6-column product matrices. The signature trick: the site reads as a technical specification sheet or shipping manifest, not a fashion storefront. Components feel like they're stamped on the page rather than designed — pill buttons, thin rules, hairline grids, and almost no shadow depth.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Carbon Black | `#000000` | `--color-carbon-black` | Primary text, logo plate, pill-button fills, hairline borders, icon strokes — the dominant ink that carries every label, heading, and outline |
| Paper White | `#ffffff` | `--color-paper-white` | Page canvas, card surfaces, product image backdrops, button text on dark fills, inverted text on category overlays |
| Concrete Gray | `#cacaca` | `--color-concrete-gray` | Card borders, thumbnail dividers, secondary dividers between product cells — the structural neutral that frames the grid |
| Mist Gray | `#f1f1f1` | `--color-mist-gray` | Subtle surface tint for inactive button states and soft fill washes, never a page background |
| Iron Gray | `#404040` | `--color-iron-gray` | Deep shadow tone and heavier border treatment for elevated containers and section breaks |
| Ash Gray | `#616161` | `--color-ash-gray` | Muted secondary text, body helpers, tertiary borders — the gray that whispers beneath the ink |
| Ink | `#1a1b1e` | `--color-ink` | Rare near-black accent for solid button fills that need a touch of warmth without drifting to pure carbon |
| Caution Yellow | `#ffdd00` | `--color-caution-yellow` | Yellow wash for highlight backgrounds, decorative bands, and soft emphasis behind content. |

## Tokens — Typography

### ui-sans-serif — ui-sans-serif — detected in extracted data but not described by AI · `--font-ui-sans-serif`
- **Weights:** 400
- **Sizes:** 11px, 16px
- **Line height:** 1.15, 1.5
- **Letter spacing:** 0.02
- **Role:** ui-sans-serif — detected in extracted data but not described by AI

### AkkStdRg (Akkurat Standard) — Sole brand typeface. The neo-grotesque Swiss workhorse used for everything from display headlines down to 8px eyebrow labels. Weight stays at 400 — no bold weight exists in the system; emphasis is achieved through size, uppercase, and tracking. The 0.74 line-height on display sizes is anti-conventional and creates a compressed, industrial poster effect. Wide tracking on small sizes (0.04–0.05em) gives labels the spacing of machine-stamped serial numbers. · `--font-akkstdrg-akkurat-standard`
- **Substitute:** Inter, Helvetica Neue, Aktiv Grotesk
- **Weights:** 400
- **Sizes:** 8px, 10px, 11px, 16px, 24px, 32px, 48px
- **Line height:** 0.74 / 0.97 / 1.10 / 1.15 / 1.28 / 1.50
- **Letter spacing:** −0.48px at 48px, −0.16px at 32px, +0.32px at 16px, +0.44px at 11px, +0.50px at 10px, +0.40px at 8px
- **OpenType features:** `"tnum" on, "ss01" on`
- **Role:** Sole brand typeface. The neo-grotesque Swiss workhorse used for everything from display headlines down to 8px eyebrow labels. Weight stays at 400 — no bold weight exists in the system; emphasis is achieved through size, uppercase, and tracking. The 0.74 line-height on display sizes is anti-conventional and creates a compressed, industrial poster effect. Wide tracking on small sizes (0.04–0.05em) gives labels the spacing of machine-stamped serial numbers.

### FRg (Freitag Regular) — Reserved for product model codes (F141 CLARK, F531 ARCHER) — a secondary condensed-mark treatment that makes the SKU read as a stamped part number on a shipping crate · `--font-frg-freitag-regular`
- **Substitute:** Akkurat Standard Small Caps
- **Weights:** 400
- **Sizes:** 10px
- **Line height:** 0.74
- **Letter spacing:** +0.50px
- **Role:** Reserved for product model codes (F141 CLARK, F531 ARCHER) — a secondary condensed-mark treatment that makes the SKU read as a stamped part number on a shipping crate

### Arial — Arial — detected in extracted data but not described by AI · `--font-arial`
- **Weights:** 400
- **Sizes:** 10px
- **Line height:** 1
- **Role:** Arial — detected in extracted data but not described by AI

### sans-serif — sans-serif — detected in extracted data but not described by AI · `--font-sans-serif`
- **Weights:** 400
- **Sizes:** 16px
- **Line height:** 1.2
- **Role:** sans-serif — detected in extracted data but not described by AI

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| label-xs | AkkStdRg | 400 | 8px | 1.10 | +0.40px | `--text-label-xs` |
| sku / code | FRg / AkkStdRg | 400 | 10px | 0.74 | +0.50px | `--text-sku` |
| label-sm | AkkStdRg | 400 | 11px | 1.15 | +0.44px | `--text-label-sm` |
| body | AkkStdRg | 400 | 16px | 1.50 | +0.32px | `--text-body` |
| subheading | AkkStdRg | 400 | 24px | 1.28 | 0px | `--text-subheading` |
| heading | AkkStdRg | 400 | 32px | 0.97 | -0.16px | `--text-heading` |
| display | AkkStdRg | 400 | 48px | 0.74 | -0.48px | `--text-display` |

---

## Layout & Structural Grid

- **Modular Swiss Grid:** Full-bleed 50/50 hero splits, 3-column operational blocks, and 6-column product matrices.
- **Hairline Dividers:** `1px solid var(--color-concrete-gray)` structural rules framing all grid cells and data boundaries.
- **Zero Heavy Shadows:** Shadows are rejected in favor of razor-sharp hairline borders (`--color-concrete-gray` and `--color-iron-gray`).
- **Pill Shape Geometry:** Interactive buttons, category filters, and tags are rendered as horizontal pills (`border-radius: 9999px`) with crisp 1px borders or solid Carbon Black fills.
- **Technical Manifest Feel:** Data, serial numbers, SKUs, and inventory telemetry use tabular numerals (`tnum`), uppercase tracking, and compact line-heights.
- **Chromatic Restraint:** Canvas and interface chrome remain strictly monochromatic (Carbon Black, Paper White, Concrete Gray). Pure saturated colors are reserved exclusively for the merchandise, camera feeds, and physical tarpaulin assets.
