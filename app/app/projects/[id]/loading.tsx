import { SkeletonProjectHeader, SkeletonKanbanBoard } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <SkeletonProjectHeader />
      <SkeletonKanbanBoard />
    </div>
  )
}
