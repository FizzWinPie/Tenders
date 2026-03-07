import { Skeleton } from "#/components/ui/skeleton"

export default function SkeletonCard() {
  return (
    <div className="island-shell rounded-xl p-4 shadow-xs">
      <Skeleton className="mb-2 flex flex-wrap justify-between items-center gap-2 bg-re">
        <div className="flex gap-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-3.5 w-14" />
        </div>
      </Skeleton>
      <Skeleton className="mb-2 h-4 w-4/5" />
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
    </div>
  )
}