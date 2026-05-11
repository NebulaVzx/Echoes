'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type DensityMode = 'compact' | 'comfortable' | 'loose'

interface DensityContextType {
  density: DensityMode
  setDensity: (mode: DensityMode) => void
}

const DensityContext = createContext<DensityContextType | undefined>(undefined)

const STORAGE_KEY = 'echoes_density'

function getSavedDensity(): DensityMode {
  if (typeof window === 'undefined') return 'comfortable'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'compact' || saved === 'comfortable' || saved === 'loose') return saved
  } catch { /* ignore */ }
  return 'comfortable'
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<DensityMode>('comfortable')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = getSavedDensity()
    setDensityState(saved)
    document.documentElement.setAttribute('data-density', saved)
  }, [])

  const setDensity = useCallback((mode: DensityMode) => {
    setDensityState(mode)
    document.documentElement.setAttribute('data-density', mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch { /* ignore quota */ }
  }, [])

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  )
}

export function useDensity() {
  const ctx = useContext(DensityContext)
  if (!ctx) throw new Error('useDensity must be used within DensityProvider')
  return ctx
}
