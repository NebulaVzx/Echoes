/**
 * Generate a consistent HSL color from a string (e.g. tag name).
 * Uses the same algorithm as the constellation graph for visual consistency.
 */
export function getTagColor(tag: string): { bg: string; text: string } {
  if (!tag) {
    return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' }
  }

  // Simple hash function
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Use hash to generate HSL values
  const hue = Math.abs(hash % 360)
  const saturation = 60 + Math.abs((hash >> 8) % 20) // 60-80%
  const lightness = 45 + Math.abs((hash >> 16) % 15) // 45-60%

  // For dark mode: lighter colors
  const darkLightness = lightness + 15

  return {
    bg: `linear-gradient(135deg, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${(hue + 30) % 360}, ${saturation}%, ${lightness - 10}%))`,
    text: `hsl(${hue}, ${saturation}%, ${lightness > 50 ? 20 : 95}%)`,
  }
}

/**
 * Generate a solid fallback background with a letter from tag name.
 */
export function getFallbackCoverStyle(tag: string): {
  background: string
  color: string
  letter: string
} {
  if (!tag) {
    return {
      background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
      color: '#6b7280',
      letter: '?',
    }
  }

  const letter = tag.charAt(0).toUpperCase()

  // Use same hash as getTagColor for consistency
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }

  const hue = Math.abs(hash % 360)
  const sat = 55 + Math.abs((hash >> 8) % 15)
  const light = 75 + Math.abs((hash >> 16) % 10)

  const background = `linear-gradient(135deg, hsl(${hue}, ${sat}%, ${light}%), hsl(${(hue + 25) % 360}, ${sat}%, ${light - 8}%))`
  const color = `hsl(${hue}, ${sat}%, 30%)`

  return { background, color, letter }
}
