import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getReadyClubTypes } from "@/lib/club-type";
import { getPost } from "@/lib/data/social";
import { PostCard } from "./post-card";

export async function PostView({ id }: { id: string }) {
  const user = await requireRole("personal");
  if (await isSocialBanned(user.accountId)) notFound();
  const [post, clubTypes] = await Promise.all([getPost(user.accountId, id), getReadyClubTypes()]);
  if (!post) notFound();
  const sportLabels = Object.fromEntries(clubTypes.map((t) => [t.code, t.name.replace(/^Klub\s+/, "")]));
  return <PostCard post={post} sportLabels={sportLabels} permalink />;
}
