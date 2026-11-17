-- The rate a teacher is paid, kept so it does not have to be entered again each period
ALTER TABLE "Teacher" ADD COLUMN "payBasis" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "payRateCents" INTEGER;
