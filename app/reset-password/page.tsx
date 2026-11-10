import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { isAccountTokenValid } from "@/lib/db/account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string | string[] };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  const valid = token ? await isAccountTokenValid("reset", token) : false;

  if (!valid) {
    return (
      <AuthCard title="This link has expired">
        <p className="text-center text-sm text-muted-foreground">
          Reset links work once and last for 1 hour.
        </p>
        <p className="text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
