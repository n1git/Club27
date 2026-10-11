import { ProfilePage } from "@/components/profile/profile-page";

export default function AdminProfilePage() {
  return <ProfilePage roles={["admin", "receptionist", "finance"]} />;
}
