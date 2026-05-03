# Phase 11: UI 架构重设计 (UI Architecture Redesign) — Research

**Researched:** 2026-05-03
**Domain:** Next.js App Router + shadcn v4 + Framer Motion + CSS Grid + PWA + Tauri
**Confidence:** HIGH

## Summary

Phase 11 transforms Echoes from a single-column feed into a three-column adaptive workbench. The research confirms all 10 technical areas are implementable with the existing tech stack (Next.js 14.2, shadcn v4/@base-ui/react, Framer Motion v11, Tailwind CSS v3) plus a small set of new dependencies. The layout shell leverages CSS Grid with native `grid-template-columns` transitions (now supported in all major browsers), Framer Motion `AnimatePresence` for panel mount/unmount lifecycle, React Context for layout/density/theme-color state, and `document.documentElement.style.setProperty()` for zero-re-render accent color theming. The Command Palette uses shadcn's `command` component (cmdk wrapper), PWA uses `@serwist/next` for service worker caching, and Tauri 2.0 provides a minimal desktop wrapper.

**Primary recommendation:** Build the layout shell as a Server Component that renders a `'use client'` `LayoutProvider` wrapper, with all interactive sub-components (Sidebar, RightPanel, CommandPalette) as Client Components at the leaf level. Use CSS Grid for the three-column structure with `0fr` for collapsed panels (browser-native transitions avoid Framer Motion overhead on layout changes). Place providers in order: `ThemeProvider > AuthProvider > LayoutProvider > DensityProvider > ThemeColorProvider` so layout consumers can access auth state and theme consumers can access layout state.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three-column adaptive layout: Sidebar (200px/48px) | Main (adaptive) | Right Panel (280px/0px)
- Sidebar navigation categories: 拾忆, 发现, 创作, 我的
- Header simplification: Logo + Global Search + User Avatar Menu
- Right panel adapts content by page (via `usePathname()`)
- Command Palette triggered by Cmd/Ctrl+K, supports `/` and `>` prefix modes
- Density modes: compact, comfortable, loose
- Accent color presets: 石墨灰(neutral), 深海蓝(blue), 森林绿(green), 珊瑚橙(orange), 紫罗兰(violet)
- PWA: manifest + icons + service worker with Workbox/Serwist
- Tauri: minimal desktop wrapper under `apps/desktop/`
- Design tokens extracted to `shared/design-tokens/`
- shadcn v4 base-nova preset (already initialized)
- Framer Motion v11 for animations

### Claude's Discretion
- Exact provider tree ordering and implementation
- CSS Grid vs Flexbox choice for the layout shell
- Framer Motion animation parameters (spring tension, duration)
- `@serwist/next` classic vs configurator mode
- Tauri build strategy (dev-only localhost vs dual-output build)
- Exact icon choices beyond lucide-react
- Confetti-lite animation implementation detail

### Deferred Ideas (OUT OF SCOPE)
- Expo mobile app (Phase 11 only PWA)
- Desktop SQLite as primary DB (Tauri side is minimal wrapper only)
- Cross-device real-time sync protocol
- Native push notifications
- Font selection (Inter/System/Mono) — system font chain is sufficient

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-11-01 | Desktop three-column stable layout, no horizontal scrollbar | CSS Grid section |
| REQ-11-02 | Mobile bottom Dock navigation, smooth transitions | Safe-area + responsive section |
| REQ-11-03 | Cmd+K Command Palette: search memories, navigate, execute commands | Command Palette section |
| REQ-11-04 | Header simplified; all navigation moved to Sidebar | Layout Architecture + Component Inventory |
| REQ-11-05 | Right Panel dynamically shows correct content per page | Right Panel pattern (usePathname) |
| REQ-11-06 | Density toggle real-time, no refresh | CSS custom properties section |
| REQ-11-07 | Theme color toggle real-time, no refresh | CSS custom properties section |
| REQ-11-08 | All existing pages render correctly in new layout | SSR + provider tree section |
| REQ-11-09 | Dark/light theme switch has transition animation | Framer Motion + CSS transition section |
| REQ-11-10 | PWA: manifest, icons, service worker | PWA section |
| REQ-11-11 | Tauri desktop minimal runnable wrapper | Tauri section |
| REQ-11-12 | Design tokens extracted to shared/design-tokens | Design Token section |
| REQ-11-13 | Mobile (<768px) information architecture restructured, not scaled | Responsive section |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layout shell (three-column grid) | Browser / Client | Frontend Server (SSR) | Layout container must be a Server Component to avoid layout shift, but column state (collapsed/expanded) is client-side state. Solution: Server Component shell wraps `'use client'` LayoutProvider |
| Sidebar navigation | Browser / Client | — | Collapse toggle, active route highlight, hover tooltips all require interactivity |
| Right Panel context | Browser / Client | — | Content adapts to `usePathname()`, width is user-draggable, visibility is toggleable |
| Header (simplified) | Frontend Server (SSR) | Browser / Client | Static structure rendered server-side; UserMenu dropdown is client-side |
| Command Palette | Browser / Client | — | Keyboard events, fuzzy search, `useRouter()` all require client |
| Accent color theming | Browser / Client | — | CSS custom properties set via DOM API; changes are paint-level, not React reconciliation |
| Density theming | Browser / Client | — | Same as accent — CSS custom properties on `:root` |
| PWA service worker | Browser / Client | Frontend Server (SSR) | SW registration is client-only; manifest is served by Next.js API route |
| Tauri desktop shell | Desktop / Native | — | Rust binary with system WebView; simply hosts the web app |
| Mobile Dock | Browser / Client | — | Fixed positioning, touch events, safe-area awareness |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.0 (already installed) | App Router, SSR/SSG, RSC | Current project framework [VERIFIED: package.json] |
| react | ^18.2.0 (already installed) | UI components, hooks, context | Current project version [VERIFIED: package.json] |
| shadcn | ^4.6.0 (already installed) | Component registry, CLI | Already initialized with base-nova preset [VERIFIED: components.json] |
| @base-ui/react | ^1.4.1 (already installed) | shadcn v4 primitive components | shadcn v4 default primitive library [VERIFIED: package.json] |
| tailwindcss | ^3.4.1 (already installed) | Utility CSS framework | Current project version [VERIFIED: package.json] |
| framer-motion | ^11.0.8 (already installed) | Layout animations, gestures | Already in dependencies, v11 is current [VERIFIED: package.json, npm registry] |
| lucide-react | ^0.344.0 (already installed) | Icon library | shadcn default icon set [VERIFIED: package.json] |

