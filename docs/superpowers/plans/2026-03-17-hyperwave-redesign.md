# Hyperwave Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign BotVisibility UI with Electric Aurora gradient identity, Geist fonts, Phosphor icons, and a hybrid neo-brutalist scanner / premium results aesthetic.

**Architecture:** Replace the current lavender/mint/brutalist design system in `globals.css` with Zinc neutrals + Aurora gradients. Swap Inter/Space fonts for Geist via npm package. Replace all emojis with Phosphor icons. Update markup in `page.tsx` and `checklist/page.tsx` to match new design tokens.

**Tech Stack:** Next.js 16, Tailwind CSS 4, `@phosphor-icons/react`, `geist` font package

**Spec:** `docs/superpowers/specs/2026-03-17-hyperwave-redesign-design.md`

---

## Chunk 1: Foundation (Dependencies, Fonts, Types, Color System)

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install phosphor icons and geist font**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npm install @phosphor-icons/react geist
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
ls node_modules/@phosphor-icons/react/dist/index.js && echo "phosphor OK"
ls node_modules/geist/dist/fonts/ && echo "geist OK"
```

Expected: Files listed, both print OK.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @phosphor-icons/react and geist font packages"
```

---

### Task 2: Update Type Definitions

**Files:**
- Modify: `src/lib/types.ts:34-40`

- [ ] **Step 1: Replace `emoji` field with `icon` in Tier interface**

In `src/lib/types.ts`, change the `Tier` interface:

```typescript
export interface Tier {
  name: 'Invisible' | 'Dim' | 'Visible' | 'Clear' | 'Beacon';
  icon: string;
  color: string;
  description: string;
  range: string;
}
```

The `icon` field stores the Phosphor icon component name (e.g., `'Ghost'`, `'SunDim'`, `'Broadcast'`).

- [ ] **Step 2: Verify no TypeScript errors in types.ts itself**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npx tsc --noEmit src/lib/types.ts 2>&1 | head -20
```

Expected: Errors will appear in OTHER files that reference `emoji` — that's expected and fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: replace Tier.emoji with Tier.icon for Phosphor icon names"
```

---

### Task 3: Update Scoring Definitions

**Files:**
- Modify: `src/lib/scoring.ts:5-51`

- [ ] **Step 1: Replace emoji values with icon names in getTier()**

Replace all 5 tier return objects in the `getTier` function:

```typescript
// Invisible
{
  name: 'Invisible',
  icon: 'Ghost',
  color: 'red',
  description: "Bots can't see you. You're invisible to AI agents and automated via brittle scrapers, if at all.",
  range: '0-20%'
}

// Dim
{
  name: 'Dim',
  icon: 'SunDim',
  color: 'orange',
  description: "Bots know you exist but can barely use you. Low visibility, lots of workarounds required.",
  range: '21-40%'
}

// Visible
{
  name: 'Visible',
  icon: 'Eye',
  color: 'yellow',
  description: "Bots can find you and handle basic tasks. Some blind spots and rough edges remain.",
  range: '41-62%'
}

// Clear
{
  name: 'Clear',
  icon: 'CheckCircle',
  color: 'green',
  description: "Bots see you clearly. You're ahead of most of the internet.",
  range: '63-80%'
}

// Beacon
{
  name: 'Beacon',
  icon: 'Broadcast',
  color: 'beacon',
  description: "Maximum bot visibility. Agents find you, understand you, and prefer you.",
  range: '81-100%'
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npx tsc --noEmit src/lib/scoring.ts 2>&1 | head -20
```

