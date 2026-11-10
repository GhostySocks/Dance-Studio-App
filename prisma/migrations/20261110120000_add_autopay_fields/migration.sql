-- AlterTable
ALTER TABLE "FamilyGroup" ADD COLUMN     "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePaymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePaymentMethodId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FamilyGroup_stripeCustomerId_key" ON "FamilyGroup"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_stripeCustomerId_key" ON "Student"("stripeCustomerId");

