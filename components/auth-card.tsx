import Link from "next/link";

import { StudioLogo } from "@/components/studio-logo";

/** Centered card used by the sign-in related pages (forgot/reset password, verify email). */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="mx-auto mb-4 block w-fit">
            <StudioLogo variant="stacked" alt="Boss Dance Studio home" className="h-28" priority />
          </Link>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
