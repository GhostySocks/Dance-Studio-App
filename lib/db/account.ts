import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

export type AccountTokenKind = "reset" | "verify";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const identifier = (kind: AccountTokenKind, email: string) => `${kind}:${email.toLowerCase()}`;

/**
 * Issues a single-use token for a password reset or email verification link.
 * Only the SHA-256 hash is stored, so a database leak does not expose usable links.
 * Any earlier token of the same kind for that email is replaced.
 */
export async function createAccountToken(kind: AccountTokenKind, email: string, ttlMs: number) {
  const token = randomBytes(32).toString("base64url");
  const id = identifier(kind, email);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: id } }),
    prisma.verificationToken.create({
      data: { identifier: id, token: hash(token), expires: new Date(Date.now() + ttlMs) },
    }),
  ]);
  return token;
}

/** Redeems a token. Returns the email it was issued for, or null if invalid or expired. */
export async function consumeAccountToken(kind: AccountTokenKind, token: string) {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hash(token) },
    select: { identifier: true, expires: true },
  });
  if (!record || !record.identifier.startsWith(`${kind}:`)) return null;

  // deleteMany so two simultaneous requests cannot both redeem it
  const deleted = await prisma.verificationToken.deleteMany({ where: { token: hash(token) } });
  if (deleted.count === 0 || record.expires < new Date()) return null;

  return record.identifier.slice(kind.length + 1);
}

/** Without redeeming it, is this token currently valid? */
export async function isAccountTokenValid(kind: AccountTokenKind, token: string) {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hash(token) },
    select: { identifier: true, expires: true },
  });
  return !!record && record.identifier.startsWith(`${kind}:`) && record.expires >= new Date();
}

/** An account that can still be used. Removed staff get no reset links. */
export async function getAccountByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase(), disabledAt: null },
    select: { id: true, name: true, email: true, emailVerified: true },
  });
}

export async function getAccountById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, emailVerified: true },
  });
}

/** Sets a new password. Using the emailed link also proves the address, so it is verified too. */
export async function resetPassword(email: string, passwordHash: string) {
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash, emailVerified: new Date() },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "PASSWORD_RESET", entityType: "User", entityId: user.id },
  });
}

export async function markEmailVerified(email: string) {
  const result = await prisma.user.updateMany({
    where: { email, emailVerified: null },
    data: { emailVerified: new Date() },
  });
  return result.count > 0;
}