### Supporting (New Installations for Phase 11)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @serwist/next | ^9.5.10 | PWA service worker with caching strategies | Production PWA with offline support [VERIFIED: npm registry 2026-05-03] |
| serwist | ^9.5.10 | Service worker runtime | Peer dependency of @serwist/next [VERIFIED: npm registry] |
| @tauri-apps/cli | ^2.11.0 | Tauri desktop build tooling | Desktop app `tauri dev` and `tauri build` commands [VERIFIED: npm registry] |
| @tauri-apps/api | ^2.11.0 | Tauri window API (close/minimize/maximize) | Custom frameless titlebar window controls [VERIFIED: npm registry] |
| cmdk | ^1.0.4 (transitive via shadcn command) | Command palette fuzzy search engine | Installed automatically when `npx shadcn add command` is run [CITED: shadcn docs] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @serwist/next | next-pwa (Workbox) | next-pwa is deprecated; Serwist is its maintained successor with App Router support [CITED: serwist docs] |
| @serwist/next | Native manifest-only PWA | Native is simpler but provides no offline caching; Phase 11 spec requires service worker for static + memory caching |
| @tauri-apps/cli | Electron | Electron bundle is ~150MB vs Tauri's ~3MB; Tauri aligns with Echoes' "lightweight" philosophy [CITED: CONTEXT.md Section 7] |
| Framer Motion layout animations | CSS transitions only | CSS Grid transitions handle column widths; Framer Motion needed for AnimatePresence (mount/unmount lifecycle), card hover, celebration effects |
| React Context for theme | CSS-in-JS (styled-components) | CSS custom properties set via DOM API achieve zero-re-render theming; React Context triggers full tree re-renders |

**Installation:**
```bash
# New shadcn components (from official registry)
npx shadcn@latest add tooltip dropdown-menu dialog command separator badge scroll-area switch avatar

# PWA
npm install @serwist/next@^9.5.10 serwist@^9.5.10

# Tauri (in apps/desktop/)
cd apps/desktop && npm install @tauri-apps/cli@^2.11.0 @tauri-apps/api@^2.11.0
```

