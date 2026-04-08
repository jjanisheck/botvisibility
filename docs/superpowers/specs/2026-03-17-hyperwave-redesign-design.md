# BotVisibility Hyperwave Redesign — Design Spec

## Overview

Comprehensive UI/UX redesign applying taste-skill standards with a hybrid approach: neo-brutalist scanner zone + premium results zone. The "Electric Aurora" gradient system becomes the visual identity, replacing the current lavender/mint/purple palette.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Design direction | Hybrid (neo-brutalist scanner + premium results) | Scanner is a tool — should feel like one. Results need polish for shareability. |
| Gradient identity | Electric Aurora (`#0ea5e9 → #2563eb → #7c3aed → #c026d3`) | Bold spectrum sweep. Maximum brand recall. Differentiator in commodity space. |
| Font stack | Geist + Geist Mono (replacing Inter + Space Grotesk + Space Mono) | Inter banned by taste-skill. Geist is modern, distinctive, pairs well with Mono. |
| Icon library | `@phosphor-icons/react` (bold weight) | Rich library, multiple weights, replaces all emojis per taste-skill anti-emoji policy. |
| Hero layout | Centered input with asymmetric background elements | UX-practical centering + off-center radar rings satisfy DESIGN_VARIANCE=8. |
| Accent strategy | Aurora gradient as brand (no single flat accent color) | The gradient IS the brand identity. Tier status colors (red/amber/yellow/green) preserved for semantic meaning. |

## 1. Visual Identity

### Color Palette

**Neutrals (Zinc scale):**
- Background dark: `#09090b` (Zinc-950)
- Surface dark: `#18181b` (Zinc-900)
- Border dark: `#27272a` (Zinc-800)
- Background light: `#fafafa` (Zinc-50)
- Surface light: `#ffffff` (White)
- Border light: `#e4e4e7` (Zinc-200)
- Text primary: `#09090b` (Zinc-950)
- Text secondary: `#52525b` (Zinc-600)
- Text tertiary: `#71717a` (Zinc-500)
- Text inverse: `#fafafa` (Zinc-50)

**Electric Aurora gradient:**
- Full: `linear-gradient(135deg, #0ea5e9, #2563eb, #7c3aed, #c026d3)`
- Glow (ambient): same colors at 10-15% opacity for shadows
- Button shadow: `0 0 30px rgba(37,99,235,0.15), 0 0 60px rgba(124,58,237,0.08)`

**Tier status colors (semantic — preserved):**
- Invisible: `#ef4444` (Red-500)
- Dim: `#f59e0b` (Amber-500)
- Visible: `#eab308` (Yellow-500) — changed from current `#FACC15` for better contrast on light backgrounds
- Clear: `#22c55e` (Green-500)
- Beacon: Aurora gradient

### Typography

**Font loading (layout.tsx):**
- Remove: Inter, Space Grotesk, Space Mono
- Add: Geist (400, 500, 600, 700, 800), Geist Mono (400, 700)
- Strategy: `display: swap`

**Scale:**
- Display/H1: `text-4xl md:text-5xl`, weight 800, `tracking-tighter`, `leading-none`
- H2: `text-2xl md:text-3xl`, weight 700, `tracking-tight`
- Body: `text-base`, weight 400, `leading-relaxed`, `max-w-[65ch]`
- Mono/Data: Geist Mono, weight 400-700
- Labels: `text-xs`, weight 600, `uppercase`, `tracking-widest`

### Icons

**Install:** `npm install @phosphor-icons/react`

**Tier icon mapping:**
| Tier | Phosphor Icon | Weight |
|------|--------------|--------|
| Invisible | `Ghost` | bold |
| Dim | `SunDim` | bold |
| Visible | `Eye` | bold |
| Clear | `CheckCircle` | bold |
| Beacon | `Broadcast` | bold |

**Check status icon mapping:**
| Status | Phosphor Icon | Weight |
|--------|--------------|--------|
| Pass | `CheckCircle` | bold |
| Fail | `XCircle` | bold |
| Partial | `Warning` | bold |
| Unknown | `Question` | bold |

**All other emojis** in UI text, badges, and labels are removed and replaced with appropriate Phosphor icons or plain text.

## 2. Layout & Components