Expected: Should compile clean (types.ts + scoring.ts now agree on `icon`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring.ts
git commit -m "feat: update tier definitions with Phosphor icon names"
```

---

### Task 4: Replace Font Loading in Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace Google Fonts link with Geist imports**

Replace the entire `layout.tsx` content with:

```tsx
import type { Metadata } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "BotVisibility | How visible is your product to AI agents?",
  description:
    "Scan any URL and get your BotVisibility score in seconds. We check for llms.txt, agent-card.json, OpenAPI specs, CORS headers, and more.",
  openGraph: {
    title: "BotVisibility",
    description: "How visible is your product to AI agents? Scan any URL and find out.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BotVisibility",
    description: "How visible is your product to AI agents? Scan any URL and find out.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GMCLP028CY"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GMCLP028CY');
          `}
        </Script>
      </head>
      <body className={`${GeistSans.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

Key changes:
- Removed Google Fonts `<link>` for Inter/Space Grotesk/Space Mono
- Added `GeistSans` and `GeistMono` imports from `geist/font`
- Applied `GeistSans.className` to `<body>` for default font
- Applied CSS variables via `GeistSans.variable` and `GeistMono.variable` on `<html>`

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: replace Google Fonts with Geist font package"
```

---

### Task 5: Rewrite CSS Design System (globals.css)

**Files:**
- Modify: `src/app/globals.css` (complete rewrite of `:root` variables and core styles)

This is the largest single task. Replace the entire `globals.css` with the new Hyperwave design system. The file is ~1093 lines, and most CSS custom properties, colors, shadows, and animations need updating.

- [ ] **Step 1: Replace `:root` CSS variables**

Replace the existing `:root` block (lines 8-100+) with the new Hyperwave tokens:

```css
:root {
  /* Background — Zinc scale */
  --color-bg-deep: #09090b;
  --color-bg-primary: #fafafa;
  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #f4f4f5;
  --color-bg-elevated: #ffffff;

  /* Scanner zone (dark) */
  --scanner-bg: #09090b;
  --scanner-surface: #18181b;
  --scanner-border: #27272a;

  /* Tier colors */
  --tier-invisible: #ef4444;
  --tier-dim: #f59e0b;
  --tier-visible: #eab308;
  --tier-clear: #22c55e;
  --tier-beacon: #2563eb;
  --tier-beacon-start: #0ea5e9;
  --tier-beacon-mid1: #2563eb;
  --tier-beacon-mid2: #7c3aed;
  --tier-beacon-end: #c026d3;

  /* Aurora gradient */
  --aurora-gradient: linear-gradient(135deg, #0ea5e9, #2563eb, #7c3aed, #c026d3);
  --aurora-glow: 0 0 30px rgba(37,99,235,0.15), 0 0 60px rgba(124,58,237,0.08);
  --aurora-blue: #2563eb;

  /* Text — Zinc */
  --text-primary: #09090b;
  --text-secondary: #52525b;
  --text-tertiary: #71717a;
  --text-inverse: #fafafa;

  /* Status */
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;

  /* Borders */
  --border-subtle: #e4e4e7;
  --border-default: #e4e4e7;
  --border-dark: #27272a;
  --border-width: 3px;

  /* Semantic aliases */
  --bg-primary: var(--color-bg-primary);
  --bg-secondary: var(--color-bg-secondary);
  --bg-tertiary: var(--color-bg-tertiary);
  --border-primary: var(--border-dark);
  --accent-primary: var(--aurora-blue);
  --color-accent: var(--aurora-blue);

  /* Neo-brutalist shadow (scanner zone only) */
  --shadow-brutal: 5px 5px 0px #2563eb;
  --shadow-brutal-sm: 3px 3px 0px #2563eb;
  --shadow-brutal-hover: 7px 7px 0px #2563eb;

  /* Premium shadow (results zone) */
  --shadow-diffusion: 0 20px 40px -15px rgba(0,0,0,0.05);
  --shadow-card: 0 1px 3px rgba(0,0,0,0.04);
  --shadow-card-hover: 0 8px 25px -5px rgba(0,0,0,0.08);

  /* Typography */
  --font-sans: var(--font-geist-sans), system-ui, -apple-system, sans-serif;
  --font-mono: var(--font-geist-mono), 'JetBrains Mono', monospace;
  --font-display: var(--font-geist-sans), system-ui, -apple-system, sans-serif;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-premium: 2.5rem;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-base: 200ms ease-out;
  --transition-slow: 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

- [ ] **Step 2: Update body, typography, and base styles**

Update the body and base element styles to use new tokens. Key changes:
- `body` background: `var(--scanner-bg)` (dark by default, scanner zone)
- Font family: `var(--font-sans)`
- All `font-family: "Inter"` or `"Space Grotesk"` references replaced with `var(--font-sans)`
- All `font-family: "Space Mono"` references replaced with `var(--font-mono)`

- [ ] **Step 3: Update card, button, and component styles**

Replace card styles:
- Cards in scanner zone: keep `border: var(--border-width) solid var(--border-dark)`, `box-shadow: var(--shadow-brutal)`
- Cards in results zone: `border: 1px solid var(--border-subtle)`, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-card)`
- Card hover (results): `transform: translateY(-2px)`, `box-shadow: var(--shadow-card-hover)`

Replace button styles:
- `.scan-button`: `background: var(--aurora-gradient)`, white text, `border-left: 3px solid #1d4ed8`
- Primary buttons: `background: var(--aurora-gradient)`
- Active state: `transform: scale(0.98) translateY(-1px)`

Replace input styles:
- `.command-center`: `background: var(--scanner-surface)`, `border: 3px solid var(--scanner-border)`
- `.command-center` shadow idle: `var(--shadow-brutal)`
- `.command-center:focus-within`: add `box-shadow: 0 0 0 3px rgba(37,99,235,0.3), 5px 5px 0 #2563eb`

- [ ] **Step 4: Update all color references throughout globals.css**

Search and replace patterns:
- `#DED6EC` / lavender backgrounds → `#09090b` (scanner) or `#fafafa` (results)
- `#4ADE80` / mint accent → `var(--aurora-blue)` or `var(--aurora-gradient)`
- `#7C6DC7` / purple → remove (use Aurora gradient where brand color needed)
- `#F472B6` / pink → remove
- `#1a1a1a` borders → `var(--border-dark)` (scanner) or `var(--border-subtle)` (results)
- `#FACC15` visible tier → `#eab308`

- [ ] **Step 5: Update animation keyframes**

Update these animations:
- `@keyframes radarSweep`: keep rotation, change stroke colors to Aurora blue
- `@keyframes blipPulse`: change color to Aurora blue
- `@keyframes scanLine`: change color to Aurora blue glow
- `@keyframes confettiFall`: keep physics, colors handled in JS
- Progress bar: add shimmer sweep keyframe:

```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-fill {
  background: var(--aurora-gradient);
  position: relative;
  overflow: hidden;
}

.progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 1.5s infinite;
}
```

- [ ] **Step 6: Add results zone container styles**

Add a new `.results-zone` class:

```css
.results-zone {
  background: var(--color-bg-primary);
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  padding: 2rem 0;
  margin-top: 2rem;
}
```

Add `.score-card` premium styles:

```css
.score-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-premium);
  box-shadow: var(--shadow-diffusion);
  padding: 2rem 2.5rem;
}

@media (min-width: 768px) {
  .score-card {
    padding: 2.5rem 3rem;
  }
}
```

- [ ] **Step 7: Add prefers-reduced-motion and secondary button styles**

Add at the end of globals.css:

```css
/* Secondary button */
.btn-secondary {
  background: #27272a;
  color: #fafafa;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-lg);
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.btn-secondary:hover {
  background: #3f3f46;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 8: Verify CSS parses without errors**

Note: `npm run build` will fail at this point because `page.tsx` still references `tier.emoji` (fixed in Task 6). Instead, verify CSS only:

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npx tailwindcss --input src/app/globals.css --output /dev/null 2>&1 | head -10
```

Expected: No CSS parse errors. TypeScript errors are expected until Task 6.

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: rewrite design system with Hyperwave Aurora tokens"
```

---

## Chunk 2: Page Components (page.tsx + checklist)

### Task 6: Rewrite Main Page Components

**Files:**
- Modify: `src/app/page.tsx`

This is the largest component file (874 lines). Changes touch every component.

- [ ] **Step 1: Add Phosphor icon imports at top of file**

Add after the existing React imports:

```tsx
import {
  Ghost,
  SunDim,
  Eye,
  CheckCircle,
  XCircle,
  Warning,
  Question,
  Broadcast,
  MagnifyingGlass,
  CaretDown,
  ArrowLeft,
} from "@phosphor-icons/react";
```

- [ ] **Step 2: Create tier icon mapping helper**

Add after imports:

```tsx
const TIER_ICONS: Record<string, React.ComponentType<{ size?: number; weight?: string; className?: string }>> = {
  Ghost,
  SunDim,
  Eye,
  CheckCircle,
  Broadcast,
};

const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number; weight?: string; className?: string }>> = {
  pass: CheckCircle,
  fail: XCircle,
  partial: Warning,
  unknown: Question,
};
```

- [ ] **Step 3: Update RadarIcon SVG colors**

In the `RadarIcon` component (lines 26-51), make these exact replacements:
- Line 29: `stroke="#1a1a1a"` → `stroke="rgba(37,99,235,0.3)"`
- Line 30: `stroke="#1a1a1a"` → `stroke="rgba(37,99,235,0.2)"`
- Line 31: `stroke="#1a1a1a"` → `stroke="rgba(37,99,235,0.15)"`
- Line 32: `stroke="#1a1a1a"` → `stroke="rgba(37,99,235,0.1)"`
- Line 33: `stroke="#1a1a1a"` → `stroke="rgba(37,99,235,0.1)"`
- Line 36: `fill="#7C6DC7"` → `fill="rgba(37,99,235,0.5)"`
- Line 48: `fill="#1a1a1a"` → `fill="#fafafa"`

- [ ] **Step 4: Update AnimatedBackground for dark scanner zone**

In the `AnimatedBackground` component, the CSS classes `hero-background`, `grid-pattern`, and `scan-line` are styled in `globals.css`. The CSS rewrite in Task 5 handles their color changes. No markup changes needed here — verify the CSS classes reference the new scanner-zone variables:
- `.hero-background`: `background: var(--scanner-bg)`
- `.grid-pattern`: border color should use `rgba(37,99,235,0.05)` instead of current color
- `.scan-line`: background should use `rgba(37,99,235,0.3)` instead of current color

- [ ] **Step 5: Update TierBadge to use Phosphor icons**

Replace the entire `TierBadge` component:

```tsx
function TierBadge({ tier }: { tier: Tier }) {
  const TierIcon = TIER_ICONS[tier.icon];
  const badgeClass = `tier-badge-${tier.name.toLowerCase()}`;

  return (
    <div className={`tier-badge-large ${badgeClass}`}>
      {TierIcon && <TierIcon size={40} weight="bold" />}
      <span>{tier.name}</span>
    </div>
  );
}
```

- [ ] **Step 6: Remove SignalBars and GhostIcon components**

Delete the entire `SignalBars` component (lines 198-231) and `GhostIcon` component (lines 237-253). Remove the `<SignalBars>` invocation in the score card section (around line 572).

- [ ] **Step 7: Update CheckResultCard to use Phosphor status icons**

Replace the text-based status icons with Phosphor components:

```tsx
function CheckResultCard({ result, index }: { result: CheckResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const StatusIcon = STATUS_ICONS[result.status];

  return (
    <div
      className="check-item animate-slide-in"
      style={{ animationDelay: `${index * 80}ms` }}
      role="listitem"
      aria-expanded={expanded}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-controls={contentId}
        style={{ all: "unset", display: "flex", alignItems: "flex-start", gap: "1rem", width: "100%", cursor: "pointer" }}
      >
        <div className={`check-status-indicator check-status-${result.status}`}>
          {StatusIcon && <StatusIcon size={18} weight="bold" />}
        </div>
        {/* ... rest of card content unchanged ... */}
      </button>
    </div>
  );
}
```

Change `animationDelay` from `index * 50` to `index * 80` per spec.

- [ ] **Step 8: Update Confetti colors to Aurora spectrum**

In the `Confetti` component, replace the colors array:

```tsx
const colors = [
  "#0ea5e9",  // sky
  "#2563eb",  // blue
  "#7c3aed",  // violet
  "#c026d3",  // fuchsia
];
```

Update the confetti trigger condition — change from `Clear || Beacon` to `Beacon` only:

```tsx
// In the complete event handler:
if (data.tier.name === "Beacon") {
  setShowConfetti(true);
}
```

- [ ] **Step 9: Update hero section markup**

Replace the `<header>` block (lines 442-462) with:

```tsx
<header className="mb-12 md:mb-16" style={{ position: "relative" }}>
  {/* Asymmetric radar rings — right-shifted decorations */}
  <div style={{ position: "absolute", top: "-40px", right: "-60px", width: 300, height: 300, border: "1px solid rgba(37,99,235,0.1)", borderRadius: "50%", pointerEvents: "none" }} aria-hidden="true" />
  <div style={{ position: "absolute", top: "-10px", right: "-30px", width: 240, height: 240, border: "1px solid rgba(37,99,235,0.07)", borderRadius: "50%", pointerEvents: "none" }} aria-hidden="true" />
  <div style={{ position: "absolute", top: "20px", right: "0px", width: 180, height: 180, border: "1px solid rgba(37,99,235,0.04)", borderRadius: "50%", pointerEvents: "none" }} aria-hidden="true" />

  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#2563eb", marginBottom: "0.75rem" }}>
    AI Agent Readiness Scanner
  </p>
  <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, color: "var(--text-inverse)" }}>
    BotVisibility
  </h1>
  <p style={{ fontSize: "1.125rem", color: "var(--text-tertiary)", marginTop: "0.5rem" }}>
    How visible is your site to AI agents?
  </p>

  {scanState === "idle" && (
    <div className="banner" style={{ marginTop: "1.5rem", background: "var(--aurora-gradient)", border: "none", boxShadow: "var(--aurora-glow)" }}>
      <div className="banner-title" style={{ color: "#fff" }}>Free AI visibility audit</div>
      <div className="banner-subtitle" style={{ color: "rgba(255,255,255,0.8)" }}>
        Check your site against 9 automated tests in seconds
      </div>
    </div>
  )}
</header>
```

- [ ] **Step 10: Update ScoreGauge SVG with Aurora gradient stroke**

In the `ScoreGauge` component, add an SVG `<defs>` block for the Aurora gradient and use it as the stroke:

```tsx
// Inside the <svg> element, before the background track path:
<defs>
  <linearGradient id="aurora-gauge" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stopColor="#0ea5e9" />
    <stop offset="33%" stopColor="#2563eb" />
    <stop offset="66%" stopColor="#7c3aed" />
    <stop offset="100%" stopColor="#c026d3" />
  </linearGradient>
</defs>
```

Then update the filled arc path: replace `stroke: tierColor` with `stroke: "url(#aurora-gauge)"` in the style prop (line 157).

- [ ] **Step 11: Update score card markup for premium results zone**

Wrap the results section (line 561-617) in a `.results-zone` container:

```tsx
<div className="results-zone">
  {/* existing score card + check results + manual checks */}
</div>
```

In the score card, remove `<SignalBars>` invocation (line 572-573). Add Aurora gradient text fill to the gauge score:

```tsx
<span className="gauge-score" style={{
  background: "linear-gradient(135deg, #0ea5e9, #2563eb, #7c3aed, #c026d3)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
}}>
```

- [ ] **Step 12: Update ManualChecksSection**

In `ManualChecksSection` (lines 780-873):
- Replace `☐` emoji (line 855) with an inline SVG checkbox square:

```tsx
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
  <rect x="1" y="1" width="14" height="14" rx="2" />
</svg>
```

- Update the level group headers to include a Phosphor-style level icon. Since this is within a `"use client"` component tree (Home is client), we can use Phosphor. Add level icons:

```tsx
const LEVEL_ICONS: Record<number, React.ComponentType<{ size?: number; weight?: string }>> = {
  1: Eye,
  2: MagnifyingGlass,
  3: Broadcast,
  4: CheckCircle,
};
```

Use in the level header: `{LevelIcon && <LevelIcon size={16} weight="bold" />}` before the level name text.

- [ ] **Step 13: Update error state styling**

Replace the error box inline styles (lines 517-527):

```tsx
style={{
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991B1B",
  borderRadius: "12px",
  fontWeight: 600,
}}
```

Remove `boxShadow: "var(--shadow-brutal-sm)"`.

- [ ] **Step 14: Update footer and share buttons**

Update footer button styles:
- "Scan Another URL" button: `background: "var(--aurora-gradient)"`, `color: "#fff"`, `borderRadius: "12px"`, `border: "none"`, `boxShadow: "var(--aurora-glow)"`
- Share buttons: `background: "#27272a"`, `color: "#fafafa"`, `borderRadius: "12px"`, `border: "none"`
- Footer links: `color: "var(--text-tertiary)"`, hover color: `"var(--aurora-blue)"`

- [ ] **Step 15: Verify page compiles**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npx tsc --noEmit 2>&1 | head -30
```

Expected: No TypeScript errors.

- [ ] **Step 16: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign main page with Hyperwave Aurora UI"
```

---

### Task 7: Rewrite Checklist Page

**Files:**
- Modify: `src/app/checklist/page.tsx`

- [ ] **Step 1: Update LEVEL_META colors**

Replace the `LEVEL_META` color values. Remove the purple (`#7C6DC7`, `#8B5CF6`) and use the new palette:

```typescript
const LEVEL_META: Record<number, { name: string; color: string; description: string }> = {
  1: {
    name: "Discoverable",
    color: "#2563eb",  // Aurora blue
    description: "Can bots find you? These items make your product visible to AI crawlers and agent frameworks.",
  },
  2: {
    name: "Usable",
    color: "#f59e0b",  // Amber
    description: "Can bots use you? These items let agents authenticate, call your API, and handle errors.",
  },
  3: {
    name: "Optimized",
    color: "#22c55e",  // Green
    description: "Can bots use you efficiently? These items reduce token cost, latency, and wasted calls.",
  },
  4: {
    name: "Agent-Native",
    color: "#7c3aed",  // Aurora violet
    description: "Were you built for bots? These items make your product a first-class citizen in agent workflows.",
  },
};
```

- [ ] **Step 2: Update page styling for premium aesthetic**

Update inline styles throughout:
- Background: light (`#fafafa`)
- Card styles: `border: 1px solid #e4e4e7`, `borderRadius: '12px'`, `boxShadow: '0 1px 3px rgba(0,0,0,0.04)'`
- Remove `3px solid var(--border-primary)` brutalist borders
- Remove `var(--shadow-brutal)` shadows
- CTA section: Aurora gradient button instead of black button

- [ ] **Step 3: Update back link and CTA styling**

Back link: use `ArrowLeft` Phosphor icon (already imported in page.tsx, but checklist is a Server Component — use SVG directly or make a small client wrapper).

Note: `checklist/page.tsx` is a **Server Component** (no `"use client"`). Phosphor icons are client-side React components. Options:
- Use inline SVGs for the few icons needed (back arrow, search icon)
- Keep Phosphor for the main page only since checklist uses minimal icons

Use inline SVGs for the 2-3 icons on the checklist page.

CTA button: `background: linear-gradient(135deg, #0ea5e9, #2563eb, #7c3aed, #c026d3)`, white text, `borderRadius: '12px'`, remove brutalist shadow.

- [ ] **Step 4: Verify build**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/checklist/page.tsx
git commit -m "feat: redesign checklist page with premium Hyperwave aesthetic"
```

---

## Chunk 3: Polish & Verification

### Task 8: Visual QA and Build Verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Run lint**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npm run lint
```

Expected: No errors (warnings acceptable).

- [ ] **Step 3: Run tests**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npm test 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 4: Audit for h-screen usage**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
grep -rn 'h-screen' src/ --include='*.tsx' --include='*.css'
```

Expected: No matches. If found, replace with `min-h-[100dvh]`.

- [ ] **Step 5: Start dev server and visually verify**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
npm run dev
```

Check in browser at `http://localhost:3000`:
- [ ] Scanner zone: dark Zinc-950 background, Aurora gradient scan button, off-center radar rings
- [ ] Input: 3px border with blue offset shadow, Aurora glow on focus
- [ ] Results zone: light background, rounded premium score card, diffusion shadows
- [ ] Tier badge: Phosphor icon (no emoji), pill shape with tinted background
- [ ] Check items: left color-bar, Phosphor status icons, staggered slide-in
- [ ] No emojis visible anywhere in the UI
- [ ] Geist font rendering (check with browser dev tools)
- [ ] Checklist page (`/checklist`): premium light aesthetic, Aurora gradient CTA
- [ ] Mobile responsive: no horizontal scroll, single column collapse

- [ ] **Step 6: Verify no emojis remain**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
grep -r '🔴\|🟠\|🟡\|🟢\|🚀\|☐\|✓\|✕\|◐' src/ --include='*.tsx' --include='*.ts'
```

Expected: No matches (all emojis replaced).

- [ ] **Step 7: Verify no Inter font references remain**

```bash
cd /Users/joeyjanisheck/Documents/GitHub/botvisibility
grep -ri 'inter\|space.grotesk\|space.mono' src/ --include='*.tsx' --include='*.ts' --include='*.css'
```

Expected: No matches.

- [ ] **Step 8: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: polish Hyperwave redesign after visual QA"
```

- [ ] **Step 9: Summary commit (if all clean)**

If no fixes were needed, skip this step. The implementation is complete.
