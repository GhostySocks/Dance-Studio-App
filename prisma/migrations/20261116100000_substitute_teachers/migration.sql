-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "substituteForId" TEXT,
ADD COLUMN     "substituteReason" TEXT;

-- CreateIndex
CREATE INDEX "ClassSession_substituteForId_idx" ON "ClassSession"("substituteForId");

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_substituteForId_fkey" FOREIGN KEY ("substituteForId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
