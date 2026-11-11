"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";

/** What the server says after creating or re-inviting a staff member. */
export interface InviteResult {
  name: string;
  emailed: boolean;
  /** Only present when the email could not be sent. */
  inviteUrl: string | null;
}

/**
 * Shown when a set-password link could not be emailed (no email provider yet):
 * the admin copies the link and sends it to the person themselves.
 */
export function InviteLinkNotice({
  result,
  onClose,
}: {
  result: InviteResult | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = result?.inviteUrl ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  return (
    <Modal
      open={!!result?.inviteUrl}
      onClose={onClose}
      title={`Send ${result?.name ?? "them"} this link`}
      description="Email is not set up yet, so the invitation could not be sent automatically. Send this link yourself. It lets them choose a password, works once and expires in 7 days."
      className="max-w-lg"
    >
      <pre
        tabIndex={0}
        aria-label="Set-password link"
        className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-muted p-4 text-xs leading-relaxed"
      >
        {url}
      </pre>
      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/** Toast for the normal case, where the email went out. */
export function announceInvite(result: InviteResult, created: boolean) {
  if (result.emailed) {
    toast.success(
      created
        ? `${result.name} was added and emailed a link to set their password.`
        : `A sign-in link was emailed to ${result.name}.`
    );
  } else if (created) {
    toast.success(`${result.name} was added.`);
  }
}
