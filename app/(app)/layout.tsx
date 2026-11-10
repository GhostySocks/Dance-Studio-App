"use client";

import { useSession, SessionProvider } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AppSidebar } from "@/components/app-sidebar";
import { UserNav } from "@/components/user-nav";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { cn } from "@/lib/utils";
import { fadeIn, fadeUp } from "@/lib/motion";

function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const reduceMotion = useReducedMotion();

  // A 16rem sidebar leaves no room for content on a phone
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setCollapsed(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.div
          role="status"
          variants={fadeIn}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="flex flex-col items-center gap-3"
        >
          <div className="h-10 w-10 rounded-xl bg-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppSidebar
        role={session.user.role}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-white px-4 sm:px-6">
          <div className="flex-1" />
          <UserNav user={session.user} />
        </header>
        <main id="main" className="mx-auto max-w-7xl p-4 sm:p-6">
          {(session.user.role === "PARENT" || session.user.role === "STUDENT") && <VerifyEmailBanner />}
          <motion.div variants={fadeUp} initial={reduceMotion ? false : "hidden"} animate="visible">
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
