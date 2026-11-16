-- CreateTable
CREATE TABLE "StudioClosure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDay" TEXT NOT NULL,
    "endDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioClosure_startDay_endDay_idx" ON "StudioClosure"("startDay", "endDay");

-- The app reaches the database only through Prisma (see the row level security migration)
ALTER TABLE "StudioClosure" ENABLE ROW LEVEL SECURITY;
