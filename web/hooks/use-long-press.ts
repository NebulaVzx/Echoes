'use client'

import { useCallback, useRef, useState } from 'react'

interface UseLongPressOptions {
  threshold?: number
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void
  onClick?: (e: React.MouseEvent) => void
}

export function useLongPress({ threshold = 500, onLongPress, onClick }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPressing, setIsPressing] = useState(false)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    startPosRef.current = { x: clientX, y: clientY }
    setIsPressing(true)
    timerRef.current = setTimeout(() => {
      setIsPressing(false)
      onLongPress(e)
    }, threshold)
  }, [threshold, onLongPress])

  const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!startPosRef.current || !timerRef.current) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const dx = Math.abs(clientX - startPosRef.current.x)
    const dy = Math.abs(clientY - startPosRef.current.y)
    // Cancel if moved more than 10px
    if (dx > 10 || dy > 10) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      setIsPressing(false)
      startPosRef.current = null
    }
  }, [])

  const end = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsPressing(false)
    startPosRef.current = null
    // If it's a mouse click and not a long press, trigger onClick
    if ('button' in e && onClick) {
      onClick(e)
    }
  }, [onClick])

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsPressing(false)
    startPosRef.current = null
  }, [])

  return {
    handlers: {
      onMouseDown: start,
      onMouseUp: end,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: end,
      onTouchMove: move,
    },
    isPressing,
  }
}
