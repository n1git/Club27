import { redirect } from "next/navigation";
import { requireValidSession } from "@/lib/auth/guard";
import { profilePath } from "@/lib/auth/roles";

export default async function ProfileRedirectPage() {
  const { session, mustChangePassword } = await requireValidSession();
  redirect(mustChangePassword ? "/change-password" : profilePath(session.app_role));
}
