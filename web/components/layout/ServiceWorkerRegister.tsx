'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.ts')
          .catch(() => {
            // Silently fail — PWA is progressive enhancement
          })
      }
    }
  }, [])

  return null
}
