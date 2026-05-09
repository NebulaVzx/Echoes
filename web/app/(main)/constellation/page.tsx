import { type Metadata } from 'next'
import { ConstellationPageClient } from './page-client'

export const metadata: Metadata = {
  title: '记忆星图 - Echoes',
}

export default function ConstellationPage() {
  return <ConstellationPageClient />
}
