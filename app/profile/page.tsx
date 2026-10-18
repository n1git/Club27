import { ProfilePage } from "@/components/profile/profile-page";
import { APP_ROLES } from "@/lib/auth/roles";

export default function ProfileRoutePage() {
  return <ProfilePage roles={APP_ROLES} />;
}
