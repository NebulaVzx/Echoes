'use client'

import { motion } from 'framer-motion'

interface EchoMessageProps {
  message: string
  isLoading?: boolean
}

export default function EchoMessage({ message, isLoading }: EchoMessageProps) {
  if (isLoading) {
    return (
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-full" />
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
      </div>
    )
  }

  const paragraphs = message.split('\n').filter((p) => p.trim())

  return (
    <div className="bg-muted/50 rounded-lg p-4 relative">
      <span className="absolute top-2 left-3 text-2xl text-muted-foreground font-serif leading-none">
        &ldquo;
      </span>
      <div className="pl-4 space-y-2">
        {paragraphs.map((paragraph, index) => (
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="text-sm leading-relaxed italic text-foreground"
          >
            {paragraph}
          </motion.p>
        ))}
      </div>
    </div>
  )
}
