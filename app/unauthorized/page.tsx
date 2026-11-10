import { getServerSession } from "next-auth";

import { LinkButton } from "@/components/link-button";
import { authOptions } from "@/lib/auth";
import { portalHome } from "@/lib/portal";

export const metadata = { title: "No access" };

export default async function UnauthorizedPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold">You don&apos;t have access to that page</h1>
        <p className="text-muted-foreground">
          Your account doesn&apos;t include this area. If you think that&apos;s a mistake, contact the
          studio.
        </p>
        <LinkButton href={session ? portalHome(session.user.role) : "/login"} className="h-10 px-5">
          {session ? "Back to my dashboard" : "Sign in"}
        </LinkButton>
      </div>
    </div>
  );
}
