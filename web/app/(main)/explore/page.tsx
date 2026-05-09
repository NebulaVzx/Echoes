import { type Metadata } from 'next'
import { ExplorePageClient } from './page-client'

export const metadata: Metadata = {
  title: '探索模式 - Echoes',
}

export default function ExplorePage() {
  return <ExplorePageClient />
}
