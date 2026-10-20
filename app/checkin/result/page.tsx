import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/data/tenant";
import { getCheckinById } from "@/lib/data/checkin";
import { CHECKIN_RESULT_MESSAGE } from "@/lib/checkin";
import { formatJakartaDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default async function CheckinResultPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; c?: string; a?: string }>;
}) {
  const params = await searchParams;
  await requireRole("member");
  const code = params.r ?? "ERROR";
  const success = code === "OK";
  const [tenant, checkin] = await Promise.all([
    success ? getCurrentTenant() : Promise.resolve(null),
    success && params.c ? getCheckinById(params.c) : Promise.resolve(null),
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card frame={false} className="w-full max-w-sm text-center">
        <CardHeader className="items-center gap-3">
          {success ? (
            <CheckCircle2 className="size-14 text-success" aria-hidden />
          ) : (
            <XCircle className="size-14 text-destructive" aria-hidden />
          )}
          <CardTitle className="text-2xl" role="status">
            {success ? (params.a === "1" ? "Sudah check-in" : "Check-in berhasil") : "Check-in gagal"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {success ? (
            <div className="text-sm text-muted-foreground">
              {tenant ? <p className="font-medium text-foreground">{tenant.name}</p> : null}
              {checkin ? (
                <>
                  <p>{formatJakartaDateTime(checkin.checkedInAt)}</p>
                  {checkin.planName ? <p>Paket: {checkin.planName}</p> : null}
                </>
              ) : null}
              {params.a === "1" ? <p>Anda sudah tercatat dalam 2 jam terakhir.</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{CHECKIN_RESULT_MESSAGE[code] ?? CHECKIN_RESULT_MESSAGE.ERROR}</p>
          )}
          <div className="flex flex-col gap-2">
            <Link href="/member/visits" className={buttonVariants({ className: "w-full" })}>
              Lihat kunjungan
            </Link>
            <Link href="/member" className={buttonVariants({ variant: "outline", className: "w-full" })}>
              Beranda
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
