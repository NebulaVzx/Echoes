'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

interface LayoutState {
  sidebarCollapsed: boolean
  rightPanelVisible: boolean
  rightPanelWidth: number
}

interface LayoutContextType extends LayoutState {
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleRightPanel: () => void
  setRightPanelVisible: (visible: boolean) => void
  setRightPanelWidth: (width: number) => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

function loadLayoutState(): LayoutState {
  if (typeof window === 'undefined') {
    return { sidebarCollapsed: false, rightPanelVisible: true, rightPanelWidth: 280 }
  }
  try {
    const saved = localStorage.getItem('echoes_layout')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        sidebarCollapsed: parsed.sidebarCollapsed ?? false,
        rightPanelVisible: parsed.rightPanelVisible ?? true,
        rightPanelWidth: Math.min(400, Math.max(200, parsed.rightPanelWidth ?? 280)),
      }
    }
  } catch { /* ignore parse errors */ }
  return { sidebarCollapsed: false, rightPanelVisible: true, rightPanelWidth: 280 }
}

function saveLayoutState(state: LayoutState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('echoes_layout', JSON.stringify(state))
  } catch { /* ignore quota errors */ }
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutState>(loadLayoutState)
  const [mounted, setMounted] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const saved = loadLayoutState()
    setState(saved)
  }, [])

  // Sync data attributes to :root for CSS consumption
  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.setAttribute('data-sidebar-collapsed', String(state.sidebarCollapsed))
    root.setAttribute('data-panel-visible', String(state.rightPanelVisible))
    saveLayoutState(state)
  }, [state, mounted])

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }))
  }, [])

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setState(prev => ({ ...prev, sidebarCollapsed: collapsed }))
  }, [])

  const toggleRightPanel = useCallback(() => {
    setState(prev => ({ ...prev, rightPanelVisible: !prev.rightPanelVisible }))
  }, [])

  const setRightPanelVisible = useCallback((visible: boolean) => {
    setState(prev => ({ ...prev, rightPanelVisible: visible }))
  }, [])

  const setRightPanelWidth = useCallback((width: number) => {
    setState(prev => ({ ...prev, rightPanelWidth: Math.min(400, Math.max(200, width)) }))
  }, [])

  return (
    <LayoutContext.Provider
      value={{
        ...state,
        toggleSidebar,
        setSidebarCollapsed,
        toggleRightPanel,
        setRightPanelVisible,
        setRightPanelWidth,
      }}
    >
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider')
  return ctx
}
