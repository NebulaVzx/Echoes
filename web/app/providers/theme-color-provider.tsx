'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type AccentPreset = 'neutral' | 'blue' | 'green' | 'orange' | 'violet'

interface ThemeColorContextType {
  accent: AccentPreset
  setAccent: (preset: AccentPreset) => void
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined)

const STORAGE_KEY = 'echoes_accent'

// OKLCH values from UI-SPEC color contract
const ACCENT_COLORS: Record<AccentPreset, { primary: string; primaryFg: string; ring: string }> = {
  neutral: { primary: 'oklch(0.205 0 0)',            primaryFg: 'oklch(0.985 0 0)', ring: 'oklch(0.708 0 0)' },
  blue:    { primary: 'oklch(0.546 0.245 262.881)',  primaryFg: 'oklch(0.985 0 0)', ring: 'oklch(0.623 0.214 259.815)' },
  green:   { primary: 'oklch(0.596 0.145 163.225)',  primaryFg: 'oklch(0.985 0 0)', ring: 'oklch(0.665 0.12 158.18)' },
  orange:  { primary: 'oklch(0.646 0.192 41.116)',   primaryFg: 'oklch(0.985 0 0)', ring: 'oklch(0.704 0.18 48.54)' },
  violet:  { primary: 'oklch(0.545 0.238 291.664)',  primaryFg: 'oklch(0.985 0 0)', ring: 'oklch(0.606 0.24 292.685)' },
}

function applyAccent(preset: AccentPreset) {
  const colors = ACCENT_COLORS[preset]
  const root = document.documentElement
  root.style.setProperty('--primary', colors.primary)
  root.style.setProperty('--primary-foreground', colors.primaryFg)
  root.style.setProperty('--ring', colors.ring)
}

function getSavedAccent(): AccentPreset {
  if (typeof window === 'undefined') return 'neutral'
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as AccentPreset | null
    if (saved && ACCENT_COLORS[saved]) return saved
  } catch { /* ignore */ }
  return 'neutral'
}

export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentPreset>('neutral')

  useEffect(() => {
    const saved = getSavedAccent()
    setAccentState(saved)
    applyAccent(saved)
  }, [])

  const setAccent = useCallback((preset: AccentPreset) => {
    setAccentState(preset)
    applyAccent(preset)
    try {
      localStorage.setItem(STORAGE_KEY, preset)
    } catch { /* ignore quota */ }
  }, [])

  return (
    <ThemeColorContext.Provider value={{ accent, setAccent }}>
      {children}
    </ThemeColorContext.Provider>
  )
}

export function useThemeColor() {
  const ctx = useContext(ThemeColorContext)
  if (!ctx) throw new Error('useThemeColor must be used within ThemeColorProvider')
  return ctx
}
