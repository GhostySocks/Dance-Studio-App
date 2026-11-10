-- Lock the tables away from Supabase's auto-generated REST API.
--
-- Supabase exposes every table in the public schema through PostgREST to the
-- `anon` and `authenticated` roles. This app never uses that API: all access goes
-- through Prisma, which connects as the table owner and is not subject to RLS.
-- Enabling RLS with no policies therefore denies API access without affecting the app.
--
-- Every future migration that creates a table must also enable RLS on it.

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudioProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Guardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyGroupGuardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Teacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClassTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClassSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Scholarship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PricingRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Second layer: take away the API roles' table privileges, now and for tables
-- created later. Guarded so the migration also runs on a plain Postgres database.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
