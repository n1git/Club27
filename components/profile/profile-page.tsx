import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import type { AppRole } from "@/lib/auth/roles";
import { getProfileData } from "@/lib/data/profile";
import { getOwnAvatarUrl } from "@/lib/data/social";
import { isSocialBanned } from "@/lib/auth/social-access";
import { ProfileView } from "./profile-view";

export async function ProfilePage({ roles }: { roles: AppRole[] }) {
  const user = await requireRole(roles);
  const data = await getProfileData(user.accountId);
  if (!data) notFound();
  const showAvatar = user.role === "personal" && !(await isSocialBanned(user.accountId));
  return <ProfileView data={data} avatar={showAvatar ? { url: await getOwnAvatarUrl(user.accountId) } : null} />;
}
