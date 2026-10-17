import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function OnboardingBanner() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("clubs").select("onboarding_completed_at").maybeSingle();
  if (!data || data.onboarding_completed_at) return null;

  return (
    <Alert>
      <AlertTitle>Selesaikan penyiapan klub</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>Tambahkan lokasi, fasilitas, dan paket pertama agar klub siap dipakai. Setiap langkah bisa dilewati.</span>
        <Link href="/admin/onboarding" className={buttonVariants({ size: "sm", className: "w-fit" })}>
          Lanjutkan penyiapan
        </Link>
      </AlertDescription>
    </Alert>
  );
}
