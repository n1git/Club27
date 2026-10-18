import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import type { AppRole } from "@/lib/auth/roles";
import { getProfileData } from "@/lib/data/profile";
import { ProfileView } from "./profile-view";

export async function ProfilePage({ roles }: { roles: AppRole[] }) {
  const user = await requireRole(roles);
  const data = await getProfileData(user.accountId);
  if (!data) notFound();
  return <ProfileView data={data} />;
}
