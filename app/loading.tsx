import { PageSpinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <PageSpinner />
    </div>
  );
}
