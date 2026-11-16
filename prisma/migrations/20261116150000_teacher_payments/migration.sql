-- CreateTable
CREATE TABLE "TeacherPayment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDay" TEXT NOT NULL,
    "endDay" TEXT NOT NULL,
    "classes" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "basis" TEXT,
    "rateCents" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "paidOn" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherPayment_teacherId_startDay_endDay_idx" ON "TeacherPayment"("teacherId", "startDay", "endDay");

-- AddForeignKey
ALTER TABLE "TeacherPayment" ADD CONSTRAINT "TeacherPayment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The app reaches the database only through Prisma (see the row level security migration)
ALTER TABLE "TeacherPayment" ENABLE ROW LEVEL SECURITY;
