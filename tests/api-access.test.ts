import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards against an API handler that only checks "is someone signed in". The
 * pages are protected by middleware, but a parent or student can still call any
 * API address directly, so every handler must check the role or scope the data
 * to the signed-in user.
 */

const API_DIR = join(process.cwd(), "app", "api");

/** Handlers that are meant to work without a role check, and what protects them instead. */
const PUBLIC: Record<string, string> = {
  "account/forgot-password POST": "public, rate limited",
  "account/reset-password POST": "public, single-use token",
  "register POST": "public sign-up, rate limited",
  "health GET": "platform health check",
  "webhooks/stripe POST": "Stripe signature",
  "auth/[...nextauth] GET": "NextAuth",
  "auth/[...nextauth] POST": "NextAuth",
};

/** Any one of these in a handler means it checks who is asking. */
const CHECKS = [
  /requireAdmin\(/, // admins only
  /isAdmin\(/,
  /\["SUPER_ADMIN", "ADMIN"\]\.includes\(/,
  /requireAttendanceAccess\(/, // the class's own teacher, or an admin
  /hasRole\(/,
  /session\.user\.id/, // data looked up for the signed-in user
  /canUserAccessInvoice\(/,
  /loadOwnedAccount\(/,
];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

function handlers(file: string) {
  const source = readFileSync(file, "utf8");
  const route = relative(API_DIR, file).replace(/\\/g, "/").replace(/\/route\.ts$/, "");
  const starts = Array.from(source.matchAll(/^export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/gm));
  return starts.map((match, i) => ({
    name: `${route} ${match[1]}`,
    body: source.slice(match.index, starts[i + 1]?.index ?? source.length),
  }));
}

describe("API access", () => {
  const all = routeFiles(API_DIR).flatMap(handlers);

  it("finds the API handlers", () => {
    expect(all.length).toBeGreaterThan(60);
  });

  it("every handler checks the role or scopes to the signed-in user", () => {
    const unguarded = all
      .filter((handler) => !(handler.name in PUBLIC))
      .filter((handler) => !CHECKS.some((check) => check.test(handler.body)))
      .map((handler) => handler.name);
    expect(unguarded).toEqual([]);
  });

  it("admin records cannot be read by a parent or student", () => {
    const adminOnly = [
      "students GET",
      "students/[id] GET",
      "enrollments GET",
      "enrollments/[id] GET",
      "invoices GET",
      "invoices/[id] GET",
      "scholarships GET",
      "sessions GET",
      "sessions/[id] GET",
      "families GET",
      "families/[id] GET",
      "teachers GET",
    ];
    const adminCheck = [CHECKS[0], CHECKS[1], CHECKS[2]];
    for (const name of adminOnly) {
      const handler = all.find((h) => h.name === name);
      expect(handler, name).toBeDefined();
      expect(adminCheck.some((check) => check.test(handler!.body)), name).toBe(true);
    }
  });
});
