# Awwwards — Style Reference
> Swiss editorial gallery wall — oversized type, full-bleed photography, and a single black floating rail to navigate.

**Theme:** light

## Tokens — Colors
| Name | Value | Token | Role |
|------|-------|-------|------|
| Brand Navy | `#1E3A5F` | `--color-brand-navy` | Sidebar lateral fijo, botones principales, textos clave |
| Brand Nude | `#E8B4A0` | `--color-brand-nude` | Acentos, estados activos, badges y líneas de calidez |
| Paper | `#ffffff` | `--color-paper` | Superficies de tarjetas, paneles, inputs y modales |
| Canvas | `#F8F9FA` | `--color-canvas` | Fondo general de la página |
| Fog | `#E5E7EB` | `--color-fog` | Bordes estructurales de 1px y divisores |
| Alert Yellow | `#ffdd00` | `--color-alert-yellow` | Acento exclusivo para dot/badge de stock bajo |

## Tokens — Typography
- **Fuente:** Inter Tight (o Inter / sans-serif como fallback).
- **Escala:** Display en pesos ligeros (300) a gran escala; etiquetas y metadata en 10px-13px con tracking amplio; cuerpo en 14px-16px.

## Tokens — Shapes & Elevation
- **Border Radius:** `rounded-2xl` (16px) como estándar transversal para tarjetas, paneles, ventanas flotantes y modales; `rounded-full` (9999px) para píldoras y badges; `8px` para botones compactos.
- **Elevation:** Sin sombras pesadas o agresivas. Elevación sutil basada en contraste de superficies o sombras suaves (`shadow-sm` / `shadow-md`).

---

## Architectural Principles
1. **Desktop Master Layout (>= 1024px):**
   - Fixed Navy Sidebar (`w-[250px]`, `#1E3A5F`, `h-screen`, `fixed top-0 left-0 bottom-0 z-40`).
   - Fixed Top Header with backdrop blur and border `#E5E7EB`.
   - Content area offset with `lg:pl-[250px]`, scrolling independently.
   - Asymmetric 2-Column Split (60% Form / 40% Live Preview) for creation, scanning, and editing.
2. **Mobile Master Layout (< 1024px):**
   - Interactive Radial Dial / Roulette Navigation anchored to bottom.
   - Dynamically adapts items based on inventory type (6 items for Business, 4 items for Personal).
3. **Strict Domain Segregation:**
   - **Home (Dashboard):** Houses the 2x2 KPI metrics matrix and the pure text activity manifest (recent sales & recent merchandise added).
   - **Stock (Catalog):** Clean inventory catalogue starting directly with search, categories, and product matrix without KPI blocks.
