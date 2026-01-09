"use client"

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
        className
      )}
    />
  )
}

// Common skeleton patterns
export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonTaskCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex items-center justify-between mt-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonKanbanColumn() {
  return (
    <div className="flex-shrink-0 w-80 bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
      <div className="space-y-3">
        <SkeletonTaskCard />
        <SkeletonTaskCard />
        <SkeletonTaskCard />
      </div>
    </div>
  )
}

export function SkeletonKanbanBoard() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      <SkeletonKanbanColumn />
      <SkeletonKanbanColumn />
      <SkeletonKanbanColumn />
      <SkeletonKanbanColumn />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/6" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonProjectHeader() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="px-4 py-6 sm:px-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="ml-4 flex-1">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Tasks */}
      <div className="card p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <SkeletonTable rows={5} />
      </div>
    </div>
  )
}

export function SkeletonProjectList() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
