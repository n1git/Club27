import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DeleteOrganizationForm } from "@/components/organization/delete-organization-form";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function DeleteOrganizationPage() {
  const owner = await requireOwner();
  const { data: org } = await createAdminSupabaseClient().from("organizations").select("name").eq("id", owner.organizationId).maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Hapus organisasi</>} />
      {owner.baseRole !== "p_owner" || !org ? (
        <p className="text-sm text-muted-foreground">Hanya pemilik utama yang dapat menghapus organisasi.</p>
      ) : (
        <>
          <Alert variant="warning">
            <AlertTitle>Yang terjadi saat Anda menghapus</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                <li>Semua klub dalam organisasi langsung tidak bisa diakses oleh siapa pun, termasuk anggota.</li>
                <li>Anda punya 30 hari untuk memulihkannya dari halaman Akun saya.</li>
                <li>Setelah 30 hari, seluruh data klub (anggota, tagihan, kasir, jadwal, log audit) dihapus permanen dan tidak bisa dikembalikan.</li>
                <li>Akun login setiap orang tetap ada; hanya data organisasi ini yang dihapus.</li>
                <li>
                  Unduh salinan datanya lebih dulu di <Link href="/admin/klub/ekspor" className="font-medium underline">Ekspor data</Link>.
                </li>
              </ul>
            </AlertDescription>
          </Alert>
          <DeleteOrganizationForm name={org.name as string} />
        </>
      )}
    </div>
  );
}
