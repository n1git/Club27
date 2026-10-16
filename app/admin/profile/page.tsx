import { ProfilePage } from "@/components/profile/profile-page";

export default function AdminProfilePage() {
  return <ProfilePage roles={["owner", "staff"]} />;
}
