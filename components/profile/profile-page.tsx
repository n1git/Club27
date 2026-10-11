import { notFound } from "next/navigation";
import { requireRole, requireValidSession } from "@/lib/auth/guard";
import type { AppRole } from "@/lib/auth/roles";
import { getProfileData } from "@/lib/data/profile";
import { ProfileView } from "./profile-view";

export async function ProfilePage({ roles }: { roles: AppRole[] }) {
  await requireRole(roles);
  const { profile } = await requireValidSession();
  const data = await getProfileData({ profileId: profile.id, ownerId: profile.ownerId, memberAccountId: profile.memberAccountId });
  if (!data) notFound();
  return <ProfileView data={data} />;
}