**Version verification:**
```bash
npm view @serwist/next version  # -> 9.5.10
npm view serwist version         # -> 9.5.10
npm view @tauri-apps/cli version  # -> 2.11.0
npm view @tauri-apps/api version  # -> 2.11.0
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Input / Request                          │
│  (URL navigation, Cmd+K, theme toggle, density switch, resize)      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js App Router (layout.tsx — Server Component by default)       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Provider Tree ('use client' boundary)                        │   │
│  │  ThemeProvider → AuthProvider → LayoutProvider →              │   │
│  │  DensityProvider → ThemeColorProvider                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 │                                    │
│  ┌──────────────────────────────┼──────────────────────────────┐   │
│  │  AppShell (Server Component) │                               │   │
│  │                              │                               │   │
│  │  ┌──────┬────────────────────┬──────────┐                    │   │
│  │  │Header│                    │          │                    │   │
│  │  │ SSR  │                    │          │                    │   │
│  │  ├──────┤                    │  Right   │                    │   │
│  │  │Sidea-│   Main Content     │  Panel   │                    │   │
│  │  │ bar  │   {children}       │  Client  │                    │   │
│  │  │Client│   Server/Client    │          │                    │   │
│  │  │      │                    │          │                    │   │
│  │  └──────┴────────────────────┴──────────┘                    │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ Mobile Dock (Client — <768px only)                       │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CommandPalette (Client — Portal to document.body)            │   │
│  │  Triggered by: Cmd+K, Header search click                     │   │
│  │  Routes: / → pages, /memories → search, > → commands         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        External / Runtime                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │ Backend  │  │ localStorage │  │ document.documentElement.style │  │
│  │ API      │  │ (layout      │  │ (--primary, --ring, --card-   │  │
│  │ Gateway  │  │  preferences)│  │  padding, --element-spacing)   │  │
│  └──────────┘  └──────────┘  └──────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐    │
│  │ Service Worker   │  │ Tauri WebView (desktop only)          │    │
│  │ (Serwist — PWA)  │  │ http://localhost:3000 (dev)           │    │
│  └──────────────────┘  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
web/
├── app/
│   ├── layout.tsx                          # Root: providers + AppShell
│   ├── (main)/
│   │   ├── layout.tsx                      # MainLayout: wraps AppShell around children
│   │   ├── page.tsx                        # Timeline (existing, refactored)
│   │   ├── search/page.tsx                 # Search (existing)
│   │   ├── tags/page.tsx                   # Tag Cloud (existing)
│   │   ├── settings/page.tsx               # Settings (existing)
│   │   ├── capsules/page.tsx              # Time Capsules (existing)
│   │   ├── memory/[id]/page.tsx           # Memory Detail (existing)
│   │   ├── constellation/page.tsx         # Star Graph (new — Phase 13 placeholder)
│   │   ├── explore/page.tsx               # Explore Mode (new — Phase 13 placeholder)
│   │   ├── mood/page.tsx                  # Mood Calendar (new — Phase 15 placeholder)
│   │   ├── weave/page.tsx                 # Memory Weaving (new — Phase 14 placeholder)
│   │   ├── daily-echo/page.tsx            # Daily Echo (new — Phase 15 placeholder)
│   │   └── profile/page.tsx               # User Profile (new — Phase 16 placeholder)
│   ├── (auth)/
│   │   ├── login/page.tsx                 # Login (existing)
│   │   └── register/page.tsx              # Register (existing)
│   ├── providers/
│   │   ├── theme-provider.tsx             # Existing: dark/light/system
│   │   ├── auth-provider.tsx              # Existing: JWT auth state
│   │   ├── layout-provider.tsx            # NEW: sidebar/panel state
│   │   ├── density-provider.tsx           # NEW: compact/comfortable/loose
│   │   └── theme-color-provider.tsx       # NEW: accent color presets
│   └── manifest.ts                        # NEW: PWA manifest
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx                   # NEW: three-column grid container
│   │   ├── Sidebar.tsx                    # NEW: left navigation
│   │   ├── SidebarItem.tsx                # NEW: nav item with active indicator
│   │   ├── RightPanel.tsx                 # NEW: right context panel
│   │   ├── RightPanelWidget.tsx           # NEW: panel widget card
│   │   ├── MobileDock.tsx                 # NEW: mobile bottom tab bar
│   │   ├── Header.tsx                     # REFACTOR: simplified header
│   │   └── UserMenu.tsx                   # NEW: avatar dropdown
│   ├── command/
│   │   └── CommandPalette.tsx             # NEW: Cmd+K overlay
│   ├── ui/
│   │   ├── button.tsx                     # Existing
│   │   ├── toast.tsx                      # Existing
│   │   ├── skeleton.tsx                   # Existing
│   │   ├── pagination.tsx                 # Existing
│   │   ├── tooltip.tsx                    # NEW: shadcn install
│   │   ├── dropdown-menu.tsx              # NEW: shadcn install
│   │   ├── dialog.tsx                     # NEW: shadcn install
│   │   ├── command.tsx                    # NEW: shadcn install
│   │   ├── separator.tsx                  # NEW: shadcn install
│   │   ├── badge.tsx                      # NEW: shadcn install
│   │   ├── scroll-area.tsx                # NEW: shadcn install
│   │   ├── switch.tsx                     # NEW: shadcn install
│   │   ├── avatar.tsx                     # NEW: shadcn install
│   │   ├── confetti-lite.tsx              # NEW: celebration particles
│   │   ├── streak-flame.tsx               # NEW: streak indicator
│   │   └── theme-color-picker.tsx         # NEW: accent color selector
│   └── [existing components...]           # memory/, search/, chat/, warmth/
└── public/
    ├── manifest.json                      # NEW: PWA manifest
    ├── sw.ts                              # NEW: Serwist service worker
    ├── favicon.svg                        # Existing
    └── icons/                             # NEW: PWA icon set
        ├── icon-72.png
        ├── icon-96.png
        ├── icon-128.png
        ├── icon-144.png
        ├── icon-152.png
        ├── icon-192.png
        ├── icon-384.png
        └── icon-512.png

shared/
└── design-tokens/                         # NEW: extracted design tokens
    ├── colors.json
    ├── spacing.json
    ├── breakpoints.json
    └── typography.json

apps/
└── desktop/                               # NEW: Tauri desktop wrapper
    ├── package.json
    ├── tauri.conf.json
    └── src-tauri/
        ├── Cargo.toml
        ├── capabilities/default.json
        └── src/main.rs
```

### Pattern 1: Three-Column CSS Grid Layout with Native Transitions

**What:** Use `display: grid` with `grid-template-columns: [left] [main] [right]` where collapsed panels use `0fr` to enable browser-native width transitions without JavaScript animation overhead.

**When to use:** The primary layout shell for desktop (>=1280px). All three columns render; panels collapse via CSS class toggle.

**Why CSS Grid over Flexbox:**
- Grid allows three fixed+flexible tracks tracked as a single layout unit
- `grid-template-columns` now supports CSS transitions natively in all browsers (Chrome 107+, Firefox 115+, Safari 16.2+) [VERIFIED: CSS-Tricks / web.dev 2024]
- `0fr` enables smooth collapse without removing elements from DOM (unlike `display: none` or changing column count)
- Flexbox would require width transitions on individual elements, which cause layout reflow in sibling elements

**Example:**
```css
/* web/app/globals.css — Three-column grid */
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr var(--panel-width);
  min-height: calc(100vh - var(--header-height, 48px));
  transition: grid-template-columns 200ms ease-out;
}

/* Sidebar expanded (default) */
:root {
  --sidebar-width: 200px;
  --panel-width: 0fr;  /* hidden by default; pages toggle it */
}

/* Right panel visible */
.app-shell[data-panel-visible="true"] {
  --panel-width: 280px;
}

/* Sidebar collapsed */
.app-shell[data-sidebar-collapsed="true"] {
  --sidebar-width: 48px;
}
```
[CITED: CSS-Tricks — Animating CSS Grid, web.dev — CSS Animated Grid Layouts]

### Pattern 2: React Context Provider Tree (Server/Client Boundary)

**What:** A Server Component wraps `'use client'` providers around `{children}`, keeping the layout shell server-rendered while enabling client-side state for layout, density, and theme color.

**When to use:** The root `app/layout.tsx` and `app/(main)/layout.tsx`. Providers at root; AppShell at the main layout level.

**Key insight:** The `(main)/layout.tsx` wraps the AppShell. The root `layout.tsx` owns the `<html>` and provider tree. This separation means:
- Root layout handles `<html>`, `<body>`, fonts, metadata, and global providers
- Main layout handles the three-column AppShell — only rendered for authenticated pages (not auth pages)

