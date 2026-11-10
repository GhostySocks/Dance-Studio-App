import Link from "next/link";

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
          <Link
            href="/"
            aria-label="Home"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground"
          >
            DS
          </Link>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
