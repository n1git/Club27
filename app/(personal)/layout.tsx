import { PersonalLayout } from "@/components/personal/personal-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PersonalLayout>{children}</PersonalLayout>;
}