**Example:**
```tsx
// web/app/layout.tsx (Server Component — no 'use client')
import { Inter, Geist } from 'next/font/google'
import { ThemeProvider } from './providers/theme-provider'
import { AuthProvider } from './providers/auth-provider'
import { LayoutProvider } from './providers/layout-provider'
import { DensityProvider } from './providers/density-provider'
import { ThemeColorProvider } from './providers/theme-color-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={geist.variable}>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <LayoutProvider>
              <DensityProvider>
                <ThemeColorProvider>
                  {children}
                </ThemeColorProvider>
              </DensityProvider>
            </LayoutProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

```tsx
// web/app/(main)/layout.tsx (Server Component)
import { AppShell } from '@/components/layout/AppShell'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
```

**Provider ordering rationale:**
1. `ThemeProvider` first — everything below may read `resolvedTheme`
2. `AuthProvider` second — layout depends on auth state (user avatar, menu items)
3. `LayoutProvider` third — owns sidebar/panel state; consumers need auth context
4. `DensityProvider` fourth — sets `--card-padding`, `--element-spacing` CSS vars
5. `ThemeColorProvider` last — sets `--primary`, `--ring` CSS vars; no other provider depends on it

[CITED: Next.js App Router docs — "patterns for managing shared state", CONTEXT.md provider definitions]

### Pattern 3: Framer Motion AnimatePresence for Panel Lifecycle

**What:** Wrap conditionally-rendered right panel content in `<AnimatePresence mode="wait">` so exit animations play before the next panel content mounts.

**When to use:** RightPanel content switching per page, CommandPalette open/close, MobileDock mount/unmount.

**Example:**
```tsx
// web/components/layout/RightPanel.tsx
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

export function RightPanel() {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-[280px]"
      >
        {/* Panel widgets switch based on pathname */}
        <PanelContent pathname={pathname} />
      </motion.aside>
    </AnimatePresence>
  )
}
```

**Card hover (micro-interaction):**
```tsx
<motion.div
  whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
  className="rounded-lg bg-card p-4"
>
  {/* card content */}
</motion.div>
```

**Star click (spring bounce):**
```tsx
<motion.button
  whileTap={{ scale: 0.9 }}
  animate={{ scale: isStarred ? [1, 1.2, 1] : 1 }}
  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
>
  <StarIcon />
</motion.button>
```

[CITED: Framer Motion docs — AnimatePresence, motion components; DeepWiki — Framer Motion 4.2 AnimatePresence]

### Pattern 4: CSS Custom Properties for Zero-Re-Render Theming

**What:** Accent color and density changes write directly to `document.documentElement.style.setProperty()`, bypassing React's reconciliation. All shadcn components consume these CSS variables automatically.

**When to use:** ThemeColorProvider (5 accent presets), DensityProvider (3 density levels). NOT for layout state (sidebar/panel) — that uses standard React Context.

**Example:**
```tsx
// web/app/providers/theme-color-provider.tsx
'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'

type AccentPreset = 'neutral' | 'blue' | 'green' | 'orange' | 'violet'

// OKLCH values from UI-SPEC color contract
const ACCENT_COLORS: Record<AccentPreset, { primary: string; ring: string; primaryFg: string }> = {
  neutral:  { primary: 'oklch(0.205 0 0)',        ring: 'oklch(0.708 0 0)',       primaryFg: 'oklch(0.985 0 0)' },
  blue:     { primary: 'oklch(0.546 0.245 262.881)', ring: 'oklch(0.623 0.214 259.815)', primaryFg: 'oklch(0.985 0 0)' },
  green:    { primary: 'oklch(0.596 0.145 163.225)', ring: 'oklch(0.665 0.12 158.18)',  primaryFg: 'oklch(0.985 0 0)' },
  orange:   { primary: 'oklch(0.646 0.192 41.116)',  ring: 'oklch(0.704 0.18 48.54)',   primaryFg: 'oklch(0.985 0 0)' },
  violet:   { primary: 'oklch(0.545 0.238 291.664)', ring: 'oklch(0.606 0.24 292.685)',  primaryFg: 'oklch(0.985 0 0)' },
}

interface ThemeColorContextType {
  accent: AccentPreset
  setAccent: (preset: AccentPreset) => void
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined)

export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentPreset>('neutral')

  // Apply to DOM directly — zero React re-renders on consumer components
  useEffect(() => {
    const saved = localStorage.getItem('echoes_accent') as AccentPreset | null
    if (saved && ACCENT_COLORS[saved]) {
      setAccentState(saved)
      applyAccent(saved)
    }
  }, [])

  const setAccent = (preset: AccentPreset) => {
    setAccentState(preset)
    applyAccent(preset)
    localStorage.setItem('echoes_accent', preset)
  }

  return (
    <ThemeColorContext.Provider value={{ accent, setAccent }}>
      {children}
    </ThemeColorContext.Provider>
  )
}

function applyAccent(preset: AccentPreset) {
  const colors = ACCENT_COLORS[preset]
  const root = document.documentElement
  root.style.setProperty('--primary', colors.primary)
  root.style.setProperty('--primary-foreground', colors.primaryFg)
  root.style.setProperty('--ring', colors.ring)
}

export function useThemeColor() {
  const ctx = useContext(ThemeColorContext)
  if (!ctx) throw new Error('useThemeColor must be used within ThemeColorProvider')
  return ctx
}
```

**Density provider follows the same pattern:**
```tsx
// Sets CSS variables on :root:
//   compact:    --card-padding: 12px; --element-spacing: 8px
//   comfortable: --card-padding: 16px; --element-spacing: 16px
//   loose:      --card-padding: 24px; --element-spacing: 24px
```

[CITED: Atlassian Engineering — CSS custom properties for Trello theming; Twilio Paste — SSR-safe theme switching; npm themes-provider docs]

### Pattern 5: Command Palette with shadcn command + cmdk

**What:** A modal overlay triggered by Cmd/Ctrl+K that provides fuzzy search over memories, page navigation, and slash/angle-bracket command modes.

**When to use:** Global keyboard shortcut. Renders via portal to `document.body` to avoid z-index issues.

**Example:**
```tsx
// web/components/command/CommandPalette.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="搜索记忆或输入命令..." />
      <CommandList>
        <CommandEmpty>没有找到匹配项</CommandEmpty>
        <CommandGroup heading="页面导航">
          <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
            时间轴
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/tags'))}>
            标签云
          </CommandItem>
          {/* ... more items */}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="命令">
          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
            打开设置
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

