import { Skeleton } from "@heroui/react";

import PageSkeleton from "@/components/ui/PageSkeleton";

/** Silueta del panel mientras se valida la sesión. */
export default function AdminShellSkeleton() {
  return (
    <div className="flex min-h-dvh" role="status" aria-label="Cargando panel">
      <div className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4 lg:flex">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center justify-between border-b border-border bg-surface px-3 sm:px-6">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
