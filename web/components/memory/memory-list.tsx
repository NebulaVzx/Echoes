'use client'

import { motion } from 'framer-motion'
import MemoryCard from './memory-card'
import { Memory } from '@/lib/api'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
}

interface MemoryListProps {
  memories: Memory[]
}

export default function MemoryList({ memories }: MemoryListProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-5"
    >
      {memories.map((memory) => (
        <motion.div key={memory.id} variants={itemVariants}>
          <MemoryCard memory={memory} />
        </motion.div>
      ))}
    </motion.div>
  )
}
