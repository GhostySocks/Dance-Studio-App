# CLAUDE.md — Dance Studio Management Platform

This file is the persistent project bible for Claude Code. Read this at the start of every session before writing any code. It contains all conventions, decisions, and context needed to work on this codebase consistently.

---

## Project Overview

A full-stack SaaS web application for dance studios. It serves four user roles:
- **Admin/Owner** — full access: CRM, scheduling, billing, financials, stats
- **Teacher** — limited access: own classes, attendance marking, student roster view
- **Parent/Guardian** — portal: enroll children, view schedule, pay invoices
- **Student (adult)** — portal: self-enroll, view schedule, pay invoices

The app also has a **public-facing website** (homepage, schedule, class detail, registration) and an **embeddable schedule widget** for external websites.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 + shadcn/ui v4 (built on `@base-ui/react`: use the `render` prop, not `asChild`) |
| State | Zustand (global) + TanStack Query (server state) |
| Animation | Motion (motion.dev) |
| Forms | React Hook Form + Zod |
| ORM | Prisma 5 (not v7) |
| Database | PostgreSQL (Supabase or Neon) |
| Auth | NextAuth.js v4 (credentials provider, JWT sessions) — not Auth.js v5 |
| Payments | Stripe (Checkout, PaymentIntents, Webhooks) |
| Email | Resend + React Email |
| PDF | @react-pdf/renderer |
| Calendar UI | FullCalendar (React) |
| Charts | Recharts |
| Background Jobs | Inngest or Vercel Cron |
| Hosting | Vercel |
| Storage | Supabase Storage |
| Error Tracking | Sentry |

---

## Folder Structure

```
/
├── app/
│   ├── (public)/               # No auth required
│   │   ├── page.tsx            # Homepage
│   │   ├── schedule/page.tsx
│   │   ├── classes/[id]/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (app)/                  # Auth required
│   │   ├── admin/              # ADMIN role only
│   │   │   ├── dashboard/
│   │   │   ├── students/
│   │   │   ├── families/
│   │   │   ├── teachers/
│   │   │   ├── classes/
│   │   │   ├── rooms/
│   │   │   ├── schedule/
│   │   │   ├── billing/
│   │   │   ├── scholarships/
│   │   │   └── reports/
│   │   ├── teacher/            # TEACHER role only
│   │   │   ├── dashboard/
│   │   │   ├── classes/
│   │   │   └── attendance/
│   │   ├── parent/             # PARENT role only
│   │   │   ├── dashboard/
│   │   │   ├── students/
│   │   │   ├── schedule/
│   │   │   └── billing/
│   │   ├── student/            # STUDENT role only (adult, self-paying)
│   │   │   ├── dashboard/
│   │   │   ├── schedule/
│   │   │   └── billing/
│   │   └── layout.tsx          # App shell with sidebar
│   ├── api/
│   │   ├── auth/
│   │   ├── students/
│   │   ├── classes/
│   │   ├── enrollment/
│   │   ├── attendance/
│   │   ├── invoices/
│   │   ├── payments/
│   │   ├── register/           # Public sign-up (no session; rate limited)
│   │   ├── portal/enrollments/ # Parent/student self-enrollment
│   │   ├── cron/billing/       # Nightly overdue + auto-pay job
│   │   └── webhooks/stripe/
│   ├── login/
│   ├── unauthorized/
│   └── widget/                 # Embeddable iframe page
├── components/
│   ├── ui/                     # shadcn/ui primitives (do not edit)
│   ├── forms/                  # Reusable form components
│   ├── public/                 # Public-site pieces (schedule browser, session row, motion wrappers)
│   ├── portal/                 # Views shared by the parent and student portals
│   ├── tables/                 # Data table components
│   ├── charts/                 # Recharts wrappers
│   ├── calendar/               # FullCalendar wrappers
│   └── pdf/                    # React PDF invoice templates
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # NextAuth config + helpers
│   ├── stripe.ts               # Stripe client singleton
│   ├── email.ts                # Resend email helpers
│   ├── billing.ts              # Invoice generation + pricing logic
│   ├── permissions.ts          # RBAC helper functions
│   └── db/                     # Repository functions (DB access layer)
│       ├── students.ts
│       ├── classes.ts
│       ├── enrollment.ts
│       ├── attendance.ts
│       ├── invoices.ts
│       ├── families.ts
│       ├── public.ts           # Public site + widget queries (counts only, never student data)
│       └── registration.ts     # Self-service account creation
├── types/                      # Global TypeScript types and enums
├── hooks/                      # Custom React hooks
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── emails/                     # React Email templates
├── .env.local
├── next.config.ts
└── tailwind.config.ts
```

---

## Critical Coding Conventions

Follow these on every file, every session, without exception.

### Money
- **All monetary values are stored as integers in cents.** $25.00 = `2500`. Never store floats for money.
- Use a `formatCurrency(cents: number)` utility for display. Create this in `lib/utils.ts` if it doesn't exist.
- Use banker's rounding when computing discounts and totals.