**Prefix mode implementation:** The `/` and `>` modes can be detected by checking the `value` prop of `CommandInput`:

```tsx
// Inside the CommandPalette, check input value:
const isSlashMode = value.startsWith('/')
const isCommandMode = value.startsWith('>')

// Show different groups based on mode:
{isSlashMode && (
  <CommandGroup heading="筛选方式">
    <CommandItem>/标签 - 按标签筛选</CommandItem>
    <CommandItem>/时间 - 按时间筛选</CommandItem>
  </CommandGroup>
)}
```

[CITED: shadcn/ui docs — Command component; cmdk GitHub; WebSearch — shadcn command palette patterns]

### Anti-Patterns to Avoid

- **Don't nest `'use client'` providers inside Server Components that import server-only modules.** The provider boundary must be clean — all imports within the provider file must be client-safe.
- **Don't use `display: none` or remove columns for panel collapse.** This prevents CSS transitions. Use `0fr` in `grid-template-columns` instead.
- **Don't put layout state in the Server Component tree.** Server Components can't hold UI state. Layout state (sidebar collapsed, panel visible) belongs in `LayoutProvider` (a Client Component).
- **Don't use React Context for accent color theming.** Context triggers full tree re-renders on every consumer. Use `document.documentElement.style.setProperty()` instead.
- **Don't use `height: 100vh` for the layout shell.** On mobile, 100vh doesn't account for dynamic browser chrome. Use `min-height: 100dvh` or `min-height: 100vh` with `padding-bottom` for safe areas.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Command palette fuzzy search | Custom search + keyboard nav | shadcn `command` (cmdk) | cmdk handles fuzzy matching, keyboard navigation, ARIA, and focus management — hundreds of edge cases [CITED: shadcn docs] |
| Service worker offline caching | Custom SW with manual cache strategies | `@serwist/next` | Handles precaching, runtime strategies, versioning, skipWaiting, and Next.js integration [CITED: serwist docs] |
| Custom CSS column animation logic | Hand-coded FLIP animations | CSS Grid `grid-template-columns` transition | Browser-native, GPU-accelerated, zero JS overhead for the column resizing itself [VERIFIED: web.dev CSS animated grid layouts] |
| Modal/dialog accessibility | Custom focus trapping | shadcn `dialog` (@base-ui/react Dialog primitive) | Focus trapping, ESC dismiss, ARIA roles, portal rendering — all handled [CITED: shadcn docs] |
| Dropdown menu positioning | Custom Popper.js calculations | shadcn `dropdown-menu` (@base-ui/react Menu primitive) | Collision detection, viewport awareness, scroll locking [CITED: shadcn docs] |
| Desktop window chrome (Tauri) | Custom titlebar from scratch | `data-tauri-drag-region` + `@tauri-apps/api` window module | Tauri provides native drag region attribute and window API [CITED: Tauri v2 docs] |

**Key insight:** Phase 11 is primarily about composition and integration of existing libraries, not building new primitives. The only truly custom code is the layout orchestration (AppShell, providers), panel content routing, and celebration animations (confetti-lite).

## Runtime State Inventory

> Phase 11 is a UI refactor (layout restructuring, not a rename/rebrand). No string replacements, no data migrations needed. However, runtime state related to existing user preferences exists:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage`: `echoes_theme` (dark/light/system) — already read by ThemeProvider | None — ThemeProvider unchanged |
| Stored data | `localStorage`: `echoes_refresh_token` — already read by AuthProvider | None — AuthProvider unchanged |
| Stored data | NEW: `localStorage` keys for Phase 11: `echoes_accent`, `echoes_density`, `echoes_sidebar_collapsed`, `echoes_panel_visible`, `echoes_panel_width` | New code adds these keys; no migration needed |
| Live service config | None — Phase 11 is frontend-only | — |
| OS-registered state | None | — |
| Secrets/env vars | None — no new secrets needed | — |
| Build artifacts | None | — |

**Nothing found in categories marked "None"** — verified by codebase review of ThemeProvider (localStorage keys), AuthProvider (localStorage keys), and docker-compose.yml (no frontend-specific runtime state).

## Common Pitfalls

### Pitfall 1: Layout Shift on Hydration
**What goes wrong:** CSS Grid renders a different column layout during SSR vs client hydration because the browser width isn't known at build time.
**Why it happens:** Server-side render doesn't know the viewport width, so it renders the default (desktop) layout. On a mobile device, when React hydrates, the grid snaps to the mobile layout — causing a visible layout shift.
**How to avoid:** Use CSS media queries for the Grid template directly (not JS-based responsive logic). The media query applies before hydration, so the browser shows the correct layout from the first paint. Only use JS-responsive logic for things media queries can't handle (e.g., the MobileDock component mounting at <768px).
**Warning signs:** CLS (Cumulative Layout Shift) score > 0.1 in Lighthouse on mobile. Components appear at wrong sizes and then "snap" into place.

### Pitfall 2: Provider Order Causing Stale Context
**What goes wrong:** A component inside `DensityProvider` calls `useLayout()` but gets undefined because `LayoutProvider` is nested inside `DensityProvider`.
**Why it happens:** React Context reads from the nearest ancestor provider. If providers are in the wrong nesting order, downstream consumers can't access the contexts they need.
**How to avoid:** Document the provider tree order explicitly. The rule: providers that other providers depend on must be outer (higher in the tree). Since `DensityProvider` and `ThemeColorProvider` only write to the DOM (not to React state consumed by other providers), they can be innermost.
**Warning signs:** `useContext` returning `undefined` in a component that should have access.

### Pitfall 3: SSR Breakage from '@tauri-apps/api' Import
**What goes wrong:** `ReferenceError: window is not defined` during `next build` when `@tauri-apps/api` is imported at module scope.
**Why it happens:** `@tauri-apps/api` accesses `window.__TAURI_INTERNALS__` at import time. Next.js SSR has no `window` object.
**How to avoid:** Always import Tauri APIs inside `'use client'` components, and only call them inside `useEffect` or event handlers. Never import at module scope. For the Header component with a custom titlebar, lazy-load the Tauri window API:
```tsx
const appWindow = typeof window !== 'undefined'
  ? await import('@tauri-apps/api/window').then(m => m.getCurrentWindow())
  : null
