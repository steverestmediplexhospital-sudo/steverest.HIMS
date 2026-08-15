-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isNurseInCharge" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vital_signs" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "nurse_shifts" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockedOutAt" TIMESTAMP(3),
    "ward" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nurse_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurse_assignments" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "nurse_assignments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "nurse_shifts" ADD CONSTRAINT "nurse_shifts_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurse_assignments" ADD CONSTRAINT "nurse_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "nurse_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurse_assignments" ADD CONSTRAINT "nurse_assignments_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
