-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "makeupForId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_makeupForId_key" ON "Enrollment"("makeupForId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_makeupForId_fkey" FOREIGN KEY ("makeupForId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