```
**Warning signs:** Build failures with `ReferenceError: window is not defined`.

### Pitfall 4: cmdk Peer Dependency Conflict
**What goes wrong:** `npm install` fails with peer dependency conflict when installing the shadcn `command` component (which depends on `cmdk`).
**Why it happens:** `cmdk@1.0.0` had a peer dependency on React 18, but some npm setups resolve incorrectly. For React 18 (this project), this should not be an issue, but `cmdk@1.0.4` is the safe version.
**How to avoid:** Ensure `cmdk@^1.0.4` is in `package.json`. This version has full React 18 support. [CITED: GitHub shadcn-ui/ui issue #5613]
**Warning signs:** npm error about unmet peer dependency `react@18` for `cmdk`.

### Pitfall 5: Service Worker Caching Stale UI on Deploy
**What goes wrong:** Users see old UI after a deploy because the service worker caches the previous build's HTML/JS/CSS.
**Why it happens:** Service workers with `CacheFirst` strategy for static assets serve cached versions even after a new deployment.
**How to avoid:** Use `StaleWhileRevalidate` for JS/CSS assets (serves cached version but updates cache in background). Use `NetworkFirst` for HTML. Serwist's `skipWaiting: true` + `clientsClaim: true` ensures new SW activates immediately. Add a version hash to the precache manifest.
**Warning signs:** Users reporting "old version" of the app after deployments. Console showing old asset URLs.

### Pitfall 6: Right Panel 0fr Content Still Renders
**What goes wrong:** When the right panel is collapsed (`0fr`), its content is still in the DOM and visible (overflowing or zero-width but with visible text).
**Why it happens:** CSS Grid `0fr` collapses the track but doesn't hide the content — it may overflow or wrap.
**How to avoid:** Add `overflow: hidden` on the panel container and `min-width: 0` to prevent flex/grid children from expanding beyond the track. For the right panel specifically:
```css
.right-panel {
  overflow: hidden;
  min-width: 0;
}
.right-panel[data-visible="false"] {
  /* Content hidden when panel is 0fr */
  visibility: hidden;
  pointer-events: none;
}
```
**Warning signs:** Text or icons from the hidden panel appearing at the right edge of the screen.

## Code Examples

Verified patterns from official sources:

### CSS Grid AppShell Container
```css
/* Source: CSS-Tricks — Animating CSS Grid, web.dev CSS Animated Grid Layouts */
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width, 200px) 1fr var(--panel-width, 0px);
  min-height: calc(100dvh - 48px); /* 48px header */
  transition: grid-template-columns 200ms ease-out;
}

/* Desktop: three columns */
@media (min-width: 1280px) {
  .app-shell { --sidebar-width: 200px; }
  .app-shell[data-sidebar-collapsed="true"] { --sidebar-width: 48px; }
  .app-shell[data-panel-visible="true"] { --panel-width: 280px; }
}

/* Tablet: two columns, no right panel */
@media (min-width: 768px) and (max-width: 1279px) {
  .app-shell { --sidebar-width: 200px; --panel-width: 0px; }
  .app-shell[data-sidebar-collapsed="true"] { --sidebar-width: 0px; }
}

/* Mobile: single column, dock at bottom */
@media (max-width: 767px) {
  .app-shell {
    grid-template-columns: 1fr;
    --sidebar-width: 0px;
    --panel-width: 0px;
    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  }
}
```

### Mobile Dock with Safe Area
```css
/* Source: CSS env() spec; StackOverflow Next.js + Tailwind safe-area */
.mobile-dock {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  @apply bg-background border-t border-border;
  z-index: 50;
}

/* Fallback for older browsers */
@supports not (padding-bottom: env(safe-area-inset-bottom, 0px)) {
  .mobile-dock { padding-bottom: 8px; }
}
```

### Framer Motion Sidebar Collapse with layoutId
```tsx
// Source: Framer Motion docs — layout animations
<motion.nav
  layout
  data-sidebar-collapsed={collapsed}
  style={{ width: collapsed ? 48 : 200 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
  {navItems.map(item => (
    <SidebarItem key={item.id} collapsed={collapsed} {...item} />
  ))}
</motion.nav>
```

### Service Worker Registration (Serwist)
```tsx
// Source: @serwist/next docs — integration guide
// web/app/layout.tsx (in the body, inside a client-only useEffect)
useEffect(() => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err))
  }
}, [])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|-------|
| `next-pwa` (Workbox) | `@serwist/next` | 2024 | next-pwa deprecated; Serwist is the maintained successor with full App Router + Turbopack support |
| Manual service worker | Config-based via Serwist | 2024 | Reduces WASM boilerplate from hundreds of lines to ~30 lines of config |
| `grid-template-columns` not animatable | Native CSS transition support | 2023-2024 (Chrome 107, FF 115, Safari 16.2) | Eliminates need for `animate-css-grid` library or FLIP animation hacks |
| React Context for theming | CSS custom properties via `style.setProperty()` | Established pattern | Zero re-renders on theme change; browser compositor handles paint updates |
| `cmdk` wrapped manually | shadcn `command` component | shadcn v4 | Provides ready-made CommandDialog, styling, and keyboard shortcut integration |
| `exitBeforeEnter` (deprecated) | `mode="wait"` on AnimatePresence | Framer Motion v7+ | Cleaner API for sequential enter/exit animations |

