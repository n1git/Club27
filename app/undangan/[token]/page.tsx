import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { AcceptInvitationButton } from "@/components/shared/accept-invitation-button";
import { AcceptInvitationNewAccount } from "@/components/shared/accept-invitation-new-account";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { findPendingInvitation } from "@/lib/accounts/invitations";
import { findAccountByEmail } from "@/lib/accounts/account";
import { getSession } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Undangan", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findPendingInvitation(token);

  if (!invitation) {
    return (
      <AuthPageShell title={APP_NAME} description="Undangan">
        <Alert variant="warning">
          <AlertDescription>Undangan ini sudah tidak berlaku. Minta undangan baru dari pengundang.</AlertDescription>
        </Alert>
      </AuthPageShell>
    );
  }

  const session = await getSession();
  const existing = await findAccountByEmail(invitation.email);
  const where =
    invitation.kind === "owner"
      ? `pemilik di ${invitation.organizationName}`
      : `${invitation.roleName ?? "staf"} di ${invitation.clubName ?? invitation.organizationName}`;
  const next = encodeURIComponent(`/undangan/${token}`);
  const matches = Boolean(session && existing && session.account_id === existing.id);

  return (
    <AuthPageShell title={APP_NAME} description={`Anda diundang sebagai ${where}`}>
      <p className="text-sm text-muted-foreground">
        Undangan untuk <strong className="text-foreground">{invitation.email}</strong>.
      </p>
      {matches ? (
        <AcceptInvitationButton token={token} />
      ) : existing ? (
        <div className="flex flex-col gap-3">
          <Alert>
            <AlertDescription>
              {session
                ? "Anda masuk dengan akun lain. Keluar lalu masuk dengan akun email di atas untuk menerima undangan."
                : "Email ini sudah punya akun. Masuk untuk menerima undangan."}
            </AlertDescription>
          </Alert>
          <Link href={`/login?next=${next}`} className={buttonVariants({ className: "w-fit" })}>
            Masuk
          </Link>
        </div>
      ) : session ? (
        <Alert>
          <AlertDescription>
            Anda sedang masuk dengan akun lain. Keluar lebih dulu untuk membuat akun baru dari undangan ini.
          </AlertDescription>
        </Alert>
      ) : (
        <AcceptInvitationNewAccount token={token} email={invitation.email} />
      )}
    </AuthPageShell>
  );
}
