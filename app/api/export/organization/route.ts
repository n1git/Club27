import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkSession } from "@/lib/auth/guard";
import { loadOwner } from "@/lib/auth/owner";
import { isKeyRateLimited } from "@/lib/auth/rate-limit";
import { isCrossSite } from "@/lib/auth/request";
import { REAUTH_ERROR, verifyReauth } from "@/lib/auth/reauth";
import { buildOrganizationExport } from "@/lib/export/organization";
import { logAudit } from "@/lib/audit";

const PAGE = "/admin/klub/ekspor";

function back(request: Request, error: string) {
  return NextResponse.redirect(new URL(`${PAGE}?galat=${error}`, request.url), 303);
}

export async function POST(request: Request) {
  if (isCrossSite(request)) return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  const session = await getSession();
  if (!session || session.app_role !== "owner") return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const check = await checkSession(session);
  if (!check.ok || check.mustChangePassword) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  const owner = await loadOwner(session.sub, session.tenant_id);
  if (!owner) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return back(request, "data");
  if (await isKeyRateLimited(`export:${owner.accountId}`, 3, 3600, true)) return back(request, "batas");
  const reauth = await verifyReauth(owner.accountId, form.get("confirmPassword"));
  if (reauth) return back(request, reauth === REAUTH_ERROR ? "sandi" : "batas");

  let file: Awaited<ReturnType<typeof buildOrganizationExport>>;
  try {
    file = await buildOrganizationExport(owner.organizationId);
  } catch {
    return back(request, "gagal");
  }
  await logAudit({
    action: "organization.export",
    targetType: "organization",
    targetId: owner.organizationId,
    tenantId: owner.tenantId,
    organizationId: owner.organizationId,
    actorId: owner.profileId,
    actorRole: "owner",
  });
  return new Response(new Uint8Array(file.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
