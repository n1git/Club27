import { BackLink } from "@/components/shared/back-link";
import { CoachForm } from "@/components/coaches/coach-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewCoachPage() {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <BackLink href="/admin/coaches" label="Pelatih" />
      <PageHeader title={<>Undang Pelatih</>} />
      <CoachForm />
    </div>
  );
}
