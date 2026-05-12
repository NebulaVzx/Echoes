'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MoodDayData } from '@/lib/api'
import { getSentimentLabel } from '@/lib/mood-colors'
import { X } from 'lucide-react'

interface DayDetailPanelProps {
  date: string | null
  data: MoodDayData | null
  onClose: () => void
}

export default function DayDetailPanel({ date, data, onClose }: DayDetailPanelProps) {
  return (
    <AnimatePresence>
      {date && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="bg-card rounded-xl p-4 mt-4 border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">{date}</h4>
              <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            {data ? (
              <div className="space-y-1 text-sm">
                <p>情绪倾向：{getSentimentLabel(data.score)} ({data.score > 0 ? '+' : ''}{data.score})</p>
                <p className="text-muted-foreground">{data.memory_count} 条记忆</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">这一天没有记忆</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
