import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import type { AppRole } from "@/lib/auth/roles";
import { getProfileData } from "@/lib/data/profile";
import { getOwnAvatarUrl, getProfileSocial } from "@/lib/data/social";
import { getReadyClubTypes } from "@/lib/club-type";
import { isSocialBanned } from "@/lib/auth/social-access";
import { ProfileView } from "./profile-view";

export async function ProfilePage({ roles }: { roles: AppRole[] }) {
  const user = await requireRole(roles);
  const data = await getProfileData(user.accountId);
  if (!data) notFound();
  const showAvatar = user.role === "personal" && !(await isSocialBanned(user.accountId));
  if (!showAvatar) return <ProfileView data={data} avatar={null} />;
  const [url, social, clubTypes] = await Promise.all([getOwnAvatarUrl(user.accountId), getProfileSocial(data.account.username), getReadyClubTypes()]);
  const sportLabels = Object.fromEntries(clubTypes.map((t) => [t.code, t.name.replace(/^Klub\s+/, "")]));
  return <ProfileView data={data} avatar={{ url, social, sportLabels }} />;
}
