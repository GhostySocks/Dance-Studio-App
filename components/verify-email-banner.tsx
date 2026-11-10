"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fadeIn } from "@/lib/motion";

/** Shown to parents and students until they confirm their email address. */
export function VerifyEmailBanner() {
  const [unverified, setUnverified] = useState(false);
  const [sending, setSending] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/verify-email")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.data?.verified === false) setUnverified(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function resend() {
    setSending(true);
    try {
      const res = await fetch("/api/account/verify-email", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not send the link");
      } else if (json?.data?.verified) {
        setUnverified(false);
      } else {
        toast.success("Confirmation link sent. Check your inbox.");
      }
    } catch {
      toast.error("Could not send the link. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {unverified && (
        <motion.div
          role="status"
          variants={fadeIn}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          exit={reduceMotion ? undefined : "hidden"}
          className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-domain-money px-4 py-3 text-sm text-domain-money-foreground"
        >
          <MailWarning className="h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1">Please confirm your email address so invoices and class updates reach you.</p>
          <Button variant="outline" size="sm" onClick={resend} disabled={sending}>
            {sending ? "Sending…" : "Send confirmation link"}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
