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
| Background Jobs | In-process scheduler (`instrumentation.ts` → `lib/billing-scheduler.ts`), once per UTC day |
| Hosting | Railway (single always-on Node service; see `docs/DEPLOY.md`) |
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
│   │   ├── account/            # Forgot/reset password, email verification
│   │   ├── studio/             # Studio settings (admin)
│   │   ├── terms/, seasons/    # Terms (semesters) and seasons (admin)
│   │   ├── registrations/      # Whole-term registrations
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
- **Database round trips are the main cost of a request** (each is roughly 20 ms from a dev machine, more than the query itself). So: `relationJoins` is enabled in `schema.prisma`, which loads `include`/nested `select` in one JOINed query instead of one query per relation; run independent queries with `Promise.all`; never query inside a loop (fetch once, group in memory); and wrap per-request lookups used by a layout, page and metadata in React `cache()`.
- The studio profile is cached in memory for 60 seconds (`lib/studio-cache.ts`) and cleared when settings are saved. Read it through `getStudioInfo()` / `getPublicStudio()`, not directly.
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
- **Mark every required field**: put `<RequiredMark />` (from `components/required-mark.tsx`) inside the label after its text, add `aria-required="true"` to the input, and put one `<RequiredNote />` at the top of the form. Optional fields are left unmarked (or say "(optional)"). Sign-in, forgot-password and reset-password forms are the exception: every field is required, so they carry no markers.

### Public site
- Public pages and the widget read data only through `lib/db/public.ts`. Those functions return class/session info and spot counts — never student, family or enrollment records.
- Public pages are `force-dynamic` (set in `app/(public)/layout.tsx`) so availability is live and builds do not need the database.
- `/schedule` has a List / Calendar toggle (`?view=calendar` opens on the calendar). Both views share the same filters. The calendar is a custom month grid (`ScheduleCalendar`, `lib/calendar-grid.ts`) that works on studio-timezone day strings; on phones each day shows a count instead of class names.
- Dates on public pages are formatted in the studio timezone with the helpers in `lib/schedule-format.ts`.
- `/api/register` only ever creates PARENT or STUDENT accounts; the role is decided on the server.
- Role → landing page mapping lives in `lib/portal.ts` (`portalHome`).

### Security
- **Row-level security is enabled on every table** and the Supabase API roles (`anon`, `authenticated`) have no table privileges. The app only reaches the database through Prisma (table owner), so there are no policies. **Any migration that creates a table must also run `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`.**
- Password reset and email verification use single-use tokens stored hashed in `VerificationToken` (`lib/db/account.ts`). Never store or log raw tokens in production.
- Public endpoints (`/api/register`, `/api/account/*`) are rate limited with `lib/rate-limit.ts` (in-memory, per instance).
- Enrollment runs in a transaction that locks the session row, so capacity cannot be oversold; keep new enrollment paths going through `enrollStudent`.

### Deployment
- Hosting is Railway; there is no Railway config file. Railway uses the `build` and `start` scripts, so changes to how the app builds, migrates or starts belong in `package.json`. Do not add `railway.json` (deprecated by Railway) or `vercel.json`.
- `npm run start` runs `prisma migrate deploy` before `next start`. Migrations must therefore be safe to apply while the previous version is still serving.
- The nightly billing job runs inside the server and claims each day with a `BILLING_JOB_RUN` AuditLog row. The app must stay a single always-on instance for it to fire on time.
- `/api/health` is the platform health check (includes a database ping).
- Keep `.env.example` and the variable table in `docs/DEPLOY.md` in sync when adding an environment variable.

