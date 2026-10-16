import { redirect } from "next/navigation";
import { requirePermission } from "./guard";

export async function requireHeadCoach() {
  const user = await requirePermission("teaching.portal");
  if (!user.permissions.has("members.view_all")) redirect("/coach");
  return user;
}
