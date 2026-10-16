import { redirect } from "next/navigation";
import { permissionsFor, requireValidSession } from "@/lib/auth/guard";
import { ADMIN_AREA_PERMISSIONS, hasAny } from "@/lib/auth/permissions";
import { profilePath } from "@/lib/auth/roles";

export default async function ProfileRedirectPage() {
  const { session, mustChangePassword } = await requireValidSession();
  if (mustChangePassword) redirect("/change-password");
  const teachingOnly = session.app_role === "staff" && !hasAny(await permissionsFor(session), ADMIN_AREA_PERMISSIONS);
  redirect(profilePath(session.app_role, teachingOnly));
}