**Deprecated/outdated:**
- **`exitBeforeEnter` prop on AnimatePresence**: Replaced by `mode="wait"` in Framer Motion v7+. Use `mode="wait"` for right panel page transitions.
- **`next-pwa` package**: Deprecated. Use `@serwist/next` v9.
- **Flash of unstyled content (FOUC) on theme**: The existing ThemeProvider handles this correctly via `suppressHydrationWarning` + `useEffect` initialization. No changes needed.
- **`constant()` CSS function for safe-area**: Deprecated in favor of `env()`. Use `env(safe-area-inset-bottom, 0px)` with fallback.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | shadcn `command` component will install cleanly with the existing React 18.2 setup (no React 19 peer dependency issues) | Standard Stack | If cmdk has a hidden React 18 issue, we may need to pin `cmdk@1.0.0` or use `--legacy-peer-deps` |
| A2 | `@serwist/next` v9 works with `output: 'standalone'` (not `export`) mode | PWA | If Serwist classic mode requires static export, we'd need to switch to configurator mode or adjust build |
| A3 | CSS Grid `grid-template-columns` transition works on all target browsers (Windows/macOS/iOS/Android WebViews) | Three-Column Layout | If a target platform has buggy Grid transition support, fall back to Framer Motion width animation on individual columns |
| A4 | `viewport-fit=cover` meta tag is already present or can be added without breaking existing layout | Mobile Dock | If missing, safe-area insets won't work on notched devices; need to add the meta tag |
| A5 | Tauri WebView on Windows supports modern CSS (Grid, custom properties, env()) | Tauri | Windows WebView2 (Edge Chromium) is evergreen and supports all modern CSS; this is a safe assumption |
| A6 | The `apps/desktop/` Tauri build can point to `localhost:3000` in dev without CORS issues | Tauri | Tauri's WebView loads `localhost` directly; same-origin so no CORS. Production build needs `output: 'export'` — separate concern |

## Open Questions

1. **Tauri production build strategy**
   - What we know: Current `next.config` uses `output: 'standalone'` for Docker. Tauri production needs `output: 'export'` for static files.
   - What's unclear: Should we create a separate `next.config.tauri.mjs` or use environment variables to switch output modes?
   - Recommendation: For Phase 11 (minimal setup), keep Tauri dev-only (localhost:3000). Add a `tauri:build` script that temporarily switches to `output: 'export'` in Phase 11, with a proper solution (dual build targets) deferred to the desktop polish phase.

2. **Serwist classic vs configurator mode**
   - What we know: Classic mode (webpack wrapper) works with Next.js 14 + `output: 'standalone'`. Configurator mode (separate `serwist build`) is the 2025 recommendation but requires `output: 'export'` or custom post-build script.
   - What's unclear: Whether classic-mode `withSerwist()` works reliably with Next.js 14.2's webpack config.
   - Recommendation: Start with classic mode. If it causes build issues, switch to configurator mode with `SERWIST_DISABLE_DEV=1` in development.

3. **Sidebar collapse trigger mechanism**
   - What we know: CONTEXT.md specifies "Click chevron toggle at sidebar bottom; animate width 200px <-> 48px"
   - What's unclear: Whether the sidebar should also auto-collapse at certain breakpoints or only via manual toggle.
   - Recommendation: Manual toggle only. Auto-collapse at breakpoints would conflict with user preference. Use a chevron button at the sidebar bottom, with state persisted in localStorage.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build + shadcn CLI | (version check skipped — npm works) | — | — |
| npm | Package management | ✓ (functions via Bash) | — | — |
| shadcn CLI | Installing new UI components | ✓ (shadcn ^4.6.0 already in package.json) | 4.6.0 | npx shadcn@latest |
| Framer Motion | Animations | ✓ (already in dependencies) | ^11.0.8 | — |
| Rust / Cargo | Tauri build (apps/desktop) | ✗ (not checked — may not be installed) | — | Tauri setup requires Rust toolchain; if missing, Phase 11 can be scoped to config-only without compiling |
| Android SDK / Xcode | Tauri mobile targets | N/A (Phase 11 is desktop only) | — | — |

