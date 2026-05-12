'use client'

import { motion } from 'framer-motion'
import { MoodInsightData } from '@/lib/api'

interface MoodInsightCardProps {
  insight: MoodInsightData | null
  loading?: boolean
}

export default function MoodInsightCard({ insight, loading }: MoodInsightCardProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl p-5 space-y-4">
        <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-6 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
        <div className="h-4 bg-muted rounded animate-pulse" />
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
      </div>
    )
  }

  if (!insight) return null

  const stats = [
    { label: '积极天数', value: insight.stats.positive_days, color: 'text-green-500' },
    { label: '消极天数', value: insight.stats.negative_days, color: 'text-red-500' },
    { label: '中性天数', value: insight.stats.neutral_days, color: 'text-gray-500' },
    { label: '平均得分', value: insight.stats.average_score.toFixed(1), color: 'text-primary' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card rounded-xl p-5 space-y-4"
    >
      <h3 className="text-base font-semibold">本月情绪洞察</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{insight.insight}</p>
    </motion.div>
  )
}
