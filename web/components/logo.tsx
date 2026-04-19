// Echoes Logo - Inline SVG with currentColor for automatic dark/light mode support
// Design: Concentric arcs (echo ripples) + floating fragment (picked memory)

interface LogoProps {
  className?: string
  size?: number
}

export default function Logo({ className = '', size = 200 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="10"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Echoes Logo"
    >
      {/* Outer echo ripple */}
      <path d="M 35 100 A 65 65 0 1 1 145 145" opacity="0.35" />

      {/* Middle echo ripple */}
      <path d="M 55 100 A 45 45 0 1 1 130 130" opacity="0.6" />

      {/* Inner echo ripple */}
      <path d="M 75 100 A 25 25 0 1 1 115 115" opacity="0.9" />

      {/* Center dot: memory core */}
      <circle cx="100" cy="100" r="10" fill="currentColor" stroke="none" />

      {/* Picked-up memory fragment: top-right diamond */}
      <polygon points="152,42 166,56 156,70 142,56" fill="currentColor" stroke="none" opacity="0.85" />
    </svg>
  )
}
