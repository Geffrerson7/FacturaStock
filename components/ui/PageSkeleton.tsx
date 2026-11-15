import { Skeleton } from "@heroui/react";

/** Silueta genérica de una página del panel: título, barra y tabla. */
export default function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-full max-w-sm rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
