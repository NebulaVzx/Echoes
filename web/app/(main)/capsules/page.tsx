'use client'

import { useEffect, useState } from 'react'
import { api, Memory } from '@/lib/api'
import MemoryCard from '@/components/memory/memory-card'
import { Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CapsulesPage() {
  const [memories, setMemories] = useState<Memory[]>([])

  useEffect(() => {
    api.listSealedMemories().then((res) => {
      if (res.success && res.data) {
        setMemories(res.data.memories)
      }
    })
  }, [])

  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          title="返回首页"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-500" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">时间胶囊</h1>
        </div>
      </div>

      {memories.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          还没有封印的记忆。在创建记忆时选择「封印」，未来某个时刻它会重新出现。
        </p>
      ) : (
        <div className="space-y-4">
          {memories.map((memory) => (
            <div key={memory.id} className="relative">
              <MemoryCard memory={memory} />
              {memory.sealed_until && (
                <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                  {Math.ceil((new Date(memory.sealed_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} 天后解锁
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