### Staff accounts
- Teachers and administrators are created by an admin (Teachers page; Settings → Administrators), never through public sign-up. The role is fixed by the endpoint (`POST /api/teachers` → TEACHER, `POST /api/admins` → ADMIN); nothing in the request can change it.
- Staff are created **without a password** and get a single-use, 7-day set-password link (`sendStaffInvite`, which reuses the password-reset token). An account with no password cannot sign in.
- The link is returned to the admin only when the email could not be sent (no email provider), so they can pass it on; never return it otherwise.
- **Removing staff disables the account, it does not delete it** (`User.disabledAt`; `removeTeacher` / `removeAdmin` in `lib/db/staff.ts`), so classes taught and the audit trail keep the name. Disabled accounts cannot sign in, get no reset links, and are filtered out of every staff list and the public site. Any new query that lists teachers or admins must filter `disabledAt: null`.
- A teacher with upcoming classes can only be removed by handing those classes to another current teacher. An admin cannot remove themself, and a SUPER_ADMIN cannot be removed.
- Adding a removed person again with the same email re-enables the same account.
- **Sessions are re-checked on every request** (`jwt` callback → `lib/account-status.ts`, cached 15 s): a removed or disabled account is signed out at once, and role changes take effect without signing in again. `middleware.ts` only reads the cookie, so API routes must keep calling `getServerSession`.

### Students, guardians and family groups
- A student may have a guardian, a family group, both, or neither (an adult student). **A guardian does not require a family group**: such a student is invoiced on their own and the guardian pays through the portal.
- The admin student form (`HouseholdFields`) asks for the guardian explicitly: an existing one, a new one with contact details, or none. A new guardian gets a PARENT account with no password and, if ticked, a set-password link.
- A family group can be picked, created from the same form, or skipped. Whenever a student is saved with both a guardian and a family group, the guardian is added to that group so they can see its invoices.
- Student, new guardian and new family group are saved in one transaction (`lib/db/household.ts`): if any part fails (for example the guardian email is already in use), nothing is created.

### Email your teacher
- Parents and adult students message a teacher through `POST /api/portal/teacher-messages`; the server looks up the teacher and sends the email with reply-to set to the sender. **A teacher email address must never be sent to a parent or student browser** (portal queries select the teacher `id` and name only).
- Allowed only for teachers of the sender own students current classes (upcoming, or within `TEACHER_CONTACT_DAYS`, in `lib/teacher-contact.ts`, which the pages also use to decide whether to show the button). Rate limited per sender. The message text is not stored; an AuditLog row records that one was sent.

### Accessibility
- Dialogs use `components/modal.tsx` (`Modal`): labelled, Escape to close, focus trapped and restored. Do not hand-roll overlay divs.
- Pick-lists use `StyledSelect`, which keeps its list inside the window (opening upward when needed), scrolls internally, and shows a filter box for long lists (or with `searchable`).
- Icon-only buttons need an accessible name (`aria-label` or an `sr-only` span). Form fields need a real label (`htmlFor`/`id`).
- `--primary` is set for WCAG AA contrast with white text (4.8:1). Check contrast before changing brand colors.

### Testing
- `npm test` runs Vitest (`tests/`). Pricing, enrollment capacity/waitlist and payment settlement are covered with an in-memory Prisma stand-in; update or add tests whenever that logic changes.