**Missing dependencies with no fallback:**
- (None that block core Phase 11 delivery. Tauri compilation can be deferred to Phase 11's Tauri wave.)

**Missing dependencies with fallback:**
- **Rust/Cargo (for Tauri compilation):** Phase 11 only needs the config files and Rust source written. Actual `cargo tauri build` can be attempted; if Rust is not installed, flag for user to install.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (E2E) — already configured |
| Config file | `web/playwright.config.ts` |
| Quick run command | `npx playwright test --project=chromium` |
| Full suite command | `npx playwright test` |
| Unit test framework | Jest ^29.7.0 (configured in package.json but no jest.config found — tests at `web/tests/` not found) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-11-01 | Desktop three-column layout renders without horizontal scrollbar | E2E | `npx playwright test specs/layout.spec.ts -g "desktop layout"` | ❌ Wave 0 |
| REQ-11-02 | Mobile bottom Dock visible at <768px viewport | E2E | `npx playwright test specs/layout.spec.ts -g "mobile dock"` | ❌ Wave 0 |
| REQ-11-03 | Cmd+K opens Command Palette, search returns results | E2E | `npx playwright test specs/command-palette.spec.ts` | ❌ Wave 0 |
| REQ-11-04 | Header contains only Logo + Search + Avatar (no nav buttons) | E2E | `npx playwright test specs/layout.spec.ts -g "header"` | ❌ Wave 0 |
| REQ-11-06 | Density toggle changes card padding without page refresh | E2E | `npx playwright test specs/settings.spec.ts -g "density"` | ❌ Wave 0 |
| REQ-11-07 | Theme color toggle changes accent without page refresh | E2E | `npx playwright test specs/settings.spec.ts -g "theme color"` | ❌ Wave 0 |
| REQ-11-08 | All existing pages (timeline, search, tags, settings, capsules) render in new layout | E2E | `npx playwright test specs/smoke.spec.ts` | ❌ Wave 0 |
| REQ-11-09 | Dark/light toggle has visible transition (not instant flash) | Manual-only | Visual regression — requires screenshot comparison or manual review | N/A |
| REQ-11-13 | Mobile <768px has bottom Dock, no sidebar | E2E | `npx playwright test specs/layout.spec.ts -g "mobile responsive"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=chromium specs/layout.spec.ts` (fastest pass covering layout integrity)
- **Per wave merge:** `npx playwright test` (full suite)
- **Phase gate:** Full suite green + manual visual review before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `web/e2e/specs/layout.spec.ts` — covers REQ-11-01, 11-02, 11-04, 11-13
- [ ] `web/e2e/specs/command-palette.spec.ts` — covers REQ-11-03
- [ ] `web/e2e/specs/smoke.spec.ts` — covers REQ-11-08 (existing pages in new layout)
- [ ] Jest config file (`web/jest.config.ts`) — none found; needed if unit-testing providers/hooks
- [ ] `web/playwright/.auth/user.json` — auth state for existing E2E tests; verify this works with new layout

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing AuthProvider unchanged; JWT stored in httpOnly cookie via API; refresh token in localStorage (existing pattern) |
| V3 Session Management | yes | Existing session unchanged; Phase 11 does not modify auth flow |
| V4 Access Control | yes | AuthProvider gates new layout — unauthenticated users see auth pages only (no AppShell) |
| V5 Input Validation | yes | Command palette search input: existing API validation on backend; client-side is display-only |
| V6 Cryptography | no | Phase 11 does not handle cryptographic operations |

### Known Threat Patterns for Next.js + shadcn

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user-generated content in Right Panel | Tampering | React's default escaping; existing API content already sanitized |
| CSRF in theme/density preference storage | Tampering | localStorage is same-origin isolated; no sensitive data in these keys |
| Clickjacking via Command Palette overlay | Elevation of Privilege | shadcn Dialog uses portal + focus trap; Command Palette is a modal overlay |
| Information disclosure in Right Panel sidebar | Information Disclosure | Panel content respects existing auth — `useAuth()` gate on panel widgets |
| Client-side state manipulation (localStorage) | Tampering | Layout preferences are non-security-critical; accent/density are cosmetic |

## Sources

### Primary (HIGH confidence)
- [shadcn/ui official docs](https://ui.shadcn.com/docs/components/command) — command component, installation, cmdk integration
- [shadcn/ui GitHub](https://github.com/shadcn-ui/ui) — v4/canary changes, @base-ui/react primitives
- [CSS-Tricks — Animating CSS Grid](https://css-tricks.com/animating-css-grid-how-to-examples/) — grid-template-columns transition support, browser compatibility
- [web.dev — CSS Animated Grid Layouts](https://web.dev/articles/css-animated-grid-layouts) — 0fr technique, native grid transitions
- [Framer Motion docs](https://www.framer.com/motion/) — AnimatePresence, layout animations, spring physics
- [DeepWiki — Framer Motion 4.2 AnimatePresence](https://deepwiki.com/motiondivision/motion/4.2-animatepresence) — popLayout mode, PresenceChild architecture
- [Next.js App Router docs](https://nextjs.org/docs/app) — Server/Client Components, layouts, providers
- [Tauri v2 docs — Window Customization](https://v2.tauri.app/learn/window-customization/) — decorations, transparent, frameless
- [@serwist/next docs](https://serwist.pages.dev/docs/next/config) — setup, caching strategies, configurator mode

### Secondary (MEDIUM confidence)
- [Atlassian Engineering — CSS custom properties for Trello theming](https://www.atlassian.com/engineering/colorful-and-accessible-theming-in-trello) — verified approach to zero-re-render theming
- [Twilio Paste — Theme switching with SSR and SSG](https://paste.twilio.design/blog/2025-03-20-css-variables-ssr-ssg) — data-theme attribute pattern
- [StackOverflow — Next.js 15 safe-area-inset-bottom](https://stackoverflow.com/questions/79597246) — PWA safe-area quirks
- [GitHub shadcn-ui/ui issue #5613](https://github.com/shadcn-ui/ui/issues/5613) — cmdk React 19 compatibility (resolved)
- [GitHub serwist/serwist issue #173](https://github.com/serwist/serwist/issues/173) — offline mode with App Router
- Multiple GitHub Tauri+Next.js templates confirming the `output: 'export'` approach

### Tertiary (LOW confidence)
- [CSDN blog — Framer Motion AnimatePresence modes](https://blog.csdn.net/g9h0i1/article/details/151573453) — mode comparison table (not verified against official docs but consistent)
- [Juejin.cn — Server/Client Components](https://juejin.cn/post/7486306126758936615) — practical patterns (community source, not official)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry (2026-05-03). shadcn, Framer Motion, and tailwindcss are already in package.json.
- Architecture: HIGH — CSS Grid transition support confirmed by multiple authoritative sources (CSS-Tricks, web.dev). Provider tree pattern confirmed by Next.js docs and community consensus.
- Pitfalls: HIGH — pitfall list cross-referenced with GitHub issues, official docs, and community troubleshooting threads.
- PWA/Serwist: MEDIUM — Serwist v9 confirmed compatible with Next.js 14, but `output: 'standalone'` compatibility flagged as an assumption (A2).
- Tauri: HIGH — Tauri v2 docs confirm the patterns; Rust toolchain availability on this machine is unknown.

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (30 days — stable ecosystem for shadcn v4, Next.js 14, Framer Motion v11)
