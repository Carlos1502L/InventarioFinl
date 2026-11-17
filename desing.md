# Steep — Style Reference
> serif analytics on warm paper

**Theme:** light

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Steep renders analytics as editorial — serif Signifier headlines float over a near-monochrome white canvas while a single warm peach accent (#fbe1d1) punctuates an otherwise achromatic system. The page reads like a product magazine spread: oversized italicized display type, generous breathing room, large soft-edged cards at 24px radius, and pill-shaped controls that sit flat against the surface. Components feel quiet and weightless — shadows are barely-there, borders are hairline, and color is rationed to functional emphasis (a peach callout card, a dark brown label on peach). The product surfaces (region tables, activation charts, AI composers) are presented as floating artifacts around the headline, not nested in a dashboard shell.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Ink Black | `#17191c` | `--color-ink-black` | Primary text, filled button background, nav logo — the only dark surface in the system; every CTA and body headline resolves to this near-black |
| Paper White | `#ffffff` | `--color-paper-white` | Page canvas, button text, elevated card surfaces — the dominant background tone carrying ~76 frequency points |
| Mist Gray | `#f2f2f3` | `--color-mist-gray` | Card surfaces, secondary backgrounds, input fills — the quiet layer beneath paper for nested content |
| Fog White | `#fafafb` | `--color-fog-white` | Secondary page background for alternating sections, hover surfaces — one step above paper for subtle band variation |
| Slate Gray | `#777b86` | `--color-slate-gray` | Link color, muted helper text, footer copy — cool desaturated gray that sits between body text and disabled |
| Ash Gray | `#979799` | `--color-ash-gray` | Tertiary labels, category tags (Marketing, Finance, Sales) — one step lighter than link color |
| Smoke Gray | `#a3a6af` | `--color-smoke-gray` | Placeholder text (Ask anything…), disabled labels — the lightest functional gray, used when text recedes |
| Blush Peach | `#fbe1d1` | `--color-blush-peach` | Accent card background, warm highlight wash — the only chromatic surface in the system; creates editorial warmth against monochrome |
| Sienna Brown | `#5d2a1a` | `--color-sienna-brown` | Text and stroke on peach surfaces, dark accent for chart line strokes — a warm deep brown that pairs with Blush Peach like ink on kraft paper |

## Tokens — Typography

### Signifier — Display and headline serif — used exclusively for H1/H2 at three sizes; weight stays at 400 (regular) at every scale, which is the signature choice: the serif whispers authority rather than shouting in bold · `--font-signifier`
- **Substitute:** GT Sectra, Tiempos Headline, Source Serif 4, or ui-serif/Georgia as fallback
- **Weights:** 400
- **Sizes:** 44px, 64px, 90px
- **Line height:** 1.30
- **Letter spacing:** -2.25px at 90px, -0.96px at 64px, -0.66px at 44px

### Sohne — Body, UI, and navigation sans
- **Substitute:** Inter, Söhne (Klim Type Foundry), or ui-sans-serif/system-ui stack
- **Weights:** 400, 430, 450, 480, 500
- **Sizes:** 14px, 15px, 16px, 17px, 18px, 20px, 22px, 26px

## Tokens — Spacing & Shapes

**Base unit:** 4px
**Density:** comfortable

### Border Radius
- cards: 24px (`rounded-3xl` / `rounded-[24px]`)
- images: 12px (`rounded-xl`)
- inputs: 16px (`rounded-2xl` / `rounded-[16px]`)
- buttons: 9999px (`rounded-full`)
- smallCards: 16px
- elevatedCards: 20px

### Shadows
- subtle: `0 0 0 1px rgba(0,0,0,0.05), 0 4px 24px 0 rgba(0,0,0,0.08)`
- floating product artifact: `0 0 0 1px rgba(4,23,43,0.05), 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)`