### Scanner Zone (Hero — Neo-Brutalist)

**Container:**
- Background: Zinc-950 (`#09090b`)
- Full-width, centered content with `max-w-4xl mx-auto`
- Padding: `py-16 md:py-24 px-4`

**Asymmetric background elements:**
- 3 concentric radar rings, positioned off-center (right-shifted, top-shifted)
- Ring strokes: faint Aurora gradient at 4-10% opacity
- `pointer-events-none`, `position: absolute`

**Header:**
- Monospace label: `"AI AGENT READINESS SCANNER"` in Aurora blue (`#2563eb`), `text-xs tracking-widest uppercase`
- H1: `"BotVisibility"` in Zinc-50, `text-4xl md:text-5xl font-extrabold tracking-tighter`
- Subtitle: `"How visible is your site to AI agents?"` in Zinc-500

**Input group:**
- Container: `border-[3px] border-zinc-800`, `bg-zinc-900`, `rounded-lg`
- Shadow (idle): `box-shadow: 5px 5px 0 #2563eb` (brutalist offset)
- Shadow (focus-within): `box-shadow: 0 0 0 3px rgba(37,99,235,0.3), 5px 5px 0 #2563eb` (Aurora glow added)
- `https://` prefix: Zinc-600 on Zinc-950 background, monospace, `border-r-2 border-zinc-800`
- Input: transparent background, Zinc-50 text, `text-lg`
- Scan button: Aurora gradient background, white text, `font-bold uppercase tracking-wide`, `border-l-[3px] border-blue-700`
- Focus state: border color shifts to `#2563eb`, Aurora glow shadow as above

### Results Zone (Premium)

**Container:**
- Background: Zinc-50 (`#fafafa`)
- Content: `max-w-4xl mx-auto px-4`

**Score card:**
- Background: White
- Border: `1px solid` Zinc-200
- Border-radius: `rounded-[2.5rem]`
- Shadow: diffusion (`0 20px 40px -15px rgba(0,0,0,0.05)`)
- Padding: `p-8 md:p-10`
- Layout: Flex row (stacked on mobile) — left: tier badge + description, right: score gauge
- Score number: Geist Mono, `text-5xl font-extrabold`, Aurora gradient text fill via `background: <aurora-gradient>; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;`
- Tier badge: pill shape (`rounded-full`), tier color background at 10% opacity, tier color text, Phosphor tier icon

**Check result cards:**
- White background, `rounded-xl`
- Border: `1px solid` Zinc-200
- Left color-bar: `border-left: 3px solid <status-color>` (pass=green, fail=red, partial=amber)
- Layout: horizontal flex — status icon (32x32 square, tinted background, rounded-lg) + text (name bold, description secondary) + status pill badge
- Vertical stack with `gap-2` between items
- No 3-column grid patterns

**Manual checks section:**
- Collapsible sections grouped by level
- Level header: Phosphor icon + level name + count badge
- Items: simple list with checkbox-style indicators
- Expansion: chevron rotation + smooth max-height transition

### Checklist Page (`/checklist`)

- Same premium light aesthetic as results zone
- Back link: left arrow + "Back to Scanner", Aurora gradient on hover
- Level sections: full-width, separated by generous spacing (`gap-12`)
- Level header: large Phosphor icon + level name + description
- Items: clean vertical list, left color-bar, no individual card wrapping
- CTA at bottom: Aurora gradient button linking to scanner
- Footer: consistent with main page

### Shared Components

**Primary button:** Aurora gradient background, white text, `rounded-lg`, `font-bold`, `px-6 py-3`
- Hover: brightness increase
- Active: `scale-[0.98]` + `-translate-y-[1px]`

**Secondary button:** Zinc-800 background, Zinc-50 text, same shape
- Hover: Zinc-700

**Badge/pill:** `rounded-full`, `px-3 py-1`, `text-xs font-semibold`
- Tinted background (status color at 10% opacity), status color text

**Score gauge (SVG):** Restyle existing arc with Aurora gradient stroke. Keep speedometer concept.

**Signal bars:** Remove entirely — delete `SignalBars` component and all invocations in `page.tsx`. Tier is communicated via badge + icon only.

## 3. Animations & Interactions

