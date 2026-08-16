-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "appointmentType" TEXT NOT NULL DEFAULT 'OPD',
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "doctorId" DROP NOT NULL,
ALTER COLUMN "appointmentTime" DROP NOT NULL;

-- AlterTable
ALTER TABLE "patients" ALTER COLUMN "nationality" SET DEFAULT 'Nigerian';

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