### Dates & Timezones
- All dates stored as UTC in the database.
- Display dates in the studio's local timezone on the client using `Intl.DateTimeFormat` or `date-fns-tz`.
- Never do timezone math on the server unless explicitly needed.

### TypeScript
- Strict mode is enabled. No `any`. No `// @ts-ignore` unless absolutely unavoidable and commented.
- Infer Prisma types using `Prisma.StudentGetPayload<...>` — do not manually redeclare DB types.
- All Zod schemas live alongside their API route or in a shared `lib/validations/` file.

### Database Access
- **All Prisma calls happen server-side only** — in Server Components, Server Actions, or API Route Handlers.
- Never import Prisma in a client component.
- The Prisma client caps its pool at 5 connections (`lib/prisma.ts`) because the Supabase session pooler allows 15 in total.
- All DB access functions live in `lib/db/*.ts`. API routes call these functions; they do not contain raw Prisma queries themselves.
- Always use `select` or `include` explicitly — avoid fetching entire models when only a subset is needed.

### API Routes
- Every API route handler must:
  1. Call `getServerSession()` and verify the user's role before doing anything else.
  2. Validate the request body with a Zod schema.
  3. Call a function from `lib/db/` for the actual DB operation.
  4. Return consistent JSON: `{ data: ... }` on success, `{ error: "message" }` on failure.
- Use HTTP status codes correctly: 200, 201, 400, 401, 403, 404, 500.

### Forms
- All forms use **React Hook Form** with a **Zod resolver**.
- Form submission calls a Server Action or a `fetch` to an API route — not both.
- Show loading state on submit button. Disable on submit. Show toast on success/error.

### Public site
- Public pages and the widget read data only through `lib/db/public.ts`. Those functions return class/session info and spot counts — never student, family or enrollment records.
- Public pages are `force-dynamic` (set in `app/(public)/layout.tsx`) so availability is live and builds do not need the database.
- Dates on public pages are formatted in the studio timezone with the helpers in `lib/schedule-format.ts`.
- `/api/register` only ever creates PARENT or STUDENT accounts; the role is decided on the server.
- Role → landing page mapping lives in `lib/portal.ts` (`portalHome`).