### Scanner Zone Motion

**Radar sweep:** Keep existing CSS rotation animation. Restyle ring strokes with faint Aurora gradient.

**Progress bar:** Aurora gradient fill. Add shimmer sweep animation — a lighter highlight band traveling left-to-right across the bar continuously during scan.

**Scan button states:**
- Idle: Aurora gradient, slight `buttonBounce` animation
- Scanning: gradient shifts to animated shimmer, spinner icon
- Disabled: desaturated, `opacity-50`, `cursor-not-allowed`

**Input focus:** Aurora glow shadow (`0 0 0 3px rgba(37,99,235,0.3)`) replaces current mint border.

### Results Entry Motion

**Score card:** `opacity: 0 → 1`, `scale: 0.95 → 1`, `0.5s ease-out`

**Check items:** Staggered slide-in from left
- Each item: `translateX(-20px) → 0`, `opacity: 0 → 1`
- Delay: applied via inline `style={{ animationDelay: `${index * 80}ms` }}` in React (same approach as current code)
- Duration: `0.4s ease-out`

**Score gauge arc:** `1.5s cubic-bezier(0.4, 0, 0.2, 1)` fill animation (keep existing approach, restyle with Aurora gradient stroke).

**Tier badge:** `badgeReveal` — scale from 0.8 to 1.0 with slight rotation, `0.8s cubic-bezier(0.34, 1.56, 0.64, 1)`.

**Confetti (Beacon tier only — changed from current Clear+Beacon):** Aurora-spectrum colored particles: `#0ea5e9` (sky), `#2563eb` (blue), `#7c3aed` (violet), `#c026d3` (fuchsia). Keep existing fall physics.

### Micro-interactions

**Card hover:** `-translate-y-1`, shadow increase from diffusion to slightly more pronounced. Subtle, not neo-brutalist offset.

**Expand/collapse:** Smooth `max-height` transition with chevron 180-degree rotation. `0.3s ease-in-out`.

**Button press:** `scale-[0.98]` + `-translate-y-[1px]` for tactile feedback.

**Link hover:** Aurora gradient underline reveal (left-to-right).

### Performance Guardrails

- All animations exclusively on `transform` and `opacity`
- Background radar rings: `pointer-events-none`, fixed layer
- No `h-screen` — use `min-h-[100dvh]` where needed
- Confetti particles: removed from DOM after animation completes
- All animations respect `prefers-reduced-motion: reduce` — disable all non-essential motion
- No Framer Motion dependency — CSS animations only

## 4. Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `@phosphor-icons/react` |
| `src/app/layout.tsx` | Replace font imports (Inter/Space Grotesk/Space Mono → Geist/Geist Mono) |
| `src/app/globals.css` | Complete redesign of CSS custom properties, color palette, shadows, typography, animations |
| `src/app/page.tsx` | Replace emojis with Phosphor icons, update component markup for new design system, restructure hero layout |
| `src/app/checklist/page.tsx` | Replace emojis with Phosphor icons, update markup for premium aesthetic |
| `src/lib/scoring.ts` | Remove `emoji` values from tier definitions, update to use icon name strings |
| `src/lib/types.ts` | Replace `emoji: string` field in `Tier` interface with `icon: string` (Phosphor icon name) |

## 5. Dependencies

**Add:**
- `@phosphor-icons/react` (latest)
- `geist` (Vercel's official Geist font package for Next.js — provides `next/font` integration)

**Remove:**
- No packages removed (Inter/Space Grotesk loaded via Google Fonts `<link>` tag, removed from layout.tsx)

**Font loading strategy:**
- Use the `geist` npm package which provides `GeistSans` and `GeistMono` via `next/font/local` internally
- Install: `npm install geist`
- Usage in layout.tsx: `import { GeistSans, GeistMono } from 'geist/font'`
- Apply `GeistSans.className` to `<html>` element, expose `GeistMono.variable` as CSS variable

## 6. Out of Scope

- No Framer Motion or GSAP additions
- No new page routes
- No changes to scanning logic, API endpoints, or scoring algorithms
- No changes to TypeScript types or data structures (beyond `Tier.emoji` → `Tier.icon` rename)
- No dark/light mode toggle (scanner is always dark, results always light)
