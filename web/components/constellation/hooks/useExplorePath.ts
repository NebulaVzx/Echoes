'use client'

import { useState, useCallback } from 'react'
import type { ExploreState } from '@/types/constellation'

export function useExplorePath() {
  const [path, setPath] = useState<ExploreState[]>([])

  const push = useCallback((memoryId: string, label: string) => {
    setPath((prev) => [...prev, { memoryId, label }])
  }, [])

  const pop = useCallback(() => {
    setPath((prev) => {
      if (prev.length <= 1) return []
      return prev.slice(0, -1)
    })
  }, [])

  const navigateTo = useCallback((index: number) => {
    setPath((prev) => prev.slice(0, index + 1))
  }, [])

  const clear = useCallback(() => {
    setPath([])
  }, [])

  const current = path.length > 0 ? path[path.length - 1] : null

  return {
    path,
    current,
    push,
    pop,
    navigateTo,
    clear,
  }
}
