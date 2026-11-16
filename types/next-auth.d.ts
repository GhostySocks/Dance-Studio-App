import { UserRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    role: UserRole;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      /** Has a teacher profile (a teacher, or an administrator who also teaches) */
      teaches: boolean;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    teaches?: boolean;
  }
}
