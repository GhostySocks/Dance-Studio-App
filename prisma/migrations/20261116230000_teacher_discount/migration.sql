-- The studio's discount for teachers on the classes they take
ALTER TABLE "StudioProfile" ADD COLUMN "teacherDiscountType" TEXT;
ALTER TABLE "StudioProfile" ADD COLUMN "teacherDiscountValue" INTEGER;
