'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, MoodDayData, MoodInsightData } from '@/lib/api'

interface UseMoodCalendarReturn {
  days: MoodDayData[]
  insight: MoodInsightData | null
  loading: boolean
  error: string | null
  year: number
  setYear: (year: number) => void
  month: number
  setMonth: (month: number) => void
  refetch: () => void
}

export function useMoodCalendar(initialYear?: number): UseMoodCalendarReturn {
  const [year, setYear] = useState(initialYear || new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [days, setDays] = useState<MoodDayData[]>([])
  const [insight, setInsight] = useState<MoodInsightData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [calendarRes, insightRes] = await Promise.all([
        api.getMoodCalendar(year),
        api.getMoodInsight(year, month),
      ])
      if (calendarRes.success && calendarRes.data) {
        setDays(calendarRes.data.days)
      }
      if (insightRes.success && insightRes.data) {
        setInsight(insightRes.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    days,
    insight,
    loading,
    error,
    year,
    setYear,
    month,
    setMonth,
    refetch: fetchData,
  }
}
