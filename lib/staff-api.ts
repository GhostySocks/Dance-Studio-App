import { Prisma } from "@prisma/client";

import { sendStaffInvite } from "@/lib/email";

export const EMAIL_IN_USE = "An account with this email already exists.";

export function isDuplicateEmail(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Sends the set-password link. The link itself is only handed back to the admin
 * when the email could not be sent, so they can deliver it another way.
 */
export async function inviteStaff(user: { email: string; name: string }, roleLabel: string) {
  const invite = await sendStaffInvite(user, roleLabel);
  return { emailed: invite.sent, inviteUrl: invite.sent ? null : invite.url };
}
