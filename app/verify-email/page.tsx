import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { AuthCard } from "@/components/auth-card";
import { LinkButton } from "@/components/link-button";
import { authOptions } from "@/lib/auth";
import { consumeAccountToken, markEmailVerified } from "@/lib/db/account";
import { portalHome } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string | string[] };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  const [email, session] = await Promise.all([
    token ? consumeAccountToken("verify", token) : null,
    getServerSession(authOptions),
  ]);
  if (email) await markEmailVerified(email);

  const next = session ? portalHome(session.user.role) : "/login";

  return (
    <AuthCard title={email ? "Email confirmed" : "This link is no longer active"}>
      <p className="text-center text-sm text-muted-foreground">
        {email
          ? "Thanks, your email address is confirmed."
          : "It has already been used or has expired. If you already confirmed your email, you are all set. Otherwise, sign in to send yourself a new link."}
      </p>
      <div className="flex justify-center">
        <LinkButton href={next} className="h-10 px-5">
          {session ? "Go to my dashboard" : "Sign in"}
        </LinkButton>
      </div>
    </AuthCard>
  );
}
