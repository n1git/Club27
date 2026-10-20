import type { Metadata } from "next";
import Link from "next/link";
import { PostView } from "@/components/social/post-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Postingan", robots: { index: false } };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Postingan" />
      <PostView id={id} />
      <Link href="/" className="text-sm font-semibold underline underline-offset-4">
        Kembali ke beranda
      </Link>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