### Components
- Server Components by default. Add `"use client"` only when needed (event handlers, hooks, browser APIs).
- shadcn/ui components are in `components/ui/` — do not modify them directly. Wrap them if customization is needed. (Exception already made: `Input` and `Textarea` use `forwardRef`, because on React 18 react-hook-form's `register()` needs the ref.)
- For navigation that looks like a button use `components/link-button.tsx` (`LinkButton`), not `<Button render={<Link />}>`, so it stays a real link for screen readers.
- All data tables must have pagination, search, and at least one filter. Use TanStack Table.
- In a table, the row name (student, family, teacher) is the link to its detail page: a real `<Link>` styled `font-medium text-primary hover:underline`. Do not add a separate eye icon or "View" button for that.

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
| ClassTemplate | id, name, description, style, level, defaultDurationMins, basePriceCents (per-class price), dropInEnabled |
| ClassSession | id, templateId, teacherId, roomId, startTime, endTime, maxCapacity, isRecurring |
| Enrollment | id, studentId, sessionId, status (ACTIVE / WAITLIST / CANCELLED), registrationId? |
| Season | id, name, startDate, endDate, terms[] |
| Term | id, name, startDate, endDate, seasonId? |
| ClassPrice | id, templateId, plan (WEEKLY / MONTHLY / SEMESTER / ANNUAL), priceCents |
| Registration | id, studentId, templateId, termId?, seasonId?, plan, priceCents, startDate, endDate, status (ACTIVE / CANCELLED) |
| RegistrationCharge | id, registrationId, periodKey, amountCents, invoiceId |
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

### Term Registration and Billing Plans
A class (ClassTemplate) can be booked two ways:
- **Per class:** one Enrollment for one ClassSession, billed `basePriceCents`. Only offered when `dropInEnabled` is true.
- **For a term:** a `Registration` (student + class + term + plan) books every remaining date of the class in the term, creating one Enrollment per date with `registrationId` set. Those enrollments are **not** billed per class; the registration is billed by its plan.

Plans (`BillingPlan`), priced per class in `ClassPrice` (no row = not offered); the price is copied onto the Registration at sign-up:
- `WEEKLY` / `MONTHLY` — one charge for each week / month (studio timezone) in which the student holds at least one date, owed from the first date in it.
- `SEMESTER` — one charge for the term, owed from registration.
- `ANNUAL` — one charge covering the term's `Season`; only offered for terms that belong to a season.

Rules that must keep holding (`lib/registration-billing.ts`, `lib/billing.ts`, tested in `tests/`):
- An invoice bills every charge owed by its period end that is not already on a non-VOID invoice (`RegistrationCharge`), so instalments are never billed twice and missed ones are caught up.
- For the multi-class discount a whole registration is ONE enrollment, however many instalments it has. `FIXED_PRICE` rules apply to per-class enrollments only.
- Waitlisted and cancelled dates are not charged. Cancelling a registration releases future dates and stops future charges; issued invoices are not changed.
- A class date belongs to the term its start time falls in; a "class" is the ClassTemplate, so two weekly slots of the same template are one class for registration.
- Admins enroll a student from the student page with `AdminEnrollForm`: pick the class first, then the whole term (a Registration) or a single date (an Enrollment). The student page lists term registrations as one row each and only single dates individually. Never present every date of every class in one list.
- When dates are added to a class (`POST /api/sessions`), registered students are enrolled in them (`syncRegistrationsForTemplate`). Scripts that insert sessions directly do not do this.
- Invoices are still generated by an admin for a chosen period; a weekly plan only produces weekly bills if invoices are generated weekly.

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
- An instructor can view and mark attendance only for classes they teach, from the last 14 days through the end of today in studio time (`checkAttendanceAccess` in `lib/db/attendance.ts`; every attendance route goes through `requireAttendanceAccess`). Admins can mark any class. Parents and students never can.
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

# Nightly billing (all optional)
CRON_SECRET=""
BILLING_JOB_HOUR_UTC="9"
DISABLE_BILLING_SCHEDULER=""
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
- [ ] **Phase 10** — Embeddable widget (built: `/widget`), QA and accessibility pass (done), production deploy (not done)

Still open across phases: Stripe and Resend have only been run with placeholder keys (card payments, auto-pay charges, webhooks and email delivery are untested end to end); Sentry is not installed. Note that prices are charged per enrollment and an enrollment is for one ClassSession, so `basePriceCents` is effectively a per-class price.

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

# Production start (applies migrations first; this is what Railway runs)
npm run start

# Start a production build without touching the database schema
npm run start:local

# Run the test suite
npm test

# Add upcoming weekly sessions for every active class (non-destructive)
npm run db:schedule

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

*Keep this file updated as architectural decisions are made. It is the single source of truth for Claude Code sessions on this project.*
