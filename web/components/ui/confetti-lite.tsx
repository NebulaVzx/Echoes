'use client'

import { useEffect, useState, useCallback } from 'react'

interface Particle {
  id: number
  x: number
  y: number
  color: string
  rotation: number
  scale: number
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#ef4444']
const PARTICLE_COUNT = 30

export function ConfettiLite({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [active, setActive] = useState(false)

  const fire = useCallback(() => {
    const newParticles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.5,
    }))
    setParticles(newParticles)
    setActive(true)
    setTimeout(() => setActive(false), 800)
  }, [])

  useEffect(() => {
    if (trigger > 0) fire()
  }, [trigger, fire])

  if (!active) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            animation: `confetti-fall 500ms ease-out forwards`,
            animationDelay: `${Math.random() * 200}ms`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
