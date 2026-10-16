import { notFound } from "next/navigation";
import { requireRole, requireValidSession } from "@/lib/auth/guard";
import type { AppRole } from "@/lib/auth/roles";
import { getProfileData } from "@/lib/data/profile";
import { ProfileView } from "./profile-view";

export async function ProfilePage({ roles }: { roles: AppRole[] }) {
  await requireRole(roles);
  const { profile, session } = await requireValidSession();
  const data = await getProfileData({
    profileId: profile.id,
    accountId: profile.accountId,
    ownerId: profile.ownerId,
    memberAccountId: profile.memberAccountId,
    personal: session.app_role === "personal",
  });
  if (!data) notFound();
  return <ProfileView data={data} />;
}
