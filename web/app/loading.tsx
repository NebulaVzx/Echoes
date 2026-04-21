import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Create form skeleton */}
        <div className="mb-10 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-5">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-[120px] w-full rounded-md mb-3" />
          <Skeleton className="h-10 w-full rounded-md mb-4" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>

        {/* Timeline skeleton */}
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Card skeletons */}
        <div className="flex flex-col gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-3" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
