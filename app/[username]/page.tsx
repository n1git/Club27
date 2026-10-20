import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sendFriendRequest } from "@/lib/actions/social";
import { getReadyClubTypes } from "@/lib/club-type";
import { lookupProfile, type ProfileRelation } from "@/lib/data/public-profile";
import { getProfilePosts } from "@/lib/data/social";
import { pageMetadata } from "@/lib/seo";
import { APP_NAME } from "@/lib/config";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { PersonalLayout } from "@/components/personal/personal-layout";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader, SkipLink } from "@/components/landing/landing-header";
import { ctaClass } from "@/components/landing/cta";
import { Wrap } from "@/components/landing/wrap";
import { PostCard } from "@/components/social/post-card";
import { Card, CardContent } from "@/components/ui/card";

const MISS: Metadata = { title: "Halaman tidak ditemukan", robots: { index: false } };

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await lookupProfile(username);
  if (!profile) return MISS;
  if (profile.view === "public" && profile.searchOk) {
    return pageMetadata({
      title: `${profile.fullName} (@${profile.username})`,
      description: `Profil publik ${profile.fullName} di ${APP_NAME}.`,
      path: `/${profile.username}`,
    });
  }
  return { title: `${profile.fullName} (@${profile.username})`, robots: { index: false, follow: false } };
}

const RELATION_TEXT: Record<Exclude<ProfileRelation, "none" | "self">, string> = {
  friends: "Anda berteman",
  pending_out: "Permintaan pertemanan terkirim",
  pending_in: "Orang ini mengirim permintaan pertemanan kepada Anda",
};

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await lookupProfile(username);
  if (!profile) notFound();

  if (profile.view === "public") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SkipLink />
        <LandingHeader />
        <main id="konten" className="flex flex-1 flex-col">
          <Wrap className="max-w-2xl py-12">
            <h1 className="font-display text-5xl uppercase leading-none">{profile.fullName}</h1>
            <p className="mt-2 text-lg text-muted-foreground">@{profile.username}</p>
            <p className="mt-8 text-muted-foreground">Buat akun gratis untuk berteman, mencatat latihan, dan ikut peringkat.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/signup/account" className={ctaClass("solid")}>
                Buat akun gratis
              </Link>
              <Link href="/login" className={ctaClass("line")}>
                Masuk
              </Link>
            </div>
          </Wrap>
        </main>
        <LandingFooter />
      </div>
    );
  }

  const showPosts = profile.relation === "friends" || profile.relation === "self";
  const [posts, clubTypes] = showPosts
    ? await Promise.all([getProfilePosts(profile.viewerId, profile.username), getReadyClubTypes()])
    : [[], []];
  const sportLabels = Object.fromEntries(clubTypes.map((t) => [t.code, t.name.replace(/^Klub\s+/, "")]));

  return (
    <PersonalLayout>
      <div className="flex max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">{profile.fullName}</h1>
          <p className="text-muted-foreground">@{profile.username}</p>
        </header>
        {profile.relation === "none" ? (
          <ActionForm action={sendFriendRequest} className="flex">
            <input type="hidden" name="username" value={profile.username} />
            <ActionSubmitButton>Tambah teman</ActionSubmitButton>
          </ActionForm>
        ) : profile.relation === "self" ? (
          <Link href="/profile" className="text-sm font-semibold underline underline-offset-4">
            Ubah profil
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            {RELATION_TEXT[profile.relation]}.{" "}
            <Link href="/friends" className="font-semibold text-foreground underline underline-offset-4">
              Kelola teman
            </Link>
          </p>
        )}
        {showPosts ? (
          posts.length ? (
            <div className="flex flex-col gap-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} sportLabels={sportLabels} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5 text-sm text-muted-foreground">Belum ada postingan.</CardContent>
            </Card>
          )
        ) : null}
      </div>
    </PersonalLayout>
  );
}

export const unstable_dynamicStaleTime = 0;
