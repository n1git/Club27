import { PageSpinner } from "@/components/ui/spinner";

export function PageLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <PageSpinner />
    </div>
  );
}
