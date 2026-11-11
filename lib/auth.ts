import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getActiveRole } from "@/lib/account-status";
import type { UserRole } from "@prisma/client";

/** Thrown from the jwt callback to end the session of a removed account. */
const ACCOUNT_REVOKED = "ACCOUNT_REVOKED";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // No password yet (invited staff) or removed by an admin: cannot sign in
        if (!user || !user.passwordHash || user.disabledAt) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Signing in: authorize() has just checked the account
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        return token;
      }

      // Every later request: is the account still there, and what is its role now?
      const role = await getActiveRole(token.id as string);
      if (!role) {
        // NextAuth treats a failing jwt callback as "no session" and clears the cookie
        throw new Error(ACCOUNT_REVOKED);
      }
      token.role = role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  logger: {
    error(code, metadata) {
      // A removed account being signed out is expected, not an error worth logging
      const message =
        metadata instanceof Error
          ? metadata.message
          : (metadata as { error?: Error } | undefined)?.error?.message;
      if (code === "JWT_SESSION_ERROR" && message === ACCOUNT_REVOKED) return;
      console.error(`[next-auth][error][${code}]`, metadata);
    },
  },
};
