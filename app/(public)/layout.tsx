import Link from "next/link";
import { getServerSession } from "next-auth";

import { LinkButton } from "@/components/link-button";
import { StudioLogo } from "@/components/studio-logo";
import { authOptions } from "@/lib/auth";
import { getPublicStudio } from "@/lib/db/public";
import { portalHome } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [studio, session] = await Promise.all([getPublicStudio(), getServerSession(authOptions)]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center">
            <StudioLogo alt={studio.name} className="h-8 sm:h-10" priority />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/classes"
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Classes
            </Link>
            <Link
              href="/schedule"
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Schedule
            </Link>
            {session ? (
              <LinkButton href={portalHome(session.user.role)} className="h-9 px-4">
                My account
              </LinkButton>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Sign in
                </Link>
                <LinkButton href="/register" variant="cta" className="h-9 px-4">
                  Register
                </LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <StudioLogo alt={studio.name} className="h-8 self-start sm:self-auto" />
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {studio.address && <span>{studio.address}</span>}
            {studio.phone && <a href={`tel:${studio.phone}`} className="hover:text-foreground">{studio.phone}</a>}
            {studio.email && (
              <a href={`mailto:${studio.email}`} className="hover:text-foreground">
                {studio.email}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