### Components
- Server Components by default. Add `"use client"` only when needed (event handlers, hooks, browser APIs).
- shadcn/ui components are in `components/ui/` — do not modify them directly. Wrap them if customization is needed. (Exception already made: `Input` and `Textarea` use `forwardRef`, because on React 18 react-hook-form's `register()` needs the ref.)
- For navigation that looks like a button use `components/link-button.tsx` (`LinkButton`), not `<Button render={<Link />}>`, so it stays a real link for screen readers.
- All data tables must have pagination, search, and at least one filter. Use TanStack Table.

### Auth & Permissions
- Use `getServerSession(authOptions)` in every server component and API route that needs auth.
- Role checks use helpers from `lib/permissions.ts`: e.g., `requireRole(session, 'ADMIN')`.
- Middleware in `middleware.ts` handles route-level protection as a first line of defense.
- Never trust client-sent role claims — always re-verify from the session on the server.

### Animation (Motion)
- Library: `motion` (motion.dev). Install: `npm install motion`. Import: `import { motion, AnimatePresence } from 'motion/react'`
- **Motion components require `"use client"`** — never use in Server Components. Create a thin client wrapper if needed.
- Define all reusable animation variants in `lib/motion.ts` and import from there — never hardcode animation values inline.
- Standard variants to define in `lib/motion.ts`:
  ```ts
  export const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }
  export const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }
  export const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } } }
  export const staggerContainer = { visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }
  export const slideInRight = { hidden: { opacity: 0, x: 24 }, visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } } }
  ```
- Use `AnimatePresence` for anything that conditionally mounts/unmounts: modals, drawers, toasts, empty states, dropdown menus.
- Use the `layout` prop on list items so additions/removals animate smoothly.
- Always use `useReducedMotion()` hook and conditionally disable or minimize animations when it returns `true`.
- **Where to apply animations:** page transitions, dashboard stat card stagger reveals, modal/drawer enters, table row additions, sidebar navigation highlights, empty state illustrations, notification toasts.
- **Where NOT to animate:** data tables while loading (use skeleton loaders instead), form validation errors (instant feedback is better UX), anything that runs more than ~3 times per second.


- Wrap all async server operations in try/catch.
- Log errors to Sentry in production.
- Never expose raw error messages or stack traces to the client.

---

## Database Schema — Entity Summary

| Model | Key Fields |
|---|---|
| User | id, email, name, role (SUPER_ADMIN / ADMIN / TEACHER / PARENT / STUDENT) |
| StudioProfile | id, name, logo, timezone, billingCycleDay |
| Student | id, firstName, lastName, dob, familyGroupId, guardianId, userId? |
| Guardian | id, userId, students[], familyGroups[] |
| FamilyGroup | id, name, students[], guardians[], invoices[] |
| Teacher | id, userId, bio, specialties[] |
| Room | id, name, description, capacity |
| ClassTemplate | id, name, description, style, level, defaultDurationMins, basePriceCents |
| ClassSession | id, templateId, teacherId, roomId, startTime, endTime, maxCapacity, isRecurring |
| Enrollment | id, studentId, sessionId, status (ACTIVE / WAITLIST / CANCELLED) |
| Attendance | id, enrollmentId, sessionId, status (PRESENT / ABSENT / LATE / EXCUSED) |
| Invoice | id, studentId?, familyGroupId?, periodStart, periodEnd, status, totalCents |
| InvoiceLineItem | id, invoiceId, description, amountCents, type (TUITION / DISCOUNT / SCHOLARSHIP / FEE) |
| Payment | id, invoiceId, amountCents, stripePaymentIntentId, status |
| Scholarship | id, name, studentId?, familyGroupId?, type (PERCENT / FIXED / WAIVER), value, startDate, endDate |
| PricingRule | id, studioId?, familyGroupId?, name, triggerCount, discountType, discountValue |
| AuditLog | id, actorId, action, entityType, entityId, meta (JSON), createdAt |

---

## Key Business Logic (implement exactly as described)

### Family Pricing Engine (`lib/billing.ts`)
When generating an invoice for a FamilyGroup:
1. Collect all ACTIVE enrollments for all students in the family for the billing period.
2. Sort enrollments by `basePriceCents` descending (most expensive first).
3. Apply full base price to enrollment[0].
4. For enrollment[1+], evaluate PricingRules for this family group (or global rules).
5. Rule types: `PERCENT_OFF` (e.g., 50% off), `FIXED_PRICE` (e.g., always $50), `FAMILY_CAP` (total family bill never exceeds $X).
6. Apply scholarship credits as negative `InvoiceLineItem` records after discounts.
7. All amounts in cents. Round with `Math.round()`.

### Enrollment Capacity Check (`lib/db/enrollment.ts`)
```typescript
const count = await prisma.enrollment.count({
  where: { sessionId, status: 'ACTIVE' }
});
if (count >= session.maxCapacity) {
  // return { success: false, waitlist: true }
}
```
Admin can bypass with an explicit `force: true` flag.

### Attendance Locking Rules
- Attendance is editable by teacher until they call the submit endpoint.
- After submission, `Attendance.lockedAt` is set.
- Only users with role ADMIN or SUPER_ADMIN can call the unlock endpoint.
- Every lock/unlock action writes to AuditLog.

### Invoice Status Flow
```
DRAFT -> SENT -> PAID
             -> OVERDUE (set by cron if past due date and unpaid)
DRAFT -> VOID
SENT  -> VOID
```

### Stripe Webhook Events to Handle
- `payment_intent.succeeded` → mark Payment PAID, mark Invoice PAID, send receipt email
- `payment_intent.payment_failed` → mark Payment FAILED, send failure notification
- `customer.subscription.deleted` → disable auto-pay flag on FamilyGroup/Student, notify admin
- All webhook events must verify the Stripe signature before processing.

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET=""

# Stripe
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourstudio.com"

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

# App
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NEXT_PUBLIC_STUDIO_SLUG="my-dance-studio"
```

---

## Build Phases — Current Status

Update this section as phases are completed.

- [x] **Phase 1** — Project init, Prisma schema, NextAuth, layout shell, seed data
- [x] **Phase 2** — Student CRM, Guardian management, FamilyGroup, Teacher profiles
- [x] **Phase 3** — Room CRUD, Class Templates, Class Session scheduler, FullCalendar
- [x] **Phase 4** — Enrollment management, capacity/waitlist logic, confirmation emails
- [x] **Phase 5** — Attendance tracking, teacher submit/lock, admin reports
- [x] **Phase 6** — Pricing rules, invoice generation engine, scholarship system, PDF invoices
- [x] **Phase 7** — Stripe integration, parent payment portal, auto-pay, webhooks
- [x] **Phase 8** — Financial P&L dashboard, admin stats, utilization reports, CSV export
- [x] **Phase 9** — Public website (homepage, schedule, class detail, registration flow), plus the student portal
- [ ] **Phase 10** — Embeddable widget (built: `/widget`), QA, accessibility, production deploy (not done)

Still open across phases: Stripe and Resend have only been run with placeholder keys (card payments, auto-pay charges, webhooks and email delivery are untested end to end); Sentry is not installed; sign-up has no email verification or password reset.

---

## How to Start a Session

When starting a new Claude Code session, open with something like:

> "Read CLAUDE.md. We are on Phase [X]. [Phase X-1] is complete. Today we are implementing [specific feature]. Here is what already exists: [brief summary]."

This gives Claude the context needed to write consistent, correctly structured code immediately.

---

## Common Commands

```bash
# Start dev server
npm run dev

# Run Prisma migrations after schema changes
npx prisma migrate dev --name <migration-name>

# Regenerate Prisma client after schema changes
npx prisma generate

# Seed the database
npx prisma db seed

# Open Prisma Studio (DB browser)
npx prisma studio

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

*Keep this file updated as architectural decisions are made. It is the single source of truth for Claude Code sessions on this project.*
