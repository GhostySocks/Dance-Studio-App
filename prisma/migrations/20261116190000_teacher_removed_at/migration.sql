-- An administrator who also teaches keeps their account when they stop teaching
ALTER TABLE "Teacher" ADD COLUMN "removedAt" TIMESTAMP(3);
