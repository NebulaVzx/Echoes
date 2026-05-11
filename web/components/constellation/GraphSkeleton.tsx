export function GraphSkeleton() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">正在绘制星图...</p>
      </div>
    </div>
  )
}
