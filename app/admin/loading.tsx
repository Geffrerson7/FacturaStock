import PageSkeleton from "@/components/ui/PageSkeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando">
      <PageSkeleton />
    </div>
  );
}
