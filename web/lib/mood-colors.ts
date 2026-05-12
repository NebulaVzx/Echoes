export const MOOD_COLORS = {
  light: {
    stronglyPositive: '#216e39',
    positive: '#30a14e',
    mildlyPositive: '#56d364',
    neutral: '#ebedf0',
    mildlyNegative: '#f85149',
    negative: '#cf222e',
    stronglyNegative: '#82071e',
    noData: '#ebedf0',
  },
  dark: {
    stronglyPositive: '#39d353',
    positive: '#2ea043',
    mildlyPositive: '#56d364',
    neutral: '#161b22',
    mildlyNegative: '#f85149',
    negative: '#da3633',
    stronglyNegative: '#ff7b72',
    noData: '#21262d',
  },
} as const

export function scoreToColor(score: number | null, isDark: boolean): string {
  if (score === null) return isDark ? MOOD_COLORS.dark.noData : MOOD_COLORS.light.noData
  const palette = isDark ? MOOD_COLORS.dark : MOOD_COLORS.light
  if (score >= 8) return palette.stronglyPositive
  if (score >= 5) return palette.positive
  if (score >= 2) return palette.mildlyPositive
  if (score >= -1) return palette.neutral
  if (score >= -4) return palette.mildlyNegative
  if (score >= -7) return palette.negative
  return palette.stronglyNegative
}

export function getSentimentLabel(score: number): string {
  if (score >= 8) return '非常积极'
  if (score >= 5) return '积极'
  if (score >= 2) return '轻微积极'
  if (score >= -1) return '中性'
  if (score >= -4) return '轻微消极'
  if (score >= -7) return '消极'
  return '非常消极'
}
