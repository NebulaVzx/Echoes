'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMoodCalendar } from '@/hooks/use-mood-calendar'
import MoodCalendar from '@/components/mood/mood-calendar'
import MoodCalendarLegend from '@/components/mood/mood-calendar-legend'
import MoodInsightCard from '@/components/mood/mood-insight-card'
import DayDetailPanel from '@/components/mood/day-detail-panel'
import { MoodDayData } from '@/lib/api'

export default function MoodPage() {
  const { days, insight, loading, error, year, setYear } = useMoodCalendar()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedData, setSelectedData] = useState<MoodDayData | null>(null)

  const handleDayClick = (date: string, data: MoodDayData | null) => {
    if (selectedDate === date) {
      setSelectedDate(null)
      setSelectedData(null)
    } else {
      setSelectedDate(date)
      setSelectedData(data)
    }
  }

  const goToPrevYear = () => setYear(year - 1)
  const goToNextYear = () => setYear(year + 1)
  const goToToday = () => setYear(new Date().getFullYear())

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="max-w-[900px] mx-auto px-4 py-6 md:px-6 md:py-8 space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">情绪日历</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToPrevYear}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-lg font-semibold">{year}年</span>
          <Button variant="ghost" size="sm" onClick={goToNextYear}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="ml-2">
            回到今天
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm">
          情绪数据加载失败，请刷新页面重试
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          正在分析情绪...
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && days.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-lg font-medium">还没有情绪数据</p>
          <p className="text-sm text-muted-foreground">
            保存更多记忆后，AI 会分析情绪倾向并生成日历。去时间轴添加第一条记忆吧。
          </p>
        </div>
      )}

      {/* Calendar */}
      {!loading && !error && days.length > 0 && (
        <>
          <div className="bg-card rounded-xl p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">年视图</h2>
              <MoodCalendarLegend />
            </div>
            <MoodCalendar
              data={days}
              year={year}
              onDayClick={handleDayClick}
            />
          </div>

          {/* Day Detail Panel */}
          <DayDetailPanel
            date={selectedDate}
            data={selectedData}
            onClose={() => {
              setSelectedDate(null)
              setSelectedData(null)
            }}
          />

          {/* Monthly Insight */}
          <MoodInsightCard insight={insight} loading={loading} />
        </>
      )}
    </motion.div>
  )
}
