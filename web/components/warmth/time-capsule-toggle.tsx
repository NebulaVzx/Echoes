'use client'

import { useState } from 'react'
import { Lock, Calendar } from 'lucide-react'

const PRESETS = [
  { label: '7 天后', days: 7 },
  { label: '30 天后', days: 30 },
  { label: '100 天后', days: 100 },
]

interface TimeCapsuleToggleProps {
  sealedUntil: string | null
  onChange: (sealedUntil: string | null) => void
}

export default function TimeCapsuleToggle({ sealedUntil, onChange }: TimeCapsuleToggleProps) {
  const [enabled, setEnabled] = useState(!!sealedUntil)
  const [customDate, setCustomDate] = useState('')

  const handleToggle = () => {
    if (enabled) {
      setEnabled(false)
      onChange(null)
    } else {
      setEnabled(true)
      // Default to 7 days
      const d = new Date()
      d.setDate(d.getDate() + 7)
      onChange(d.toISOString())
    }
  }

  const handlePreset = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    onChange(d.toISOString())
  }

  const handleCustom = (value: string) => {
    setCustomDate(value)
    if (value) {
      onChange(new Date(value).toISOString())
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-2 text-sm transition-colors ${
          enabled
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <Lock className="w-4 h-4" />
        {enabled ? '🔒 已封印' : '封印这段记忆'}
      </button>

      {enabled && (
        <div className="mt-2 pl-6 space-y-2">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => handlePreset(p.days)}
                className="px-2.5 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              value={customDate}
              onChange={(e) => handleCustom(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
          </div>
        </div>
      )}
    </div>
  )
}
