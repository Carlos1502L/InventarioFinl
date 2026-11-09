# Ui — Style Reference
> clinical blueprint on frosted paper

**Theme:** light

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

shadcn/ui is a monochromatic design-system workshop: pure white canvas, soft warm-gray surfaces, and large-radius cards floating on hairline borders. The interface is almost entirely achromatic — black text, white surfaces, gray secondary tones — with a single destructive red reserved for error states and nothing else. Typography leans on Geist's geometric neutrality with tight letter-spacing on display sizes, creating a quiet, code-adjacent feel that reads as developer infrastructure rather than consumer product.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas | `#f5f5f5` | `--color-canvas` | Page background, muted surface fills, secondary buttons |
| Paper | `#ffffff` | `--color-paper` | Card surfaces, popover backgrounds, primary button fills |
| Surface Alt | `#fafafa` | `--color-surface-alt` | Sidebar background, subtle card variant, input resting state |
| Ink | `#0a0a0a` | `--color-ink` | Primary text, headings, button labels, icon strokes |
| Ink Soft | `#171717` | `--color-ink-soft` | Filled button backgrounds, secondary text on light surfaces |
| Mid Gray | `#737373` | `--color-mid-gray` | Muted body text, placeholder text, helper labels, icon fills at rest |
| Hairline | `#e5e5e5` | `--color-hairline` | Borders, input outlines, card edges, badge outlines |
| Ember | `#e7000b` | `--color-ember` | Red decorative accent for icons, marks, and small graphic details. Use as a supporting accent, not as a status color |

## Tokens — Typography

### Geist — All interface text — body at 14px/400, headings ranging 24–48px/600, buttons at 13–14px/500. Geist's geometric letterforms and uniform stroke width create a developer-tool neutrality; weight 600 at 48px with -0.05em tracking produces tight, confident display headlines that feel engineered rather than editorial. · `--font-geist`
- **Substitute:** Inter
- **Weights:** 400, 500, 600
- **Sizes:** 12, 13, 14, 16, 18, 24, 30, 36, 48
- **Line height:** 1.10, 1.11, 1.20, 1.33, 1.43, 1.50, 1.56, 1.63, 2.00
- **Letter spacing:** -0.0500em at display (48px), -0.0250em at subheading (24–30px), 0.0500em at caption (12px uppercase). Tracking tightens aggressively at large sizes and loosens slightly at small uppercase labels.
- **OpenType features:** `"ss01" on, "cv11" on`

### Border Radius
- cards: 24px (`rounded-3xl` / `rounded-[24px]`)
- interactive (buttons, inputs, badges): 18px (`rounded-[18px]`)
- small: 6px
- nested: 10px

### Shadows
- Card: `0 0 0 1px rgba(23,23,23,0.05), 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)`
- Button (filled): none — relies on tonal contrast (#0a0a0a)
- Input (focus): 1px solid #e5e5e5 or #0a0a0a ring
